// Delimiters belong to a fixed, reviewed format; imported regex/scripts are not run.
const OPEN = '[Assets:';
const FIELDS = ['|Chat:', '|Time:', '|AkaChat:'];

export function codeRanges(source) {
    const ranges = [];
    const fence = /(^|\n)[ \t]{0,3}(`{3,}|~{3,})[^\n]*\n/g;
    let match;
    while ((match = fence.exec(source))) {
        const start = match.index;
        const close = new RegExp('(^|\\n)[ \\t]{0,3}' + match[2][0] + '{' + match[2].length + ',}[ \\t]*(?=\\n|$)', 'g');
        close.lastIndex = fence.lastIndex;
        const end = close.exec(source);
        const finish = end ? close.lastIndex : source.length;
        ranges.push([start, finish]);
        fence.lastIndex = finish;
    }
    const inline = /(`+)[\s\S]*?\1(?!`)/g;
    while ((match = inline.exec(source))) ranges.push([match.index, inline.lastIndex]);
    return ranges;
}

// Tracks bracket nesting and quoted HTML attributes so ']' in chat text or a
// quoted attribute cannot silently truncate a panel. Ambiguous input stays raw.
function readBlock(source, start) {
    let depth = 1;
    let tag = false;
    let quote = '';
    let field = 0;
    let position = start + OPEN.length;
    const pieces = [];
    let begin = position;
    for (; position < source.length; position++) {
        const c = source[position];
        if (tag) {
            if (quote) { if (c === quote) quote = ''; }
            else if (c === '"' || c === "'") quote = c;
            else if (c === '>') tag = false;
            continue;
        }
        if (c === '<' && /[a-zA-Z/!]/.test(source[position + 1] ?? '')) { tag = true; continue; }
        if (c === '[') depth++;
        if (c === ']') {
            depth--;
            if (depth === 0) {
                if (field !== FIELDS.length) return { end: position + 1, invalid: true };
                pieces.push(source.slice(begin, position));
                if (!pieces[0].trim()) return { end: position + 1, invalid: true };
                return {
                    start, end: position + 1,
                    type: 'media-panel',
                    image: pieces[0].trim(), chat: pieces[1],
                    timestamp: pieces[2].trim(), highlight: pieces[3].trim(),
                };
            }
        }
        if (depth === 1 && field < FIELDS.length && source.startsWith(FIELDS[field], position)) {
            pieces.push(source.slice(begin, position));
            position += FIELDS[field].length - 1;
            begin = position + 1;
            field++;
        }
    }
    return { end: source.length, incomplete: true };
}

export function parsePanels(source) {
    if (typeof source !== 'string') return { blocks: [], incomplete: 0, unsupported: 0 };
    const ignored = codeRanges(source);
    const blocks = [];
    let cursor = 0, incomplete = 0, unsupported = 0;
    while (cursor < source.length) {
        const start = source.indexOf(OPEN, cursor);
        if (start === -1) break;
        const code = ignored.find(([a, b]) => start >= a && start < b);
        if (code) { cursor = code[1]; continue; }
        if (start > 0 && source[start - 1] === '\\') { cursor = start + OPEN.length; continue; }
        const result = readBlock(source, start);
        if (result.incomplete) incomplete++;
        else if (result.invalid) unsupported++;
        else blocks.push(result);
        cursor = result.end;
    }
    return { blocks, incomplete, unsupported };
}

export function protectPanels(source, blocks, nonce) {
    let cursor = 0, text = '';
    const items = blocks.map((block, index) => {
        const token = `DBP${nonce}X${index}END`;
        if (source.includes(token)) throw new Error('Placeholder collision; retry rendering.');
        text += source.slice(cursor, block.start) + token;
        cursor = block.end;
        return { ...block, token };
    });
    return { source: text + source.slice(cursor), items, revision: nonce };
}
