// Explicit speaker tags and bounded colours; no source CSS or inferred identities.
export function validateSpeakerColors(value,format){
 const fail=()=>{throw Error('Speaker colours: invalid palette');};
 const tag=s=>typeof s==='string'&&s.length>0&&s.length<=80&&!/[<>"\r\n]/.test(s)&&!['__proto__','constructor','prototype'].includes(s);
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['version','speakers','narrationTags'].includes(k))||value.version!==1||format?.kind!=='scene-fragments'||!format.details||!format.textTags)fail();
 if(!value.speakers||typeof value.speakers!=='object'||Array.isArray(value.speakers)||Object.keys(value.speakers).length>64)fail();
 for(const [id,entry]of Object.entries(value.speakers))if(!tag(id)||!entry||typeof entry!=='object'||Array.isArray(entry)||Object.keys(entry).some(k=>!['label','color'].includes(k))||typeof entry.label!=='string'||!entry.label.trim()||entry.label.length>80||!/^#[\da-f]{6}$/i.test(entry.color))fail();
 if(!Array.isArray(value.narrationTags)||value.narrationTags.length>16||new Set(value.narrationTags).size!==value.narrationTags.length||value.narrationTags.some(s=>!tag(s)||Object.hasOwn(value.speakers,s)))fail();
}
