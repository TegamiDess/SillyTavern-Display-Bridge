// Local named audio only; no remote URLs, playlists or executable formats.
export const AUDIO_EXT=new Set(['mp3','wav','ogg']);
export function audioAssets(assets){return assets.flatMap((asset,index)=>{if(!asset||typeof asset.name!=='string'||!asset.name||['icon','user_icon'].includes(String(asset.type).toLowerCase()))return [];const ext=String(asset.ext??String(asset.uri??'').split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i)?.[1]??'').replace(/^\./,'').toLowerCase();return AUDIO_EXT.has(ext)?[{asset,index}]:[];});}
export function sniffAudio(b){
    if(!(b instanceof Uint8Array)||b.length<16||b.length>32_000_000)return null;
    const has=(offset,s)=>[...s].every((c,i)=>b[offset+i]===c.charCodeAt(0));
    if(has(0,'RIFF')&&has(8,'WAVE'))return 'wav';
    const packet=27+b[26];
    if(has(0,'OggS')&&b[4]===0&&b[26]>0&&(has(packet,'OpusHead')||b[packet]===1&&has(packet+1,'vorbis')))return 'ogg';
    let start=0;if(has(0,'ID3')){if(b[3]<2||b[3]>4||[6,7,8,9].some(i=>b[i]>127))return null;start=10+(b[6]<<21)+(b[7]<<14)+(b[8]<<7)+b[9];}
    // Require a plausible MPEG audio frame, not an ID3 tag alone.
    for(let i=start;i<Math.min(b.length-3,start+4096);i++){if(b[i]===255&&(b[i+1]&224)===224&&(b[i+1]&24)!==8&&(b[i+1]&6)!==0&&(b[i+2]&240)!==0&&(b[i+2]&240)!==240&&(b[i+2]&12)!==12)return 'mp3';}
    return null;
}
export function localAudioURL(path){
    if(typeof path!=='string'||/[\u0000-\u001f\u007f\\?#]/.test(path)||path.startsWith('//'))return null;
    const clean=path.replace(/^\//,'');if(!/^(?:user\/files\/|user\/images\/)/.test(clean))return null;
    const parts=clean.split('/');if(parts.some(x=>!x||x==='.'||x==='..')||!AUDIO_EXT.has(parts.at(-1).split('.').at(-1).toLowerCase()))return null;
    return '/'+parts.map(encodeURIComponent).join('/');
}
