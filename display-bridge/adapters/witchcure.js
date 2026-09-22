import { compileStyles, declarations } from './witchcure-styles.js';
import { compileAuxiliary } from './witchcure-auxiliary.js';
import { codeRanges } from '../core/parser.js';
import { portraitRule, compilePortraits, AUTO_ROSTER_PATTERN } from './witchcure-portraits.js';

const WRAPPER = '{{#if {{greater_equal::{{chat_index}}::{{? {{lastmessageid}}-1}}}}}}';

export function witchcureSource(card) {
    let json = {};
    if (typeof card?.json_data === 'string') { try { json = JSON.parse(card.json_data); } catch { /* Report missing source below. */ } }
    const risu = card?.data?.extensions?.risuai ?? card?.extensions?.risuai ?? json?.data?.extensions?.risuai;
    const rules = risu?.customScripts;
    if (!Array.isArray(rules)) return null;
    const roster = rules.find(rule => rule.type === 'editdisplay' && rule.in === String.raw`\[명부\]`);
    const report = rules.find(rule => rule.type === 'editdisplay' && rule.in === String.raw`\[평가 보고서\]`);
    if (!roster || !report || typeof risu.backgroundHTML !== 'string') return null;
    const source = { roster: roster.out, report: report.out, styles: risu.backgroundHTML };
    const portraits=rules.map(portraitRule).filter(Boolean);
    if(portraits.length) source.portraits=portraits;
    if(rules.some(r=>r.type==='editoutput'&&r.in===AUTO_ROSTER_PATTERN&&r.out==='$1\n\n[명부]')) source.autoRoster=true;
    if(rules.some(r=>r.type==='editdisplay'&&r.in==='@@move_top'&&r.out==='')) source.cleanMoveTop=true;
    for (const [kind, marker] of [['map','map-buttons-container'], ['status','regex-witch-counsel-status-wrapper']]) {
        const rule = rules.find(rule => rule.type === 'editdisplay' && typeof rule.out === 'string' && rule.out.includes(`class="${marker}"`));
        if (rule) source[kind] = rule.out;
    }
    return source;
}

function compileTemplate(source, css, expectedClass) {
    if (typeof source !== 'string') throw new Error('Missing Witchcure template.');
    let text = source.trim();
    if (!text.startsWith(WRAPPER) || !text.endsWith('{{/if}}')) throw new Error('Unsupported Witchcure visibility expression.');
    text = text.slice(WRAPPER.length, -'{{/if}}'.length);
    let buttons = 0;
    // The supplied Risu export has an unterminated onclick attribute. Translate
    // this one known macro BEFORE HTML parsing; never execute an event string.
    text = text.replace(/<button\s+style="([^"]*)"\s+onclick="\{\{button::([^{}<>]+)::toggleNameFormat\}\}<\/button>/g,
        (_, style, label) => { buttons++; return `<button type="button" data-db-switch="true" style="${style}">${label}</button>`; });
    if (buttons !== 1) throw new Error('Expected exactly one supported roster/report toggle.');
    const template = document.createElement('template'); template.innerHTML = text;
    const allowed = {
        DIV: ['class', 'style'], SPAN: ['class', 'style'], P: ['class'], B: [], I: [],
        INPUT: ['type', 'id', 'class', 'checked'], LABEL: ['for', 'class', 'style'],
        IMG: ['src', 'alt', 'class'], BUTTON: ['type', 'data-db-switch', 'style'],
    };
    const ids = new Set();
    const references = new Set();
    for (const node of template.content.querySelectorAll('*')) {
        if (!allowed[node.tagName]) throw new Error(`Unsupported template element: ${node.tagName}`);
        for (const attribute of [...node.attributes]) {
            if (!allowed[node.tagName].includes(attribute.name)) throw new Error(`Unsupported template attribute: ${attribute.name}`);
            if (attribute.name === 'style') {
                const sheet = css.parse(`.validated { ${attribute.value} }`);
                if (sheet.stylesheet.rules.length !== 1 || sheet.stylesheet.rules[0].type !== 'rule') throw new Error('Invalid inline style.');
                node.setAttribute('style', declarations(sheet.stylesheet.rules[0].declarations).map(x => `${x.property}:${x.value}`).join(';'));
            }
        }
        if (node.tagName === 'INPUT' && node.getAttribute('type') !== 'checkbox') throw new Error('Only checkbox controls are supported in this adapter.');
        if (node.id) { if (ids.has(node.id)) throw new Error('Duplicate template control ID.'); ids.add(node.id); }
        if (node.tagName === 'IMG') {
            const match = /^\{\{raw::([^{}<>]+)\}\}$/.exec(node.getAttribute('src') ?? '');
            if (!match) throw new Error('Images must use a named local raw asset reference.');
            node.removeAttribute('src'); node.dataset.dbAsset = match[1]; references.add(match[1]);
        }
    }
    for (const label of template.content.querySelectorAll('label[for]')) {
        const target=template.content.getElementById(label.htmlFor);
        if (target?.tagName !== 'INPUT' || target.type !== 'checkbox') throw new Error('Label references an unknown checkbox.');
    }
    if (template.content.children.length !== 1 || !template.content.firstElementChild.classList.contains(expectedClass)) throw new Error('Unexpected Witchcure template root.');
    const prefix=expectedClass==='regex-witch-roster-wrapper'?'regex-witch-roster':'assessment';
    for(const className of [`${prefix}-toggle`,`${prefix}-content`,`${prefix}-grid`]) {
        const matches=template.content.querySelectorAll('.'+className);
        if(matches.length!==1 || (className.endsWith('-toggle') && (matches[0].tagName!=='INPUT'||!matches[0].id))) throw new Error('Missing or repeated Witchcure control structure: '+className);
    }
    if (/\{\{|\}\}/.test(template.innerHTML)) throw new Error('An unsupported Risu macro remains in the template.');
    return { html: template.innerHTML, references: [...references] };
}

export function compileWitchcure(source, css) {
    if (!css?.parse || !css?.stringify) throw new Error('SillyTavern CSS parser is unavailable.');
    const roster = compileTemplate(source.roster, css, 'regex-witch-roster-wrapper');
    const report = compileTemplate(source.report, css, 'assessment-report-wrapper');
    const styles = compileStyles(source.styles, css);
    const auxiliary = {};
    const portraits=source.portraits?compilePortraits(source,css):{portraits:[],css:''};
    for (const kind of ['map', 'status']) if (source[kind]) auxiliary[kind] = compileAuxiliary(source[kind], source.styles, css, kind);
    return { ...auxiliary, roster: roster.html, report: report.html, css: styles.text, portraits:portraits.portraits,portraitCSS:portraits.css,autoRoster:source.autoRoster===true,cleanMoveTop:source.cleanMoveTop===true, summary: { ...styles.report, assets: [...new Set([...roster.references, ...report.references,...portraits.portraits.map(x=>x.name)])] } };
}

export function parseWitchcure(source, excluded = []) {
    const ignored = [...codeRanges(source), ...excluded];
    return [...source.matchAll(/\[(명부|평가 보고서)\]/g)].flatMap(match => {
        const start = match.index, end = start + match[0].length;
        if (source[start - 1] === '\\' || ignored.some(([a,b]) => start < b && end > a)) return [];
        return [{ start, end, type: 'witchcure', initialMode: match[1] === '명부' ? 'roster' : 'report' }];
    });
}
