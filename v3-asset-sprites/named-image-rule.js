// Only exact declared bare names and the simple quoted img form are handled.
// This runs before Markdown/HTML insertion, through ST's approved regex flow.
export function namedImageRule(names) {
    const allowed=[...new Set(names)].filter(name=>typeof name==='string' && name.length<=300 && name && !/["'<>/&\\\r\n]/.test(name) && !/^[a-z][a-z0-9+.-]*:/i.test(name));
    if (!allowed.length) return null;
    if (allowed.length>2000) throw new Error('Too many names for the native image rule');
    const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return {id:'v3s-local-named-img',name:'Declared bare-name HTML images',flags:'g',
        source:'<[iI][mM][gG]\\s+[sS][rR][cC]\\s*=\\s*(["\'])('+allowed.map(escape).join('|')+')\\1\\s*/?>',
        output:'<img src="$2">'};
}
