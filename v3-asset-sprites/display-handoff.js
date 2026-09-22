// Standalone importer transport: no Display Bridge dependency and no execution
// of source scripts. Only technical UI source crosses the extension boundary.
export function captureDisplaySource(card, origin) {
    const data = card?.data ?? card ?? {};
    const extensions = data.extensions ?? {};
    const risu = extensions.risuai ?? {};
    const source = { sourceVersion:1, ruleOptionsVersion:1, risuai:{
        backgroundHTML: typeof risu.backgroundHTML === 'string' ? risu.backgroundHTML : '',
        customScripts: (Array.isArray(risu.customScripts) ? risu.customScripts : []).map(rule => ({
            type: String(rule?.type ?? ''), label:String(rule?.comment ?? rule?.name ?? '').slice(0,120), in: String(rule?.in ?? ''), out: String(rule?.out ?? ''),
            matchOptions:Object.fromEntries(['ableFlag','flag','flags'].filter(key=>Object.hasOwn(rule??{},key)).map(key=>[key,key==='ableFlag'?(typeof rule[key]==='boolean'?rule[key]:null):(typeof rule[key]==='string'&&rule[key].length<=200?rule[key]:null)])),
        })),
        triggerscript: (Array.isArray(risu.triggerscript) ? risu.triggerscript : []).map(trigger => ({
            type: String(trigger?.type ?? ''), effect: (Array.isArray(trigger?.effect) ? trigger.effect : []).map(effect => ({
                type: String(effect?.type ?? ''), ...(typeof effect?.code === 'string' ? { code:effect.code } : {}),
            })),
        })),
    } };
    if (origin) source.origin = JSON.parse(JSON.stringify(origin));
    if (Object.hasOwn(extensions,'display_bridge_profile')) source.profile = extensions.display_bridge_profile;
    if (JSON.stringify(source).length > 2000000 || source.risuai.customScripts.length > 500 || source.risuai.triggerscript.length > 100) throw new Error('UI source exceeds the supported import size.');
    return JSON.parse(JSON.stringify(source));
}

export function createDisplayHandoff({ records, save, getBridge, announce = () => {}, canDeliver = () => true }) {
    const clone = value => JSON.parse(JSON.stringify(value));
    const entry = avatar => Object.hasOwn(records(),avatar) ? records()[avatar] : null;
    return {
        queue({ avatar, importId, source }) {
            if (typeof avatar !== 'string' || !avatar || typeof importId !== 'string' || !importId) throw new Error('Missing import identity.');
            const previous = entry(avatar);
            if (previous && previous.importId !== importId && previous.delivery === 'pending') throw new Error('Another UI handoff is pending for this avatar.');
            if (previous?.importId === importId) return;
            Object.defineProperty(records(),avatar,{value:{handoffVersion:1,avatar,importId,source:clone(source),delivery:'mapping'},enumerable:true,configurable:true,writable:true}); save();
        },
        complete(avatar, importId, images) {
            const item = entry(avatar);
            if (!item || item.importId !== importId || item.delivery !== 'mapping') return;
            item.images = clone(images); item.delivery = 'pending'; save(); this.flush(); announce();
        },
        pending() { return Object.values(records()).filter(item=>item.delivery==='pending').map(clone); },
        flush(avatar) {
            const bridge = getBridge();
            if (bridge?.importApiVersion !== 1 || typeof bridge.receiveImport !== 'function') return;
            for (const item of this.pending()) {
                if (avatar !== undefined && item.avatar !== avatar) continue;
                if (!canDeliver(item)) continue;
                try {
                    const result = bridge.receiveImport(item);
                    if (!result || !['applied','review','unsupported','rejected'].includes(result.status)) throw new Error('Unexpected UI handoff acknowledgement.');
                    const live = entry(item.avatar);
                    if (!live || live.importId !== item.importId) continue;
                    live.result = clone(result); live.delivery = 'delivered'; delete live.source; delete live.error; save();
                } catch (error) {
                    const live = entry(item.avatar);
                    if (live?.importId === item.importId) { live.error = String(error.message); save(); }
                }
            }
        },
    };
}
