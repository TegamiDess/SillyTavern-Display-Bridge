// Exact name substitutions only. No patterns, chained aliases or executable data.
export function validateImageMappings(value) {
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>200)throw Error('Expected up to 200 image mappings.');
    for(const [from,to] of Object.entries(value))if([from,to].some(x=>typeof x!=='string'||!x.trim()||x.length>256||/[\u0000-\u001f]/.test(x))||['__proto__','prototype','constructor'].includes(from))throw Error('Invalid image mapping.');
}
export function mappedPortraitReference(config,reference,variant='original') {
    const option=config.variants?.find(v=>v.id===variant);
    if(option&&Object.hasOwn(option.images,reference))return option.images[reference];
    return Object.hasOwn(config.imageMappings??{},reference)?config.imageMappings[reference]:reference;
}
// Labels are editor identities; exact source references still drive rendering.
export function appearanceChoices(config) {
    return [...(config.appearance?.allowOriginal===false?[]:[{id:'original',label:'As written'}]),...config.variants];
}
export function appearanceDefault(config) {return config.appearance?.defaultVariant??'original';}
export function preservePortraitMappings(incoming,current) {
    if(!current||incoming.format.kind!==current.format.kind)return incoming;
    const next=JSON.parse(JSON.stringify(incoming));
    // Both definitions are validated by the caller. Exact IDs are retained;
    // similarly named options are never merged by label or guessed meaning.
    next.variants=[...new Map([...incoming.variants,...current.variants].map(v=>[v.id,v])).values()];
    next.variantLabel=current.variantLabel;
    for(const key of ['imageMappings','metadataLabels','defaults','portraitLabels','appearance'])if(current[key])next[key]={...incoming[key],...current[key]};
    return next;
}
