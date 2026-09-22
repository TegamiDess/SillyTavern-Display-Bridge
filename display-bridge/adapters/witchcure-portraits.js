import { compileStyles } from './witchcure-styles.js';
import { codeRanges } from '../core/parser.js';

export const AUTO_ROSTER_PATTERN = String.raw`^([\s\S]*?)(?:\s*\[명부\])?$`;
export function portraitRule(rule) {
    if(rule?.type!=='editdisplay') return null;
    const match=/^<img src="\(([A-Za-z][A-Za-z .-]{0,79})\)">$/.exec(rule.in);
    return match ? {name:match[1],template:rule.out} : null;
}
export function compilePortraits(source, css) {
    if(!Array.isArray(source.portraits)||source.portraits.length>50) throw new Error('Invalid portrait list.');
    const names=new Set(),classes=new Set();
    const portraits=source.portraits.map(item=>{
        if(!item||Object.keys(item).some(k=>!['name','template'].includes(k))||typeof item.name!=='string'||!/^[A-Za-z][A-Za-z .-]{0,79}$/.test(item.name)||names.has(item.name)||typeof item.template!=='string'||item.template.length>10000) throw new Error('Invalid or repeated portrait definition.');
        names.add(item.name);
        const t=document.createElement('template');t.innerHTML=item.template;
        const root=t.content.firstElementChild;
        // The source's Charlotte variant includes an unused checkbox. It has
        // no checked-state styling or action; retain the portrait, not a dead control.
        if(root?.className==='charlotte-container'&&root.children.length===2) {
            const input=root.children[0],label=root.children[1];
            if(input.outerHTML!=='<input type="checkbox" id="charlotte-checkbox" class="character-checkbox">'||label.tagName!=='LABEL'||label.getAttribute('for')!=='charlotte-checkbox'||label.className!=='charlotte-image-wrapper'||label.attributes.length!==2) throw new Error('Unsupported portrait control.');
            input.remove();const replacement=document.createElement('div');replacement.className=label.className;replacement.append(...label.childNodes);label.replaceWith(replacement);
        }
        const wrapper=root?.firstElementChild,img=wrapper?.firstElementChild,emoji=wrapper?.lastElementChild;
        const prefix=/^([a-z][a-z0-9-]{0,79})-container$/.exec(root?.className??'')?.[1];
        if(!prefix||t.content.children.length!==1||root.children.length!==1||wrapper?.children.length!==2||img?.tagName!=='IMG'||emoji?.tagName!=='DIV'||img.getAttribute('src')!=='{{raw::$1}}'||!emoji.textContent.trim()||emoji.textContent.length>30||emoji.children.length) throw new Error('Unsupported decorated portrait structure.');
        for(const [el,tag,suffix] of [[root,'DIV','container'],[wrapper,'DIV','image-wrapper'],[img,'IMG','image'],[emoji,'DIV','emoji']]) {
            if(el.tagName!==tag||el.className!==`${prefix}-${suffix}`||[...el.attributes].some(a=>!['class',...(el===img?['src']:[])].includes(a.name))) throw new Error('Unsupported portrait attribute.');
            classes.add(el.className);
        }
        for(const parent of [t.content,root,wrapper]) if([...parent.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())) throw new Error('Unexpected portrait text.');
        img.removeAttribute('src');img.dataset.dbAsset=item.name;img.alt=item.name;
        return {name:item.name,html:t.innerHTML};
    });
    const styles=portraits.length?compileStyles(source.styles,css,selector=>[...classes].some(name=>selector===`.${name}`||selector.startsWith(`.${name}:`)||selector.startsWith(`.${name} `))):{text:''};
    return {portraits,css:styles.text};
}
export function parsePortraits(source, compiled, excluded=[]) {
    const ignored=[...codeRanges(source),...excluded];
    return [...source.matchAll(/<img src="([A-Za-z][A-Za-z .-]{0,79})">/g)].flatMap(match=>{
        const start=match.index,end=start+match[0].length;
        if(source[start-1]==='\\'||ignored.some(([a,b])=>start<b&&end>a)||!compiled.portraits?.some(x=>x.name===match[1])) return [];
        return [{type:'witchcure-portrait',start,end,name:match[1]}];
    });
}
