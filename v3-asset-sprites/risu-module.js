// Legacy module.risum v0 framing follows RisuAI's exportModuleLegacy/readModule.
// The byte permutation is format data from RisuAI's rpack_map.bin, also present
// in rescuetycoon/risup/lib.js. This reader executes no imported scripts.
// See IMPORT-NOTES.md for sources and scope.
const DECODE = [44, 247, 132, 139, 201, 101, 251, 182, 159, 174, 179, 3, 45, 1, 105, 116, 31, 228, 163, 236, 238, 92, 52, 33, 147, 74, 15, 106, 226, 98, 2, 158, 34, 156, 253, 60, 252, 113, 199, 198, 173, 89, 103, 5, 112, 109, 138, 68, 18, 250, 36, 134, 95, 175, 209, 122, 71, 206, 254, 80, 99, 221, 81, 6, 111, 24, 224, 82, 168, 9, 157, 86, 115, 76, 184, 83, 108, 195, 160, 14, 25, 207, 62, 13, 126, 7, 50, 104, 70, 234, 72, 249, 153, 46, 171, 164, 73, 32, 94, 85, 53, 56, 12, 188, 211, 177, 88, 22, 121, 40, 10, 26, 225, 242, 205, 196, 57, 219, 162, 186, 96, 114, 118, 125, 149, 239, 127, 200, 192, 222, 55, 148, 191, 181, 20, 129, 146, 37, 69, 172, 231, 245, 102, 167, 43, 54, 90, 193, 19, 227, 75, 58, 232, 141, 131, 27, 124, 39, 176, 154, 66, 235, 135, 170, 220, 84, 142, 120, 38, 210, 87, 41, 212, 183, 248, 47, 143, 137, 117, 240, 65, 119, 194, 30, 255, 216, 21, 17, 229, 4, 151, 23, 243, 49, 208, 155, 0, 215, 202, 180, 79, 42, 59, 217, 178, 107, 218, 93, 161, 63, 48, 97, 189, 145, 61, 78, 230, 223, 190, 77, 130, 140, 29, 35, 16, 152, 100, 244, 133, 51, 123, 144, 67, 187, 169, 136, 241, 214, 165, 28, 246, 204, 110, 185, 91, 11, 150, 237, 213, 233, 197, 203, 8, 166, 128, 64];
export const MODULE_LIMIT = 4000000;

export function decodeRisuModule(bytes) {
    const fail = message => { throw new Error(`module.risum: ${message}`); };
    if (!(bytes instanceof Uint8Array) || bytes.length < 7 || bytes.length > MODULE_LIMIT) fail('invalid or oversized file');
    if (bytes[0] !== 111 || bytes[1] !== 0) fail('unsupported header/version');
    const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    const length = view.getUint32(2,true);
    if (!length || length > 2000000 || length + 6 >= bytes.length) fail('invalid JSON payload length');
    const decoded = bytes.slice(6,6+length).map(byte => DECODE[byte]);
    let payload;
    try { payload = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decoded)); }
    catch { fail('invalid encoded JSON'); }
    const module = payload?.module;
    if (payload?.type !== 'risuModule' || !module || typeof module !== 'object' || Array.isArray(module)) fail('invalid module object');
    for (const key of ['regex','trigger','assets']) if (module[key] !== undefined && !Array.isArray(module[key])) fail(`invalid ${key} list`);
    if ((module.regex?.length ?? 0)>500 || (module.trigger?.length ?? 0)>100) fail('too many rules or triggers');
    let offset=6+length, assetCount=0, ended=false;
    while (offset<bytes.length) {
        const tag=bytes[offset++];
        if (tag===0) { ended=true; break; }
        if (tag!==1 || offset+4>bytes.length) fail('invalid asset framing');
        const size=view.getUint32(offset,true); offset+=4;
        if (size>bytes.length-offset) fail('truncated asset');
        offset+=size; assetCount++;
    }
    if (!ended || offset!==bytes.length || assetCount!==(module.assets?.length ?? 0)) fail('invalid module ending or asset count');
    // Lorebook duplicates and binary module assets are not imported here.
    return {regex:module.regex ?? [],trigger:module.trigger ?? [],assetCount};
}

export function mergeModuleSource(card, module) {
    const data=card?.data ?? card;
    if (!data || typeof data!=='object' || Array.isArray(data)) throw new Error('Invalid card data');
    const extensions=data.extensions ?? {}, risu=extensions.risuai ?? {};
    const combine=(first,second)=>{
        const seen=new Set();
        return [...(Array.isArray(first)?first:[]),...second].filter(item=>{const key=JSON.stringify(item);if(seen.has(key))return false;seen.add(key);return true;});
    };
    const next={...data,extensions:{...extensions,risuai:{...risu,
        customScripts:combine(risu.customScripts,module.regex),triggerscript:combine(risu.triggerscript,module.trigger)}}};
    return card.data ? {...card,data:next} : next;
}
