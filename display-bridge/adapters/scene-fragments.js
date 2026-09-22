// Fixed bridge-owned grammar. Imported regular expressions and templates are
// inspected during discovery only; they are never evaluated against messages.
const fail = message => { throw Error('Scene fragments: ' + message); };
const shape = (value, keys) => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k))) fail('unknown fields');
};
export function validateSceneFragments(format) {
    shape(format, ['kind', 'backgrounds', 'castFields', 'counts', 'dialogueOpeners', 'textTags']);
    if (format.kind !== 'scene-fragments') fail('unknown format');
    const choices = (values, allowed) => Array.isArray(values) && values.length > 0 && values.length <= allowed.length && new Set(values).size === values.length && values.every(x => allowed.includes(x));
    if (!choices(format.backgrounds, ['numbered-four', 'plain-four', 'numbered-five']) || ![2, 4].includes(format.castFields)
        || !choices(format.counts, [0, 1, 2, 3, 4]) || !choices(format.dialogueOpeners, ['single', 'double']) || typeof format.textTags !== 'boolean') fail('invalid fragment declaration');
}

const field = '"([^"<>\\r\\n]{1,256})"';
const safe = value => typeof value === 'string' && value.length <= 512 && !/[\u0000-\u001f]/.test(value);
// Convert only the reviewed text wrappers to plain text. Unknown markup or
// unfinished tags leave the entire scene native instead of swallowing content.
function dialogueText(body, textTags) {
    if (textTags) body = body.replace(/<text="[^"<>\r\n]{1,80}">([^]*?)<\/text>/g, (_, text) => text + '\n');
    body = body.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/?p\s*>/gi, '\n');
    if (/<\/?[A-Za-z!][^>]*>/.test(body) || /\{\{/.test(body)) fail('dialogue contains unsupported markup or macros');
    if (!body.trim() || body.length > 12000) fail('invalid dialogue length');
    return body.trim();
}

export function parseSceneFragments(source, config, excluded) {
    const result = {blocks: [], incomplete: 0, unsupported: 0}, f = config.format;
    const headers = [];
    for (const layout of f.backgrounds) {
        const numbered = layout !== 'plain-four', count = layout === 'numbered-five' ? 5 : 4;
        const re = new RegExp((numbered ? '<([^<>"\\r\\n]{1,80})>' : '') + '<img src=' + Array(count).fill(field).join('_') + '>', 'g');
        for (const m of source.matchAll(re)) {
            if (!numbered && /<[^<>\r\n]{1,80}>$/.test(source.slice(Math.max(0,m.index-82),m.index))) continue;
            if (source[m.index - 1] === '\\' || excluded.some(([a, b]) => m.index < b && m.index + m[0].length > a)) continue;
            headers.push({start: m.index, end: m.index + m[0].length, layout, values: m.slice(numbered ? 2 : 1)});
            if (headers.length >= 256) { result.unsupported++; break; }
        }
    }
    headers.sort((a, b) => a.start - b.start || b.end - a.end);
    const unique = []; for (const h of headers) if (!unique.length || h.start >= unique.at(-1).end) unique.push(h);
    for (let i = 0; i < unique.length; i++) {
        const h = unique[i], boundary = unique[i + 1]?.start ?? source.length;
        if (i >= 64) { result.unsupported++; break; }
        const window = source.slice(h.end, Math.min(boundary, h.end + 20000));
        const count = /^\s*<([0-4])>/.exec(window);
        if (!count) { result.incomplete++; continue; }
        let cursor = count[0].length;
        try {
            const n = Number(count[1]);
            if (!f.counts.includes(n)) fail('undeclared cast size');
            const portraits = [];
            const tuple = new RegExp('^\\s*<img=' + field + '_' + field + '><ct=' + Array(f.castFields).fill(field).join('_') + '>');
            for (let j = 0; j < n; j++) {
                const match = tuple.exec(window.slice(cursor));
                if (!match) fail('incomplete or unsupported cast');
                portraits.push({image: match[1], hover: match[2]}); cursor += match[0].length;
            }
            const open = /^\s*(<div>)?<div tn="([^"<>\r\n]{1,80})">/.exec(window.slice(cursor));
            if (!open || !f.dialogueOpeners.includes(open[1] ? 'double' : 'single')) fail('missing dialogue opener');
            cursor += open[0].length;
            const end = window.indexOf('</div>', cursor);
            if (end < 0) { result.incomplete++; continue; }
            // A double opener must close twice. Additional closing divs belong
            // to neither this block nor an inferred wrapper and remain native.
            const closing = open[1] ? /^<\/div>\s*<\/div>/.exec(window.slice(end)) : /^<\/div>/.exec(window.slice(end));
            if (!closing) { result.incomplete++; continue; }
            const finish = h.end + end + closing[0].length;
            if (excluded.some(([a, b]) => h.start < b && finish > a)) continue;
            const dialogue = dialogueText(window.slice(cursor, end), f.textTags);
            const [background, , third, fourth, fifth] = h.values;
            const metadata = h.layout === 'numbered-five' ? {date: third, time: fourth, location: fifth} : {time: fourth};
            if (!Object.values(metadata).every(safe)) fail('invalid metadata');
            result.blocks.push({type:'portrait-dialogue', presentation:'scene', start:h.start, end:finish, config, background, portraits, portrait:portraits[0]?.image ?? '', speaker:'', dialogue, ...metadata});
        } catch { result.unsupported++; }
    }
    for (const b of result.blocks) b.controls = b === result.blocks.at(-1);
    return result;
}
