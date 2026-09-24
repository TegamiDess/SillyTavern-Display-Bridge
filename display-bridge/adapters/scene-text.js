// Small, bounded text grammar. Produces text/marks only, never HTML to inject.
const fail = () => { throw Error('Unsupported scene dialogue'); };
const entities = text => text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (all, key) => {
    if (key[0] !== '#') return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0'})[key.toLowerCase()];
    const number = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2),16) : Number(key.slice(1));
    return number >= 32 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff) ? String.fromCodePoint(number) : all;
});
export function parseSceneText(body, textTags) {
    if (!body.trim() || body.length > 12000 || /\{\{/.test(body)) fail();
    const runs = [], stack = [];
    const add = (text, extra = []) => {
        if (!text) return;
        const marks = [...new Set([...stack.map(x=>x.mark).filter(Boolean), ...extra])];
        const kind = stack.findLast(x=>x.kind)?.kind ?? 'dialogue';
        const last = runs.at(-1);
        if (last && last.kind === kind && String(last.marks) === String(marks)) last.text += text;
        else runs.push({text, marks, kind});
        if (runs.length > 2048) fail();
    };
    const inline = raw => {
        const text = entities(raw);
        // Deliberately no links, images, code execution or recursive Markdown.
        const re = /(\*\*|__|~~|\*|_)([^\s][\s\S]*?)\1/g;
        let cursor = 0;
        for (const m of text.matchAll(re)) {
            if (/\s$/.test(m[2]) || m[1].includes('_') && (/\w/.test(text[m.index-1]??'') || /\w/.test(text[m.index+m[0].length]??''))) continue;
            add(text.slice(cursor,m.index)); add(m[2], [m[1].length===2?(m[1]==='~~'?'s':'strong'):'em']); cursor=m.index+m[0].length;
        }
        add(text.slice(cursor));
    };
    const tags = /<[^>]*>/g; let cursor = 0;
    for (const m of body.matchAll(tags)) {
        inline(body.slice(cursor,m.index)); cursor=m.index+m[0].length;
        const token=m[0];
        if (/^<br\s*\/?\s*>$/i.test(token)) { add('\n'); continue; }
        const close=/^<\/(p|b|strong|em|i|u|s|del|span|text)>$/i.exec(token);
        if (close) {
            if (stack.at(-1)?.tag !== close[1].toLowerCase()) fail();
            stack.pop(); if (['p','text'].includes(close[1].toLowerCase())) add('\n'); continue;
        }
        const plain=/^<(p|b|strong|em|i|u|s|del)>$/i.exec(token);
        const wrapper=textTags && /^<text="([^"<>\r\n]{1,80})">$/.exec(token);
        const span=/^<span class="(dialogue|narration)">$/.exec(token);
        if (!plain && !wrapper && !span) fail();
        const tag=plain?.[1].toLowerCase() ?? (wrapper?'text':'span');
        if (tag==='p' && runs.length && !runs.at(-1).text.endsWith('\n')) add('\n');
        const mark=({b:'strong',strong:'strong',em:'em',i:'em',u:'u',s:'s',del:'s'})[tag];
        const label=wrapper?.[1] ?? span?.[1];
        stack.push({tag,mark,kind:label==='narration'?'narration':label?'dialogue':undefined});
        if (stack.length>16) fail();
    }
    inline(body.slice(cursor));
    if (stack.length || /[<>]/.test(body.replace(tags,''))) fail();
    if (runs.length) { runs[0].text=runs[0].text.trimStart(); runs.at(-1).text=runs.at(-1).text.trimEnd(); }
    const dialogue=runs.map(x=>x.text).join(''); if (!dialogue.trim()) fail();
    return {dialogue, dialogueRuns:runs.filter(x=>x.text)};
}
