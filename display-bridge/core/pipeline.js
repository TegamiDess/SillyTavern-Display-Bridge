import { parsePortraitDialogue } from '../adapters/portrait-dialogue.js';
import { createPortraitDialogue } from '../components/portrait-dialogue.js';
import { parsePanels, protectPanels, codeRanges } from './parser.js';
import { parsePortraits } from '../adapters/witchcure-portraits.js';
import { createPortrait } from '../components/witchcure-portrait.js';
import { createMediaPanel, parseChatMarkup } from '../components/media-panel.js';
import { parseWitchcure } from '../adapters/witchcure.js';
import { createWitchcure } from '../components/witchcure.js';
import { parseGalleries } from '../adapters/gallery.js';
import { createGallery } from '../components/gallery.js';
import { parseWitchcureAuxiliary } from '../adapters/witchcure-auxiliary.js';
import { createWitchcureAuxiliary } from '../components/witchcure-auxiliary.js';
import { resolveImage } from '../integrations/assets.js';

export function displaySource(message) { return message.extra?.display_text || message.mes; }

export function makePlan(source, { stream = true, gallery = false, witchcure = null, portrait = null, recent = true, statusRecent = true, depth = 0, latestAssistant = true } = {}) {
    const parsed = stream ? parsePanels(source) : { blocks: [], incomplete: 0, unsupported: 0 };
    const blocks = [];
    const errors = [];
    for (const block of parsed.blocks) {
        try { blocks.push({ ...block, messages: parseChatMarkup(block.chat) }); }
        catch (error) { errors.push(error.message); }
    }
    const galleries = gallery ? parseGalleries(source, parsed.blocks.map(x => [x.start,x.end])) : {blocks:[],incomplete:0,unsupported:0};
    blocks.push(...galleries.blocks);
    if (witchcure) {
        const excluded = blocks.map(x => [x.start,x.end]);
        const auxiliary = parseWitchcureAuxiliary(source, witchcure, excluded);
        blocks.push(...auxiliary.map(x => ({...x, suppressed: !(x.type === 'witchcure-status' ? statusRecent : recent)})));
        blocks.push(...parseWitchcure(source, [...excluded,...auxiliary.map(x=>[x.start,x.end])]).map(x => ({ ...x, suppressed: !recent })));
        blocks.push(...parsePortraits(source,witchcure,blocks.map(x=>[x.start,x.end])));
        if(witchcure.cleanMoveTop) for(const match of source.matchAll(/@@move_top/g)) {
            const start=match.index,end=start+match[0].length;
            if(source[start-1]!=='\\'&&![...codeRanges(source),...blocks.map(x=>[x.start,x.end])].some(([a,b])=>start<b&&end>a)) blocks.push({type:'witchcure-cleanup',start,end});
        }
        if(witchcure.autoRoster&&source.trim()) {
            const roster=blocks.filter(x=>x.type==='witchcure');
            if(!roster.length) blocks.push({type:'witchcure',start:source.length,end:source.length,initialMode:'roster',suppressed:!recent,moveBottom:true});
            else roster.at(-1).moveBottom=true;
        }
    }
    const vn=portrait?parsePortraitDialogue(source,portrait,blocks.map(x=>[x.start,x.end]),depth):{blocks:[],incomplete:0,unsupported:0};
    if(['tagged','scene-fragments'].includes(portrait?.format.kind)){
        for(const item of vn.blocks)item.controls=false;
        const visible=vn.blocks.filter(item=>!item.suppressed);
        if(latestAssistant&&visible.some(item=>item.presentation!=='narration')){
            let controller=visible.findLast(item=>item.presentation==='metadata');
            if(!controller){controller={type:'portrait-dialogue',presentation:'metadata',speaker:'',dialogue:'',portrait:'',config:portrait,start:source.length,end:source.length};vn.blocks.push(controller);}
            controller.controls=true;controller.moveBottom=true;
        }
    }
    blocks.push(...vn.blocks);
    blocks.sort((a,b) => a.start - b.start);
    const protectedPlan = protectPanels(source, blocks, crypto.randomUUID().replaceAll('-', ''));
    // Keep an appended roster token out of the preceding Markdown construct,
    // especially a closing fenced-code delimiter.
    for(const item of protectedPlan.items) if(item.moveBottom&&item.start===item.end) protectedPlan.source=protectedPlan.source.replace(item.token,'\n\n'+item.token);
    return { ...protectedPlan, incomplete: parsed.incomplete + galleries.incomplete + vn.incomplete, unsupported: parsed.unsupported + galleries.unsupported + vn.unsupported + errors.length, errors };
}

