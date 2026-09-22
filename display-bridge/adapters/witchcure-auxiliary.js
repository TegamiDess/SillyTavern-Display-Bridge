import { compileStyles, declarations } from './witchcure-styles.js';
import { codeRanges } from '../core/parser.js';

export function compileAuxiliary(source, styles, css, kind) {
    const window = kind === 'status' ? 5 : 1;
    const wrapper = '{{#if {{greater_equal::{{chat_index}}::{{? {{lastmessageid}}-' + window + '}}}}}}';
    let text = source.trim().replace(/^@@move_top\s*/, '');
    if (!text.startsWith(wrapper) || !text.endsWith('{{/if}}')) throw new Error(`Unsupported ${kind} visibility condition`);
    text = text.slice(wrapper.length, -7);
    const template = document.createElement('template'); template.innerHTML = text;
    const allowed = { DIV:['class','style'], SPAN:['class','style'], P:['class'], B:[], H2:['class'], H3:['class'],
        INPUT:['type','id','checked'], LABEL:['for','class'], IMG:['src','alt','class'] };
    const names = new Set(), ids = new Set(), assets = new Set();
    for (const node of template.content.querySelectorAll('*')) {
        if (!allowed[node.tagName]) throw new Error(`Unsupported ${kind} element: ${node.tagName}`);
        for (const attr of [...node.attributes]) {
            // Numeric data-value captures are metadata only.
            if (!allowed[node.tagName].includes(attr.name) && !(attr.name === 'data-value' && /^\$\d+$/.test(attr.value))) throw new Error(`Unsupported ${kind} attribute: ${attr.name}`);
            if (attr.name === 'style') {
                const sheet = css.parse(`.x{${attr.value.replace(/\$\d+/g, '0')}}`);
                if (sheet.stylesheet.rules.length !== 1) throw new Error('Invalid capture style');
                declarations(sheet.stylesheet.rules[0].declarations);
                if (attr.value.includes('$') && !/^width:\s*(?:\$\d+%|calc\(\$\d+ \* 10%\));?$/.test(attr.value)) throw new Error('Only numeric width bindings supported');
            }
        }
        node.classList.forEach(name => names.add(name));
        if (node.id) { if (ids.has(node.id)) throw new Error('Duplicate control ID'); ids.add(node.id); }
        if (node.tagName === 'INPUT' && node.type !== 'checkbox') throw new Error('Unsupported input type');
        if (node.tagName === 'IMG') {
            const match = /^\{\{raw::([^{}<>]+)\}\}$/.exec(node.getAttribute('src'));
            if (!match) throw new Error('Expected named local asset');
            node.removeAttribute('src'); node.dataset.dbAsset = match[1]; assets.add(match[1]);
        }
    }
    for (const label of template.content.querySelectorAll('label')) if (!ids.has(label.htmlFor)) throw new Error('Unknown control target');
    if (/\{\{|\}\}/.test(template.innerHTML)) throw new Error('Unsupported auxiliary macro');
    const count = kind === 'map' ? 4 : 17;
    if ([...template.innerHTML.matchAll(/\$(\d+)/g)].some(x => Number(x[1]) < 1 || Number(x[1]) > count)) throw new Error('Unknown capture');
    const relevant = selector => [...selector.matchAll(/[.#]([\w-]+)/g)].some(x => names.has(x[1]) || ids.has(x[1]));
    return { html: template.innerHTML, css: compileStyles(styles, css, relevant).text, assets: [...assets] };
}

function validNumber(value) {
    return typeof value === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()) && Number.isFinite(Number(value));
}
export function parseWitchcureAuxiliary(source, compiled, excluded = []) {
    const ignored = [...codeRanges(source), ...excluded];
    const blocks = [];
    const accept = (match, kind, fields) => {
        const start = match.index, end = start + match[0].length;
        if (source[start - 1] === '\\' || ignored.some(([a,b]) => start < b && end > a)) return;
        blocks.push({ start, end, type: `witchcure-${kind}`, fields, moveTop: kind === 'status' });
        ignored.push([start,end]);
    };
    if (compiled.map) for (const match of source.matchAll(/<MAP>([^<>]*?)<\/MAP>/g)) {
        const fields = match[1].split('|');
        if (fields.length === 4 && fields[0].trim() && validNumber(fields[1]) && validNumber(fields[2])) accept(match, 'map', fields);
    }
    if (compiled.status) for (const match of source.matchAll(/\[([^\[\]\r\n]+)\]/g)) {
        const fields = match[1].split('|');
        if (fields.length === 17 && [1,2,3,4,8,9].every(i => validNumber(fields[i])) && validNumber(fields[16])) accept(match, 'status', fields);
    }
    return blocks;
}

export function bindCaptures(html, fields) {
    // Parse reviewed template first. Captures never become markup or selectors.
    const template = document.createElement('template'); template.innerHTML = html;
    const replace = value => value.replace(/\$(\d+)/g, (_, n) => fields[Number(n)-1] ?? '');
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
    let node; while ((node = walker.nextNode())) node.textContent = replace(node.textContent);
    for (const el of template.content.querySelectorAll('*')) for (const attr of [...el.attributes]) {
        if (!attr.value.includes('$')) continue;
        if (attr.name === 'style') {
            const match = /^width:\s*(?:\$(\d+)%|calc\(\$(\d+) \* 10%\));?$/.exec(attr.value);
            const value = match && fields[Number(match[1] ?? match[2])-1];
            if (!match || !validNumber(value)) throw new Error('Invalid numeric capture');
            // Preserve the generated score in text/data attributes. Only the
            // visual fill is bounded, so exaggerated scores cannot break UI.
            const maximum = match[2] ? 10 : 100;
            const percentage = Math.min(maximum, Math.max(0, Number(value))) / maximum * 100;
            el.style.width = `${percentage}%`;
            continue;
        } else if (!['data-db-asset','data-value'].includes(attr.name)) throw new Error('Unsupported capture destination');
        el.setAttribute(attr.name, replace(attr.value));
    }
    return template.content;
}
