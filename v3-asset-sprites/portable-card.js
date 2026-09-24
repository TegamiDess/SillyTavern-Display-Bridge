// SPDX-License-Identifier: AGPL-3.0-only
// Portable configuration only. No local paths, approvals or runtime markers.
import { sniffAudio } from './audio-assets.js';
export const PORTABLE_KEY = 'v3_asset_sprites';
const copy = value => JSON.parse(JSON.stringify(value));
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const fields = ['name','description','personality','scenario','first_mes','mes_example','creator_notes','system_prompt','post_history_instructions','creator','character_version'];
const lists = ['tags','alternate_greetings','group_only_greetings'];
const optional = ['character_book','nickname','creator_notes_multilingual','source','creation_date','modification_date'];

export function portableRules(value) {
    if (value === undefined) return null;
    if (!object(value) || value.version !== 1 || !Array.isArray(value.rules) || value.rules.length > 500 || JSON.stringify(value).length > 2000000
        || Object.keys(value).some(k=>!['version','rules','ui','incomplete'].includes(k))
        || (value.ui!==undefined&&!['none','profile'].includes(value.ui))
        || (value.incomplete!==undefined&&(!Array.isArray(value.incomplete)||value.incomplete.length>10000||value.incomplete.some(x=>typeof x!=='string'||x.length>300)))) throw Error('Unsupported or oversized portable image-rule configuration.');
    const ids = new Set();
    return value.rules.map(rule => {
        if (!object(rule) || Object.keys(rule).some(k=>!['id','name','source','flags','output','disabled'].includes(k))
            || typeof rule.id !== 'string' || !/^v3s-(?:card-\d+|local-(?:macro|tag|named-img)|builtin-(?:panel|panel-lax|dc|dialogue|attr|tag|audio))$/.test(rule.id)
            || ids.has(rule.id) || typeof rule.name !== 'string' || rule.name.length > 200
            || typeof rule.source !== 'string' || rule.source.length > 100000
            || typeof rule.flags !== 'string' || !/^[dgimsuvy]*$/.test(rule.flags)
            || typeof rule.output !== 'string' || rule.output.length > 100000 || typeof rule.disabled !== 'boolean') throw Error('Invalid portable image-rule definition.');
        ids.add(rule.id);
        // Template validation remains in the normal importer compiler.
        new RegExp(rule.source, rule.flags);
        return copy(rule);
    });
}

export function makePortableCard({data,profile,rules,assets,incomplete=[]}) {
    if (!object(data) || typeof data.name !== 'string' || !data.name.trim()) throw Error('A saved character name is required for export.');
    const result = {};
    for (const field of fields) result[field] = typeof data[field] === 'string' ? data[field] : '';
    for (const field of lists) result[field] = Array.isArray(data[field]) ? data[field].filter(x=>typeof x==='string') : [];
    for (const field of optional) if (data[field] !== undefined) result[field] = copy(data[field]);
    result.extensions = object(data.extensions) ? copy(data.extensions) : {};
    delete result.extensions.fav;
    delete result.extensions[PORTABLE_KEY];
    delete result.extensions.display_bridge_profile;
    // Caller has removed owned marker rules; preserve unrelated card rules.
    if (profile) result.extensions.display_bridge_profile = copy(profile);
    const portable = {version:1,ui:profile?'profile':'none',rules:copy(rules)};
    if (incomplete.length) portable.incomplete = incomplete.map(x=>String(x).slice(0,300));
    portableRules(portable);
    result.extensions[PORTABLE_KEY] = portable;
    result.assets = copy(assets);
    return {spec:'chara_card_v3',spec_version:'3.0',data:result};
}

// Sequential reads bound concurrent work for large galleries. Duplicate mapped
// paths share one archive entry without merging the logical asset names.
export async function packageImages(items,{readImage,sniffImage,maxBytes=256000000,kind='image'}) {
    if (!Array.isArray(items) || items.length > 10000) throw Error('Too many image assets to export.');
    const files = [], assets = [], missing = [], paths = new Map(), names = new Set();
    let totalBytes = 0;
    for (const item of items) {
        const asset = item.asset;
        if (!asset || typeof asset.name !== 'string' || !asset.name || asset.name.length > 256 || names.has(asset.name)) throw Error('Export requires distinct image names of at most 256 characters.');
        names.add(asset.name);
        if (!item.path) {missing.push(asset.name);continue;}
        let entry = paths.get(item.path);
        if (!paths.has(item.path)) {
            const bytes = await readImage(item.path);
            const ext = bytes && sniffImage(bytes);
            entry = null;
            if (ext) {
                totalBytes += bytes.length;
                if (totalBytes > maxBytes) throw Error('Export exceeds 256 MB of image bytes. Reduce the card assets before exporting.');
                const filename = `assets/other/${kind==='audio'?'audio':'images'}/${files.length + 1}.${ext}`;
                files.push({filename,bytes});entry = {uri:`embeded://${filename}`,ext};
            }
            paths.set(item.path,entry);
        }
        if (!entry) {missing.push(asset.name);continue;}
        // Risu routes generic images into ccAssets (its icon editor), not the
        // named asset library. Both importers accept this extension type; the
        // same bytes and URI serve both. Keep explicit special/custom roles.
        const type = typeof asset.type === 'string' ? asset.type : '';
        const portableType = kind==='audio'?'x-risu-asset':['', 'image', 'asset', 'other'].includes(type.trim().toLowerCase()) ? 'x-risu-asset' : type;
        assets.push({type:portableType,name:asset.name,...entry});
    }
    return {assets,files,missing,totalBytes};
}

export function packageAudio(items,options){return packageImages(items,{...options,kind:'audio',sniffImage:sniffAudio});}
