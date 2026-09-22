// Shared CSS validation for the reviewed Witchcure adapters.
const PROPERTIES = new Set(('border-image border-bottom border-left-width border-right border-style border-width flex flex-direction flex-grow flex-shrink flex-wrap image-rendering isolation letter-spacing margin-left margin-right min-height min-width pointer-events scrollbar-color scrollbar-width vertical-align white-space align-items background background-color border border-color border-left border-radius border-top bottom box-shadow box-sizing color content cursor display filter font-family font-size font-weight gap grid-auto-rows grid-column grid-gap grid-row grid-template-columns grid-template-rows height justify-content left line-height margin margin-bottom margin-top max-height max-width object-fit object-position opacity overflow overflow-y padding padding-top padding-bottom padding-left padding-right position right text-align text-shadow top transform transition width z-index').split(' '));
const relevant = selector => /\.(?:regex-witch-(?:roster|detail|frame|number|inner|image|name|back)|assessment-)|#(?:witch-detail|subject-)/.test(selector);

export function declarations(items) {
    return items.filter(item => item.type !== 'comment').map(item => {
        if (item.type !== 'declaration' || !PROPERTIES.has(item.property)) throw new Error(`Unsupported Witchcure CSS property: ${item.property ?? item.type}`);
        const value = item.value;
        // Exact, reviewed 8x8 raster frame embedded in the supplied map CSS.
        // This is not a general data-URL or external-resource allowance.
        if (item.property === 'border-image' && value === "url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAALElEQVQoU2NkIAAYGRkZGQmJwxUQUgBXTEAB3FQMDAwMRnyKcRpJ0FAGYgAAQTYIWuAjjpUAAAAASUVORK5CYII=') 2 stretch") return { type:'declaration', property:item.property, value };
        if (/url\s*\(|image-set\s*\(|expression\s*\(|var\s*\(|attr\s*\(|paint\s*\(|@|[<>]/i.test(value)
            || (value.includes('\\') && !(item.property === 'content' && /^(['"])\\[a-f\d]{1,6}\s?\1$/i.test(value)))) {
            throw new Error(`Unsupported resource or expression in CSS: ${item.property}`);
        }
        return { type: 'declaration', property: item.property, value };
    });
}

export function compileStyles(markup, css, isRelevant = relevant) {
    const template = document.createElement('template'); template.innerHTML = markup;
    const report = { retainedRules: 0, omittedRules: 0 };
    function filterRules(rules) {
        const kept = [];
        for (const rule of rules) {
            if (rule.type === 'comment') continue;
            if (rule.type === 'media') {
                const children = filterRules(rule.rules);
                if (children.length) kept.push({ type: 'media', media: rule.media, rules: children });
            } else if (rule.type === 'rule') {
                const selectors = rule.selectors.filter(isRelevant);
                if (!selectors.length) { report.omittedRules++; continue; }
                if (selectors.some(x => /:host|:root|::slotted|\\/i.test(x))) throw new Error('Unsupported CSS scope selector.');
                kept.push({ type: 'rule', selectors, declarations: declarations(rule.declarations) });
                report.retainedRules++;
            } else throw new Error(`Unsupported stylesheet rule: ${rule.type}`);
        }
        return kept;
    }
    const rules = [];
    for (const node of template.content.childNodes) {
        if (node.nodeType === 8 || (node.nodeType === 3 && !node.textContent.trim())) continue;
        if (node.nodeName !== 'STYLE' || node.attributes.length) throw new Error('Witchcure shared styling must contain plain style elements only.');
        rules.push(...filterRules(css.parse(node.textContent).stylesheet.rules));
    }
    if (!report.retainedRules) throw new Error('No Witchcure roster/report styles were found.');
    return { text: css.stringify({ type: 'stylesheet', stylesheet: { rules } }), report };
}

