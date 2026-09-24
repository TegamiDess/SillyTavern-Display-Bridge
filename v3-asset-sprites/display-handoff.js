// Standalone importer transport: no Display Bridge dependency and no execution
// of source scripts. Only technical UI source crosses the extension boundary.
export function captureDisplaySource(card, origin) {
    const data = card?.data ?? card ?? {};
    const extensions = data.extensions ?? {};
    const risu = extensions.risuai ?? {};
    const macroFields=[...[data.first_mes,...(Array.isArray(data.alternate_greetings)?data.alternate_greetings:[])].map(text=>({field:'greeting',text})),
        ...[data.description,data.personality,data.scenario,data.system_prompt,data.post_history_instructions,data.mes_example,...(Array.isArray(data.character_book?.entries)?data.character_book.entries:[]).map(e=>e?.content)].map(text=>({field:'prompt',text}))];
    const source = { sourceVersion:1, ruleOptionsVersion:1, sceneSourceVersion:1, contextSourceVersion:1,
        macroReferences:macroFields.flatMap(({field,text})=>[...String(text??'').matchAll(/\{\{\s*(getvar|setvar|#if(?:_pure)?)\b([^}]*)(?:\}\}|$)/gi)].map(m=>({field,kind:m[1].toLowerCase(),name:m[2].replace(/^::/,'').trim()}))).slice(0,1000),
        assets:(Array.isArray(data.assets)?data.assets:[]).slice(0,10000).map(a=>({name:String(a?.name??''),type:String(a?.type??''),ext:String(a?.ext??'')})),
        requiredMacros:[...new Set(macroFields.flatMap(({text})=>[...String(text??'').matchAll(/\{\{\s*(getvar|setvar|#if(?:_pure)?)\b/gi)].map(m=>m[1].toLowerCase())))],
        risuai:{
        defaultVariables:typeof risu.defaultVariables==='string'?risu.defaultVariables:'',
        backgroundHTML: typeof risu.backgroundHTML === 'string' ? risu.backgroundHTML : '',
        customScripts: (Array.isArray(risu.customScripts) ? risu.customScripts : []).map(rule => ({
            type: String(rule?.type ?? ''), label:String(rule?.comment ?? rule?.name ?? '').slice(0,120), in: String(rule?.in ?? ''), out: String(rule?.out ?? ''),
            matchOptions:Object.fromEntries(['ableFlag','flag','flags'].filter(key=>Object.hasOwn(rule??{},key)).map(key=>[key,key==='ableFlag'?(typeof rule[key]==='boolean'?rule[key]:null):(typeof rule[key]==='string'&&rule[key].length<=200?rule[key]:null)])),
        })),
        triggerscript: (Array.isArray(risu.triggerscript) ? risu.triggerscript : []).map(trigger => ({
            type: String(trigger?.type ?? ''), conditions:Array.isArray(trigger?.conditions)?JSON.parse(JSON.stringify(trigger.conditions)):[], effect: (Array.isArray(trigger?.effect) ? trigger.effect : []).map(effect => ({
                ...Object.fromEntries(Object.entries(effect??{}).filter(([k,v])=>['operator','var','value','valueType','indent','condition','targetType','target','source','endOfLoop','outputVar','index','indexType','source1','source1Type','source2','source2Type'].includes(k)&&['string','number','boolean'].includes(typeof v))),
                type: String(effect?.type ?? ''), ...(typeof effect?.code === 'string' ? { code:effect.code } : {}),
            })),
        })),
    } };
    if (origin) source.origin = JSON.parse(JSON.stringify(origin));
    if (Object.hasOwn(extensions,'display_bridge_profile')) source.profile = extensions.display_bridge_profile;
    else if (extensions.v3_asset_sprites?.version===1&&extensions.v3_asset_sprites.ui==='none') source.suppressDiscovery=true;
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
                    if (!result || !['applied','review','unsupported','rejected','not-requested'].includes(result.status)) throw new Error('Unexpected UI handoff acknowledgement.');
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