// Each unique token must survive exactly once as a text node. A removed,
// duplicated or attribute-wrapped token aborts the whole pass before mounting.
export function renderPlan(plan, formattedHTML, options) {
    // A detached div can still fetch images immediately. Keep the formatter's
    // output inert until placeholders are checked and named assets are resolved.
    const template = document.createElement('template');
    template.innerHTML = formattedHTML; // Only SillyTavern's sanitized formatter output.
    const container = template.content;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    const targets = new Map();
    for (const item of plan.items) {
        const occurrences = nodes.flatMap(textNode => {
            const found = [];
            let offset = 0;
            while ((offset = textNode.data.indexOf(item.token, offset)) !== -1) {
                found.push({ textNode, offset }); offset += item.token.length;
            }
            return found;
        });
        const inHTML = formattedHTML.split(item.token).length - 1;
        if (occurrences.length !== 1 || inHTML !== 1 || occurrences[0].textNode.parentElement?.closest('pre, code, a, script, style, textarea')) {
            throw new Error('Another display rule changed a panel placeholder. Original display retained.');
        }
        targets.set(item.token, item);
    }
    // Match V3's existing bare-name image repair, before adopting these nodes
    // into the live document. Never reinterpret ordinary URLs or guessed paths.
    for (const image of container.querySelectorAll('img[src]')) {
        const reference = image.getAttribute('src') ?? '';
        if (!reference || /^(?:[a-z][a-z0-9+.-]*:|\/|\\)/i.test(reference)) continue;
        const result = resolveImage(options.avatar, reference);
        if (result.status === 'resolved') image.setAttribute('src', result.url);
    }
    const widgets = [];
    for (const textNode of nodes) {
        const matches = [...targets.keys()].flatMap(token => {
            const index = textNode.data.indexOf(token);
            return index < 0 ? [] : [{ token, index }];
        }).sort((a, b) => a.index - b.index);
        if (!matches.length) continue;
        const fragment = document.createDocumentFragment();
        let cursor = 0;
        for (const { token, index } of matches) {
            fragment.append(document.createTextNode(textNode.data.slice(cursor, index)));
            const item = targets.get(token);
            const cleanup=()=>{const host=document.createElement('span');host.hidden=true;return {host,refresh:()=>{},missingImages:()=>0};};
            const factory = item.type==='portrait-dialogue'?createPortraitDialogue:item.type==='witchcure-cleanup'?cleanup:item.type==='witchcure-portrait'?createPortrait:item.type === 'witchcure' ? createWitchcure : item.type.startsWith('witchcure-') ? createWitchcureAuxiliary : item.type === 'gallery' ? createGallery : createMediaPanel;
            const widget = factory(item, { ...options, stateFor: options.stateFor ? (definition, active) => options.stateFor(definition,item,active) : undefined });
            widget.moveTop = item.moveTop;
            widget.moveBottom=item.moveBottom;
            widget.host.dataset.displayBridgeRevision = plan.revision;
            widgets.push(widget);
            fragment.append(widget.host);
            cursor = index + token.length;
        }
        fragment.append(document.createTextNode(textNode.data.slice(cursor)));
        textNode.replaceWith(fragment);
    }
    // Risu's status template requests @@move_top, within this message only.
    container.prepend(...widgets.filter(widget => widget.moveTop).map(widget => widget.host));
    container.append(...widgets.filter(widget=>widget.moveBottom).map(widget=>widget.host));
    return { container, widgets };
}
