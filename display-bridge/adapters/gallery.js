import { codeRanges } from '../core/parser.js';

export function parseGalleries(source, excluded = []) {
    const ignored = [...codeRanges(source), ...excluded], blocks = [];
    let cursor = 0, incomplete = 0, unsupported = 0;
    while (cursor < source.length) {
        const start = source.indexOf('DC[', cursor);
        if (start < 0) break;
        cursor = start + 3;
        if (source[start-1] === '\\' || ignored.some(([a,b]) => start >= a && start < b)) continue;
        let depth = 1, end = cursor;
        for (; end < source.length && depth; end++) { if (source[end] === '[') depth++; if (source[end] === ']') depth--; }
        if (depth) { incomplete++; break; }
        cursor = end;
        if (ignored.some(([a,b]) => start < b && end > a)) continue;
        try { blocks.push({ start, end, type:'gallery', ...readGallery(source.slice(start+3,end-1)) }); }
        catch { unsupported++; }
    }
    return { blocks, incomplete, unsupported };
}
function readGallery(text) {
    if (text.length > 200000) throw new Error('Gallery too large');
    const fields = text.split('|'), posts = [], ids = new Set();
    if (!fields[0].startsWith('GN:')) throw new Error('Missing gallery name');
    const name = fields.shift().slice(3);
    if (!name.trim()) throw new Error('Empty gallery name');
    let post;
    const keys = { PNUM:'number', PT:'title', PA:'author', PDATE:'date', PVIEWS:'views', PRECOM:'recommend', PCONT:'content' };
    for (let i=0;i<fields.length;i++) {
        const field = fields[i], colon = field.indexOf(':'), key = field.slice(0,colon), value = field.slice(colon+1);
        if (colon < 0) throw new Error('Unknown gallery field');
        if (key === 'PID') {
            if (!value || ids.has(value) || posts.length >= 100) throw new Error('Invalid post identity');
            post = { id:value, comments:[] }; posts.push(post); ids.add(value);
        } else if (!post) throw new Error('Missing post');
        else if (key === 'C') {
            if (i+1 >= fields.length || post.comments.length >= 200) throw new Error('Incomplete comment');
            const type = /^[FS]:/.test(value) ? value[0] : '';
            post.comments.push({ author:type ? value.slice(2) : value, type, text:fields[++i] });
        } else if (Object.hasOwn(keys,key) && !Object.hasOwn(post,keys[key])) post[keys[key]] = value;
        else throw new Error('Unknown or repeated gallery field');
    }
    if (posts.some(post => !post.title || !Object.hasOwn(post,'content'))) throw new Error('Incomplete post');
    return { name, posts };
}
