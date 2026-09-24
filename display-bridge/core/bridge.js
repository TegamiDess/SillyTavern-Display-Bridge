import { createSceneAudio } from './scene-audio.js';
import { createChatMusic } from '../components/chat-music.js';
import { createChatInformation } from '../components/chat-information.js';
import { storySnapshot } from '../adapters/scene-state.js';
import { createStoryState } from '../integrations/story-state.js';
import { createChatDock } from '../components/chat-dock.js';
import { preservePortraitMappings } from '../adapters/portrait-mappings.js';
import { createImageViewer } from '../components/image-viewer.js';
import { snapshot } from '../integrations/snapshot.js';
import { validatePortraitPreset, portraitActions } from '../adapters/portrait-dialogue.js';
import { initialState } from './actions.js';
import { createPresetEditor } from '../components/preset-editor.js';
import { validateProfile, discoverProfile, profileFromSettings, profileConflicts, portraitVersion } from './profiles.js';
import { createActionStore, reduceAction, WITCH_MODE } from './actions.js';
import { createCharacterLifecycle } from './character-lifecycle.js';
import { createPreferences } from './preferences.js';
import { displaySource, makePlan, renderPlan } from './pipeline.js';
import { createMediaPanel } from '../components/media-panel.js';
import { witchcureSource, compileWitchcure } from '../adapters/witchcure.js';
import { createCompatibilityView, sourceOrigin, panelNames } from './compatibility.js';

export const SAMPLE = '[Assets:sample.webp|Chat:<p><span>Alex</span><span>Hello! Great to see you.</span></p><p><span>River</span><span>What are we drawing today?</span></p><p><span>Jun</span><span>Love the colours!</span></p>|Time:07/21 08:00 pm|AkaChat:Welcome to the stream!]';

export function createDisplayBridge({ getContext, extensionSettings, saveSettings, cssParser, rememberChat = () => {}, afterRender = () => {} }) {
    const states = new Map();
    const sceneAudio=createSceneAudio(),chatMusic=createChatMusic(sceneAudio),chatInformation=createChatInformation();let generationBusy=false;
    const imageViewer=createImageViewer({enabled:()=>settings().compactImages===true,scope:()=>character()?chatScope(character().avatar):null});
    let plans = new WeakMap();
    const errors = new Map();
    const compiledSources = new Map();
    const actionStore = createActionStore({ onChange: schedule });
    const objectIds = new WeakMap();
    let nextObjectId = 0;
    function objectId(value) { if (!objectIds.has(value)) objectIds.set(value, ++nextObjectId); return objectIds.get(value); }
    let observedChat = null, observer = null, frame = 0, stopped = false;
    let controls = null;
    const subscriptions = [];
    const preferences=createPreferences({state:()=>settings().presentation??={},save:saveSettings});
    const lifecycle=createCharacterLifecycle({state:()=>settings().lifecycle??={},save:saveSettings,retire:retireCharacter,rename:renameCharacter});
    const story=createStoryState({getContext,scope:()=>{const c=character();return c&&enabled(c.avatar)&&profile(c.avatar).adapters?.includes('portrait-dialogue')?{identity:lifecycle.ensure(c)?.id,config:profile(c.avatar).portraitSource}:null;},changed:()=>{if(profile(character()?.avatar).portraitSource?.sceneState){plans=new WeakMap();schedule();}}});
    const chatDock=createChatDock({rebuild:()=>story.rebuild(story.read()?.choice??null)});

    function retireCharacter(avatar,reason) {
        const s=settings(),old=Object.hasOwn(s.profiles,avatar)?s.profiles[avatar]:null;
        if(old) {s.retired??=[];s.retired.push({avatar,reason,profile:old});s.retired=s.retired.slice(-8);delete s.profiles[avatar];}
        const identity=s.lifecycle?.entries?.[avatar]?.id;if(identity)preferences.reset(identity);
        for(const k of Object.keys(s.importReceipts)) {try{if(JSON.parse(k)[0]===avatar)delete s.importReceipts[k];}catch{/* Old malformed receipt cannot be attributed. */}}
        compiledSources.delete(avatar);plans=new WeakMap();actionStore.clear();errors.clear();
    }
    function renameCharacter(oldAvatar,newAvatar) {
        const s=settings();if(Object.hasOwn(s.profiles,oldAvatar)){Object.defineProperty(s.profiles,newAvatar,{value:s.profiles[oldAvatar],writable:true,configurable:true,enumerable:true});delete s.profiles[oldAvatar];}
        for(const k of Object.keys(s.importReceipts)) {try{const scope=JSON.parse(k);if(scope[0]===oldAvatar){scope[0]=newAvatar;s.importReceipts[JSON.stringify(scope)]=s.importReceipts[k];delete s.importReceipts[k];}}catch{/* Ignore invalid old keys. */}}
        compiledSources.clear();plans=new WeakMap();actionStore.clear();errors.clear();
    }
    function durableChat() {const ctx=getContext(),id=ctx.chatId??ctx.getCurrentChatId?.();return typeof id==='string'&&id? id:null;}

    function settings() {
        const value = extensionSettings.display_bridge ??= { version: 1, profiles: {} };
        if (!value.profiles || typeof value.profiles !== 'object' || Array.isArray(value.profiles)) value.profiles = {};
        if (!value.importReceipts || typeof value.importReceipts !== 'object' || Array.isArray(value.importReceipts)) value.importReceipts = {};
        value.version=2;
        return value;
    }
    function character() {
        const ctx = getContext();
        if (ctx.groupId !== undefined && ctx.groupId !== null && ctx.groupId !== '') return null;
        return ctx.characters?.[ctx.characterId] ?? null;
    }
    function enabled(avatar) {
        const profiles = settings().profiles;
        const target=(getContext().characters??[]).find(x=>x.avatar===avatar);
        return !!avatar && lifecycle.ensure(target)?.active===true && Object.hasOwn(profiles, avatar) && profiles[avatar]?.enabled === true;
    }
    function profile(avatar) {
        return Object.hasOwn(settings().profiles, avatar) ? settings().profiles[avatar] : {};
    }
    function updateProfile(avatar, patch) {
        Object.defineProperty(settings().profiles, avatar, {
            value: { ...profile(avatar), ...patch, profileVersion: 1 }, configurable: true, enumerable: true, writable: true,
        });
    }
    function witchFor(avatar, inspect = false) {
        const selected = character();
        if (selected?.avatar !== avatar || (!inspect && !profile(avatar).adapters?.includes('witchcure'))) return null;
        const source = profile(avatar).witchcureSource ?? witchcureSource(selected);
        const cached = compiledSources.get(avatar);
        if (cached && cached.source?.roster === source?.roster && cached.source?.report === source?.report && cached.source?.styles === source?.styles && cached.source?.map === source?.map && cached.source?.status === source?.status && cached.source?.autoRoster===source?.autoRoster && cached.source?.cleanMoveTop===source?.cleanMoveTop && JSON.stringify(cached.source?.portraits)===JSON.stringify(source?.portraits)) return cached;
        let result;
        try {
            if (!source) throw new Error('Witchcure templates are missing. Attach the original JSON for this character.');
            result = { source, value: compileWitchcure(source, cssParser), error: null };
        } catch (error) { result = { source, value: null, error: error.message }; }
        compiledSources.set(avatar, result);
        return result;
    }
    function chatScope(avatar) {
        const ctx = getContext();
        const chatId = ctx.chatId ?? ctx.getCurrentChatId?.();
        return JSON.stringify([avatar, chatId !== undefined && chatId !== null && chatId !== '' ? ['named', chatId] : ['array', objectId(ctx.chat)]]);
    }
    function planFor(message, avatar) {
        const source = displaySource(message);
        if (typeof source !== 'string') return null;
        const witchcure = witchFor(avatar)?.value ?? null;
        const stream = profile(avatar).adapters?.includes('media-panel') === true;
        const gallery = profile(avatar).adapters?.includes('gallery') === true;
        const portrait=profile(avatar).adapters?.includes('portrait-dialogue')?profile(avatar).portraitSource??null:null;
        const chat = getContext().chat;
        const depth = chat.length - 1 - chat.indexOf(message);
        const latestAssistant=chat.findLast(m=>!m.is_user&&!m.is_system)===message;
        const recent = depth < 2;
        let cached = plans.get(message);
        if (!cached || cached.source !== source || cached.avatar !== avatar || cached.stream !== stream || cached.gallery !== gallery || cached.portrait !== portrait || cached.witchcure !== witchcure || ((witchcure || portrait) && cached.depth !== depth) || cached.latestAssistant!==latestAssistant) {
            cached = { source, avatar, stream, gallery, witchcure, portrait, depth, latestAssistant, plan: makePlan(source, { stream, gallery, witchcure, portrait, recent, statusRecent: depth < 6, depth, latestAssistant, storyUpdates:portrait?.sceneState&&message.mes===source?story.read()?.views.get(message)?.cleanup??[]:[] }) };
            plans.set(message, cached);
        }
        if(portrait?.sceneState&&!cached.storyProjected){story.project(message,cached.plan);cached.storyProjected=true;}
        return cached.plan;
    }
    function eligible(message, avatar) {
        // ST opens an unfilled swipe slot before replacing message.mes. During
        // that interval mes still contains the previous reply, while native DOM
        // shows its waiting indicator. Do not replay the old reply over it.
        const pendingSwipe = Array.isArray(message?.swipes) && Number.isInteger(message.swipe_id)
            && message.swipe_id >= 0 && message.swipe_id >= message.swipes.length;
        return message && !pendingSwipe && !message.is_user && !message.is_system && enabled(avatar);
    }
    function intact(root, state) {
        return state && state.widgets.length > 0 && state.widgets.every(widget => root.contains(widget.host));
    }
    function restore(root, state) {
        state.widgets.forEach(w=>w.dispose?.());
        // Restore actual native DOM nodes, preserving their listeners and keeping
        // message.mes and display_text untouched, including message zero macros.
        if (intact(root, state)) {
            root.replaceChildren(...state.original.childNodes);
            afterRender(root.closest('.mes'));
        }
        delete root.dataset.displayBridgeOwned;
        states.delete(root);
    }
    function format(source, message, id) {
        // Protected source differs from the stored source. In the pinned ST
        // build this also prevents its first-message macro writeback branch.
        return getContext().messageFormatting(source, message.name, !!message.is_system, !!message.is_user, id,
            message.extra?.uses_system_ui ? { MESSAGE_ALLOW_SYSTEM_UI: true } : {}, false);
    }

    function renderRoot(root, ctx, avatar) {
        const element = root.closest('.mes');
        const id = Number(element?.getAttribute('mesid'));
        const message = Number.isInteger(id) && id >= 0 ? ctx.chat?.[id] : null;
        const previous = states.get(root);
        if (element?.querySelector('.edit_textarea') || root.tagName === 'TEXTAREA') return;
        if (!avatar || !eligible(message, avatar)) {
            if (previous) restore(root, previous);
            return;
        }
        const plan = planFor(message, avatar);
        if (!plan?.items.length) {
            if (previous) restore(root, previous);
            return;
        }
        const contextIdentity = chatScope(avatar);
        if (previous?.plan === plan && previous.contextIdentity === contextIdentity && intact(root, previous)) {
            previous.widgets.forEach(widget => widget.refresh());
            return;
        }
        const nativeHTML = root.innerHTML;
        const failed = errors.get(root);
        if (failed?.revision === plan.revision && failed.html === nativeHTML) return;
        try {
            if (previous && intact(root, previous) && previous.source !== displaySource(message)) return;
            const source = displaySource(message);
            const current = () => !stopped && character()?.avatar === avatar && enabled(avatar) && chatScope(avatar) === contextIdentity && getContext().chat[id] === message && displaySource(message) === source && states.get(root)?.plan === plan;
            const identity=lifecycle.ensure(character())?.id,chat=durableChat();
            const witchMode = chat?{
                read:()=>({mode:preferences.get(identity,chat)}),
                dispatch(action){if(!current())return false;const next=reduceAction(WITCH_MODE,this.read(),action);preferences.set(identity,chat,next.mode);rememberChat(avatar,chat);schedule();return true;},
            }:actionStore.bind(WITCH_MODE, contextIdentity, current);
            let presetState;
            const preset=profile(avatar).portraitSource;
            if(preset){
                const definition=portraitActions(preset),signature=JSON.stringify(preset),fallback=initialState(definition);
                const ephemeral=actionStore.bind(definition,contextIdentity,current);
                let temporaryPrevious=null;
                const record=()=>chat?preferences.getPreset(identity,chat,signature):null;
                const read=()=>{const saved=record()?.state;if(!saved)return chat?fallback:ephemeral.read();try{return reduceAction(definition,saved,'choose-'+saved.variant);}catch{return fallback;}};
                const write=(state,previous)=>{preferences.setPreset(identity,chat,{signature,state,previous});rememberChat(avatar,chat);schedule();};
                presetState={read,dispatch(action){if(!current())return false;const before=read(),next=reduceAction(definition,before,action);if(chat)write(next,before);else{temporaryPrevious=before;ephemeral.dispatch(action);}return true;},canUndo:()=>!!(chat?record()?.previous:temporaryPrevious),undo(){if(!current())return false;const old=record();if(chat&&old?.previous){write(old.previous,null);return true;}if(!chat&&temporaryPrevious){const previous=temporaryPrevious;ephemeral.dispatch('reset');for(const k of ['visual','image','dialogue','console',...(preset.sceneControls?.music?['music']:[])])if(previous[k]!==fallback[k])ephemeral.dispatch(k);ephemeral.dispatch('choose-'+previous.variant);if(preset.sceneControls?.music)ephemeral.dispatch('volume-'+previous.volume);temporaryPrevious=null;return true;}return false;}};
            }
            const rendered = renderPlan(plan, format(plan.source, message, id), {
                avatar,
                mediaFor:data=>({external:true,externalRoster:!!data.config.sceneState&&data.config.format?.details?.layers===true}),
                presetState,
                witchcure: witchFor(avatar)?.value,
                getWitchMode: () => witchMode.read().mode === 'auto' ? null : witchMode.read().mode,
                setWitchMode: mode => witchMode.dispatch(mode),
                stateFor: (definition, item, active) => actionStore.bind(definition, JSON.stringify([contextIdentity, objectId(message), source, item.type, item.start]), () => current() && active()),
            });
            let original;
            if (previous && intact(root, previous)) {
                // Visibility depends on chat length, even if this message's
                // source is unchanged. Preserve its native view across rebuilds.
                original = previous.original;
            } else {
                original = document.createDocumentFragment();
                original.append(...root.childNodes);
            }
            previous?.widgets.forEach(w=>w.dispose?.());
            root.replaceChildren(...rendered.container.childNodes);
            root.dataset.displayBridgeOwned = plan.revision;
            states.set(root, { original, plan, widgets: rendered.widgets, avatar, message, source: displaySource(message), contextIdentity });
            rendered.widgets.forEach(w=>w.refresh());
            errors.delete(root);
            afterRender(element);
        } catch (error) {
            errors.set(root, { revision: plan.revision, html: nativeHTML, message: error.message });
            if (previous) restore(root, previous);
        }
    }

    function observe() {
        if (stopped || !observedChat || !enabled(character()?.avatar)) return;
        observer.observe(observedChat, { childList: true, subtree: true, characterData: true });
    }
    function render() {
        frame = 0;
        if (stopped) return;
        ensureUI();
        const chat = document.getElementById('chat');
        if (chat !== observedChat) {
            observer?.disconnect();
            observedChat = chat;
            observer = new MutationObserver(schedule);
        }
        observer?.disconnect();
        try {
            for (const [root] of states) if (!root.isConnected || !chat?.contains(root)){states.get(root).widgets.forEach(w=>w.dispose?.());states.delete(root);}
            for (const [root] of errors) if (!root.isConnected || !chat?.contains(root)) errors.delete(root);
            const ctx = getContext();
            const avatar = character()?.avatar;
            for (const root of chat?.querySelectorAll('.mes[mesid] .mes_text') ?? []) renderRoot(root, ctx, avatar);
            refreshChatMusic(chat,avatar);
            refreshChatInformation(chat,avatar);
            chatDock.update({chat,key:JSON.stringify([chatScope(avatar),lifecycle.ensure(character())?.id]),music:chatMusic.host.isConnected?chatMusic.host:null,information:chatInformation.host.isConnected?chatInformation.host:null,stateEnabled:!!chat&&enabled(avatar)&&profile(avatar).adapters?.includes('portrait-dialogue')&&!!profile(avatar).portraitSource?.sceneState,generating:generationBusy});
            sceneAudio.sweep();
            imageViewer.refresh();
            updateUI();
        } finally { observe(); }
        window.dispatchEvent(new CustomEvent('display-bridge:rendered'));
    }
    function schedule() {
        if (!stopped && !frame) frame = requestAnimationFrame(render);
    }

    function refreshChatMusic(chat,avatar){
        const preset=profile(avatar).portraitSource,music=preset?.sceneControls?.music;
        if(!chat||!enabled(avatar)||!profile(avatar).adapters?.includes('portrait-dialogue')||!music){chatMusic.clear();return;}
        // Keep the previous completed scene throughout normal generation,
        // pending swipe slots, streaming and failed attempts.
        if(generationBusy||(getContext().streamingProcessor&&getContext().streamingProcessor.isFinished!==true))return;
        const ctx=getContext(),message=ctx.chat?.findLast(m=>eligible(m,avatar)&&planFor(m,avatar)?.items.some(i=>i.presentation==='scene'));
        const item=message&&planFor(message,avatar)?.items.findLast(i=>i.presentation==='scene');
        if(!item){chatMusic.clear();return;}
        if(item.snapshotIssue&&chatMusic.host.isConnected)return;
        const key=JSON.stringify([chatScope(avatar),lifecycle.ensure(character())?.id]);
        const identity=lifecycle.ensure(character())?.id,chatId=durableChat(),signature=JSON.stringify(preset);
        const def=portraitActions(preset),fallback=initialState(def),read=()=>chatId?preferences.getPreset(identity,chatId,signature)?.state??fallback:fallback;
        const valid=()=>!stopped&&character()?.avatar===avatar&&enabled(avatar)&&profile(avatar).portraitSource===preset&&JSON.stringify([chatScope(avatar),lifecycle.ensure(character())?.id])===key;
        if(!chatMusic.host.isConnected)chat.after(chatMusic.host);
        const current=story.read(),track=preset.sceneState?.track&&current&&!current.issue?current.values[preset.sceneState.track]:item.sceneSnapshot?.track;
        chatMusic.update({avatar,music,track,key,valid,volume:read().volume/10,onVolume:value=>{if(!valid()||!chatId)return;const before=read(),volume=Math.round(value*10);if(before.volume===volume)return;preferences.setPreset(identity,chatId,{signature,state:reduceAction(def,before,'volume-'+volume),previous:before});schedule();}});
    }
    function refreshChatInformation(chat,avatar){
        const config=profile(avatar).portraitSource;
        if(!chat||!enabled(avatar)||!profile(avatar).adapters?.includes('portrait-dialogue')||!config?.sceneState||!config.sceneControls?.roster||config.format?.details?.layers!==true){chatInformation.clear();return;}
        const key=JSON.stringify([chatScope(avatar),lifecycle.ensure(character())?.id]);
        const current=story.read();
        // An in-flight output is not a new committed state. Its valid prefix
        // still identifies the active swipe branch; do not show future totals.
        const snapshot=current?.values?storySnapshot(current.values,config.sceneState):{};
        const fallback=initialState(portraitActions(config)),identity=lifecycle.ensure(character())?.id,chatId=durableChat(),signature=JSON.stringify(config);
        const state={read:()=>({...((chatId&&preferences.getPreset(identity,chatId,signature)?.state)||fallback),visual:true,image:true})};
        if(!chatInformation.host.isConnected)chat.after(chatInformation.host);
        chatInformation.update({key,config,snapshot,issue:generationBusy?null:current?.issue,avatar,state});
    }

    function getAssetReplay({ avatar, messageId, root }) {
        const selected = character();
        if (stopped || selected?.avatar !== avatar) return null;
        const message = getContext().chat?.[messageId];
        if (!eligible(message, avatar)) return null;
        const plan = planFor(message, avatar);
        if (!plan?.items.length || errors.get(root)?.revision === plan.revision) return null;
        const state = states.get(root);
        return { ready: state?.plan === plan && intact(root, state), source: plan.source, revision: plan.revision };
    }

    function setEnabled(avatar, value) {
        if (typeof avatar !== 'string' || !avatar) return;
        targetCharacter(avatar);
        if(!value){sceneAudio.stop();story.switched();}
        updateProfile(avatar, { enabled: !!value, adapters: profile(avatar).adapters ?? [] });
        errors.clear();
        saveSettings();
        render();
        window.dispatchEvent(new CustomEvent('display-bridge:ownership-changed', { detail: { avatar } }));
    }

    function setAdapterEnabled(avatar, adapter, value) {
        if (typeof avatar !== 'string' || !avatar) return;
        targetCharacter(avatar);
        const adapters = new Set(profile(avatar).adapters ?? []);
        if (value) adapters.add(adapter); else adapters.delete(adapter);
        updateProfile(avatar, { adapters: [...adapters] });
        errors.clear(); saveSettings(); render();
        window.dispatchEvent(new CustomEvent('display-bridge:ownership-changed', { detail: { avatar } }));
    }
    function setStreamEnabled(avatar, value) { setAdapterEnabled(avatar, 'media-panel', value); }
    function setGalleryEnabled(avatar, value) { setAdapterEnabled(avatar, 'gallery', value); }
    function setWitchcureEnabled(avatar, value) { setAdapterEnabled(avatar, 'witchcure', value); }
    function attachWitchcure(avatar, card) {
        if (!avatar || character()?.avatar !== avatar) throw new Error('Character changed. Select the intended character before attaching templates.');
        const source = witchcureSource(card);
        if (!source) throw new Error('This JSON does not contain the supported Witchcure roster/report templates.');
        compileWitchcure(source, cssParser); // Validate before saving any source.
        const oldPortrait=profile(avatar).portraitSource;
        rememberPanels(avatar);
        if(oldPortrait&&portrait)preferences.migratePreset(lifecycle.ensure(targetCharacter(avatar)).id,JSON.stringify(oldPortrait),JSON.stringify(portrait.source),portrait.source.variants.map(v=>v.id),portrait.source.appearance);
        updateProfile(avatar, { witchcureSource: source, sourceOrigin:sourceOrigin({format:'attached-json'}) });
        compiledSources.delete(avatar); saveSettings(); render();
    }

    function targetCharacter(avatar) {
        if (typeof avatar !== 'string' || !avatar) throw new Error('Missing target character.');
        const matches = (getContext().characters ?? []).filter(item => item.avatar === avatar);
        if (matches.length !== 1) throw new Error('Imported character identity is missing or ambiguous.');
        if(!lifecycle.ensure(matches[0])?.active) throw new Error('This character was deleted or renamed. Reload the character list.');
        return matches[0];
    }
    function activeRules(target) {
        let stored = {};
        try { if(target.data?.extensions?.regex_scripts == null) stored = JSON.parse(target.json_data || '{}'); } catch { /* Use live metadata if available. */ }
        const local = target.data?.extensions?.regex_scripts ?? stored.data?.extensions?.regex_scripts;
        return [...(Array.isArray(extensionSettings.regex) ? extensionSettings.regex : []), ...(Array.isArray(local) ? local : [])];
    }
    function applyDefinition(avatar, definition, report) {
        targetCharacter(avatar);
        const validated = validateProfile(definition, cssParser);
        const witch = validated.adapters.find(item => item.id === 'witchcure');
        const portrait=validated.adapters.find(item=>item.id==='portrait-dialogue');
        const oldPortrait=profile(avatar).portraitSource;
        rememberPanels(avatar);
        if(oldPortrait&&portrait)preferences.migratePreset(lifecycle.ensure(targetCharacter(avatar)).id,JSON.stringify(oldPortrait),JSON.stringify(portrait.source),portrait.source.variants.map(v=>v.id),portrait.source.appearance);
        updateProfile(avatar, { enabled:true, adapters:validated.adapters.map(item=>item.id),
            ...(witch ? {witchcureSource:witch.source} : {}), portraitSource:portrait?.source??null, pendingProfile:null,
            importReport:{...report,status:'applied'}, sourceOrigin:sourceOrigin(report?.origin), definitionSchemaVersion:1 });
        compiledSources.delete(avatar); errors.clear(); saveSettings(); schedule();
        window.dispatchEvent(new CustomEvent('display-bridge:ownership-changed', {detail:{avatar}}));
    }
    function receiveImport(envelope) {
        if (stopped) throw new Error('Display Bridge is stopped.');
        if (envelope?.handoffVersion !== 1 || typeof envelope.importId !== 'string' || !envelope.importId || envelope.importId.length > 200) throw new Error('Unsupported importer handoff.');
        const avatar = envelope.avatar, target = targetCharacter(avatar);
        const receiptKey = JSON.stringify([avatar,envelope.importId]);
        const receipts = settings().importReceipts;
        if (Object.hasOwn(receipts,receiptKey)) return JSON.parse(JSON.stringify(receipts[receiptKey]));
        const acknowledge = report => {
            receipts[receiptKey] = JSON.parse(JSON.stringify(report));
            const keys = Object.keys(receipts); if (keys.length > 100) delete receipts[keys[0]];
            saveSettings(); return JSON.parse(JSON.stringify(report));
        };
        let result;
        try { result = discoverProfile(envelope.source,cssParser); }
        catch(error) { result = {profile:null,notes:[error.message],rejected:true}; }
        const images = envelope.images ?? {};
        const report = {importId:envelope.importId,status:result.rejected?'rejected':result.notRequested?'not-requested':'unsupported',
            origin:sourceOrigin(envelope.source?.origin), discovery:result.discovery ?? null,
            adapters:result.profile?.adapters.map(item=>item.id) ?? [], notes:result.notes,
            images:{status:images.status==='mapped'?'mapped':'incomplete',mapped:Number.isInteger(images.mapped)&&images.mapped>=0?images.mapped:0,
                issues:Array.isArray(images.issues)?images.issues.slice(0,30).map(x=>String(x).slice(0,300)):[]} };
        if (result.profile) {
            const conflicts = profileConflicts(result.profile,activeRules(target));
            if (conflicts.length) report.notes.push(`Existing regex rules may also render these panels: ${conflicts.join(', ')}. Review them before enabling the profile.`);
            const configured = Object.hasOwn(profile(avatar),'enabled') || (profile(avatar).adapters?.length ?? 0)>0 || !!profile(avatar).witchcureSource;
            if (configured || conflicts.length || result.requiresReview) {
                report.status = 'review';
                if(result.requiresReview)report.notes.push('Scene assembly has unresolved dependencies. Review feature coverage before applying this partial profile.');
                if (configured) report.notes.push('Existing character options were preserved. Apply the imported profile to replace its panel selections.');
                report.preservePortraitMappings=!!profile(avatar).portraitSource&&result.profile.adapters.some(a=>a.id==='portrait-dialogue'&&a.source.format.kind===profile(avatar).portraitSource.format.kind);
                if(report.preservePortraitMappings)report.notes.push('Existing portrait mappings and appearance options will be kept on apply unless you clear the keep-mappings checkbox.');
                updateProfile(avatar,{pendingProfile:result.profile,importReport:report});
            } else { applyDefinition(avatar,result.profile,report); return acknowledge(profile(avatar).importReport); }
        } else updateProfile(avatar,{pendingProfile:null,importReport:report});
        saveSettings(); schedule(); return acknowledge(report);
    }
    function applyPending(avatar,{preserveMappings=true}={}) {
        targetCharacter(avatar);
        const current = profile(avatar);
        if (!current.pendingProfile) throw new Error('No imported profile is awaiting review.');
        const pending=JSON.parse(JSON.stringify(current.pendingProfile));
        if(preserveMappings&&current.importReport?.preservePortraitMappings){const portrait=pending.adapters.find(a=>a.id==='portrait-dialogue');if(portrait){portrait.source=preservePortraitMappings(portrait.source,current.portraitSource);portrait.version=portraitVersion(portrait.source);}}
        applyDefinition(avatar,pending,current.importReport);
    }
    function importProfile(avatar, definition) {
        targetCharacter(avatar);
        const validated = validateProfile(definition,cssParser);
        const target = targetCharacter(avatar);
        const conflicts = profileConflicts(validated,activeRules(target));
        updateProfile(avatar,{pendingProfile:validated,importReport:{status:'review',adapters:validated.adapters.map(item=>item.id),
            origin:sourceOrigin({format:'profile'}),
            notes:conflicts.length?[`Existing regex rules may overlap: ${conflicts.join(', ')}.`]:['Profile validated. Apply it to replace this character’s panel selections.']}});
        saveSettings(); schedule();
    }
    function exportProfile(avatar) {
        const target = targetCharacter(avatar);
        return profileFromSettings({...profile(avatar),witchcureSource:profile(avatar).witchcureSource ?? witchcureSource(target)},cssParser);
    }
    function exportCardProfile(avatar) {
        targetCharacter(avatar);
        return profile(avatar).adapters?.length ? exportProfile(avatar) : null;
    }

    // A single bounded undo point, not a copy of chats, importer state or rules.
    function rememberPanels(avatar) {
        const current=profile(avatar), previousPanels={};
        for(const key of ['enabled','adapters','witchcureSource','portraitSource','definitionSchemaVersion','sourceOrigin']) {
            if(Object.hasOwn(current,key)) previousPanels[key]=JSON.parse(JSON.stringify(current[key]));
        }
        updateProfile(avatar,{previousPanels});
    }
    function restorePanels(avatar) {
        requireCurrent(avatar);
        const previous=profile(avatar).previousPanels;
        if(!previous) throw new Error('No previous panel settings were saved.');
        if(previous.portraitSource)validatePortraitPreset(previous.portraitSource);
        if(previous.witchcureSource) compileWitchcure(previous.witchcureSource,cssParser);
        const next={...profile(avatar)};
        if(next.portraitSource&&previous.portraitSource)preferences.migratePreset(lifecycle.ensure(character()).id,JSON.stringify(next.portraitSource),JSON.stringify(previous.portraitSource),previous.portraitSource.variants.map(v=>v.id),previous.portraitSource.appearance);
        for(const key of ['enabled','adapters','witchcureSource','portraitSource','definitionSchemaVersion','sourceOrigin','previousPanels']) delete next[key];
        Object.assign(next,JSON.parse(JSON.stringify(previous)),{pendingProfile:null,importReport:{...next.importReport,status:'restored-previous'}});
        Object.defineProperty(settings().profiles,avatar,{value:next,configurable:true,enumerable:true,writable:true});
        compiledSources.delete(avatar);errors.clear();saveSettings();render();
        window.dispatchEvent(new CustomEvent('display-bridge:ownership-changed',{detail:{avatar}}));
    }
    function resetPreferences(avatar,all=false) {requireCurrent(avatar);const identity=lifecycle.ensure(character()).id;preferences.reset(identity,all?undefined:durableChat()??'');actionStore.clear();render();}
    function exportPreferences(avatar) {requireCurrent(avatar);return preferences.exportFor(lifecycle.ensure(character()).id);}
    function importPreferences(avatar,input) {requireCurrent(avatar);preferences.importFor(lifecycle.ensure(character()).id,input);actionStore.clear();render();}
    function captureRecovery(avatar) {
        requireCurrent(avatar);const identity=lifecycle.ensure(character());
        const receipts=Object.fromEntries(Object.entries(settings().importReceipts).filter(([k])=>{try{return JSON.parse(k)[0]===avatar;}catch{return false;}}));
        return JSON.parse(JSON.stringify({profile:profile(avatar),identity,receipts,preferences:preferences.exportFor(identity.id)}));
    }
    function restoreRecovery(avatar,snapshot) {
        requireCurrent(avatar);
        if(!snapshot?.identity?.id||!snapshot.preferences)throw Error('Invalid Display Bridge recovery snapshot.');
        if(snapshot.profile?.adapters?.length)profileFromSettings(snapshot.profile,cssParser);
        retireCharacter(avatar,'Reviewed recovery restore');
        Object.defineProperty(settings().lifecycle.entries,avatar,{value:{id:snapshot.identity.id,created:character().create_date},enumerable:true,writable:true,configurable:true});
        Object.defineProperty(settings().profiles,avatar,{value:JSON.parse(JSON.stringify(snapshot.profile)),enumerable:true,writable:true,configurable:true});
        Object.assign(settings().importReceipts,JSON.parse(JSON.stringify(snapshot.receipts)));
        preferences.importFor(snapshot.identity.id,snapshot.preferences);saveSettings();render();
    }
    function requireCurrent(avatar) {
        targetCharacter(avatar);
        if(character()?.avatar!==avatar) throw new Error('Character changed. Select the intended character and try again.');
    }
    function compatibility() {
        const selected=character(), avatar=selected?.avatar;
        if(!avatar) return {reportVersion:1,avatar:null};
        lifecycle.ensure(selected);
        const current=profile(avatar), imported=current.importReport;
        let provider={status:'not connected'};
        if(window.v3sprites?.api) {
            provider={status:'older provider'};
            if(window.v3sprites.api.compatibilityApiVersion===1) {
                try {provider=window.v3sprites.api.getCompatibility({avatar});}
                catch {provider={status:'provider error'};}
            }
        }
        const witch=witchFor(avatar,true), runtime=diagnostics();
        const panels=Object.entries(panelNames).map(([id,name])=>{
            const chosen=current.adapters?.includes(id), ready=id==='portrait-dialogue'?!!current.portraitSource:id!=='witchcure'||!!witch?.value;
            return {id,name,state:!chosen?'off':!ready?'missing or incompatible':!enabled(avatar)?'bridge off':'ready',
                reason:id==='witchcure'?(witch?.error??`Templates available: roster, report${witch.value.status?', status':''}${witch.value.map?', map':''}${witch.value.portraits?.length?`, ${witch.value.portraits.length} portraits`:''}.${witch.value.autoRoster?' Automatic roster placement enabled.':''}`):'Reviewed built-in layout. Matching message text is required.'};
        });
        const imageIssues=[];
        for(const [root,state] of states) if(state.avatar===avatar&&intact(root,state)) {
            for(const widget of state.widgets.filter(x=>!x.host.hidden)) for(const item of widget.imageIssues?.() ?? []) {
                const clean={reference:String(item.reference).slice(0,160),status:String(item.status).slice(0,60)};
                if(!imageIssues.some(x=>x.reference===clean.reference&&x.status===clean.status)&&imageIssues.length<100) imageIssues.push(clean);
            }
        }
        const definitions=(current.pendingProfile?.adapters ?? []).map(x=>({id:x.id,version:x.version,...(x.id==='portrait-dialogue'?{source:x.source}:{})}));
        for(const id of current.adapters??[]) if(!definitions.some(x=>x.id===id)) definitions.push({id,version:id==='portrait-dialogue'?portraitVersion(current.portraitSource):1,...(id==='portrait-dialogue'?{source:current.portraitSource}:{})});
        return {reportVersion:1,avatar,character:String(selected.name).slice(0,120),enabled:enabled(avatar),
            source:sourceOrigin(provider.origin ?? imported?.origin ?? current.sourceOrigin),
            importStatus:imported?.status??'not recorded',discovery:(!provider.delivery || provider.delivery.importId===imported?.importId)?imported?.discovery??null:null,panels,
            actions:['Stream: display and disclosure controls. Gallery: open posts, browse comments and return to the list.',
                'Witchcure: switch roster/report, open character details and map regions. Status values are read from message text.',
                'Portrait/dialogue: appearance selection, independent visibility controls, console, reset and undo. Choices are saved per chat; world/story variables are not changed.',
                'Presentation actions do not change story values. A v8 scene-state profile can separately save reviewed updates and send declared facts in model context. Arbitrary Lua and STscript are not executed.'],
            provider,delivery:provider.delivery??null,imageIssues,runtime,conflicts:profileConflicts({adapters:definitions},activeRules(selected)),
            notes:(imported?.notes??[]).concat(imported?.images?.issues??[],current.portraitSource?.sceneControls?[current.portraitSource.sceneState?'Scene state uses reviewed typed updates. Source conversion coverage is listed above when available; arbitrary triggers, prompt macros, randomness and history edits remain unsupported.':'Scene information uses explicit per-scene snapshots; Risu variable updates and prompt context are not translated.',...(current.portraitSource.sceneControls.music?['Chat music requires local assets and an initial Play click. It loops by default, continues during generation and follows completed scene/state track selections.']:[])]:[]),pending:!!current.pendingProfile,
            sceneState:current.portraitSource?.sceneState?{configured:true,status:!enabled(avatar)?'off':story.read()?.issue?'needs review':'ready',issue:story.read()?.issue??null,modelContext:!!current.portraitSource.sceneState.context,startup:!!current.portraitSource.sceneState.startup}:null,
            canRestore:!!current.previousPanels,recoveryAvailable:window.v3sprites?.recovery?.version===1,
            persistence:{chat:durableChat(),mode:preferences.get(lifecycle.ensure(selected)?.id,durableChat()),retiredProfiles:settings().retired?.length??0}};
    }
    async function recover(action,avatar,report) {
        requireCurrent(avatar);
        if(action==='export') {
            const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
            const link=document.createElement('a');link.href=url;link.download='display-bridge-compatibility.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
            return 'Compatibility report exported.';
        }
        if(action==='restore') {restorePanels(avatar);return 'Previous panel settings restored.';}
        if(action==='reset-chat'){resetPreferences(avatar);return 'This chat’s presentation preference was reset.';}
        if(action==='reset-card'){resetPreferences(avatar,true);return 'This character’s presentation preferences were reset.';}
        if(action==='export-preferences'){
            const url=URL.createObjectURL(new Blob([JSON.stringify(exportPreferences(avatar),null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='display-bridge-preferences.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return 'Preferences exported (includes chat names, no messages).';
        }
        if(action==='import-preferences'){
            const identity=lifecycle.ensure(character()).id;
            const input=document.createElement('input');input.type='file';input.accept='.json';
            input.addEventListener('change',async()=>{try{const file=input.files?.[0];if(!file)return;if(file.size>192000000)throw new Error('Preference file is too large.');const value=JSON.parse(await file.text());requireCurrent(avatar);if(lifecycle.ensure(character()).id!==identity)throw new Error('Character was replaced. Select the intended card and try again.');importPreferences(avatar,value);}catch(error){window.toastr?.error?.(error.message,'Display Bridge',{escapeHtml:true});}},{once:true});input.click();return 'Choose a preference file for this character.';
        }
        if(action==='rebuild') {
            for(const [root,state] of states) restore(root,state);
            errors.clear();plans=new WeakMap();compiledSources.clear();render();return 'Panels rebuilt from current message text.';
        }
        const api=window.v3sprites?.recovery;
        const bind=action.startsWith('bind-pending:');
        if(api?.version!==1 || (!['attach','rescan','resync','retry','replace','undo','backup','keep','repair'].includes(action)&&!bind)) throw new Error('Install the matching V3 Asset Sprites release for this recovery action.');
        const result=await (bind?api.bindPending({avatar,importId:action.slice('bind-pending:'.length)}):api[action]({avatar}));
        schedule();
        return ['attach','replace','repair'].includes(action)?'Choose the original card and review the source confirmation.':action==='retry'?'UI delivery retried. Check the updated result.':result===null?'Operation cancelled or failed; see the V3 notification.':'Recovery operation finished. Check the updated report.';
    }

    function diagnostics() {
        const selected = character();
        const provider = window.v3sprites?.api;
        const counts = { mounted: 0, unresolvedImages: 0, incomplete: 0, unsupported: 0 };
        for (const [root, state] of states) {
            if (!intact(root, state)) continue;
            counts.mounted += state.widgets.filter(x => !x.host.hidden).length;
            counts.unresolvedImages += state.widgets.filter(x=>!x.host.hidden).reduce((count, x) => count + (x.missingImages?.() ?? (x.imageStatus() !== 'resolved' ? 1 : 0)), 0);
        }
        if (selected && enabled(selected.avatar)) {
            for (const message of getContext().chat ?? []) {
                if (!eligible(message, selected.avatar)) continue;
                const plan = planFor(message, selected.avatar);
                counts.incomplete += plan?.incomplete ?? 0;
                counts.unsupported += plan?.unsupported ?? 0;
            }
        }
        return {
            character: selected?.avatar ?? null,
            enabled: !!selected && enabled(selected.avatar),
            provider: !provider ? 'not connected' : provider.apiVersion === 1 ? 'connected' : 'unsupported version',
            ...counts,
            witchcurePanels: selected && witchFor(selected.avatar)?.value ? ['roster', 'report', ...['status','map'].filter(kind => witchFor(selected.avatar).value[kind])] : [],
            witchcure: selected ? witchFor(selected.avatar)?.error ?? (witchFor(selected.avatar)?.value ? 'ready' : 'off') : 'off',
            conflicts: [...errors.values()].map(x => x.message),
        };
    }

    function ensureUI() {
        if (controls?.panel.isConnected) return;
        const container = document.getElementById('extensions_settings2') ?? document.getElementById('extensions_settings');
        if (!container) return;
        const panel = document.createElement('details');
        panel.id = 'display-bridge-settings';
        const summary = document.createElement('summary'); summary.textContent = 'Display Bridge';
        // Share ST's header styling without also invoking its drawer JS.
        summary.className = 'standoutHeader inline-drawer-header';
        const chevron = document.createElement('span');
        chevron.className = 'inline-drawer-icon fa-solid fa-circle-chevron-down';
        chevron.setAttribute('aria-hidden','true'); summary.append(chevron);
        const body = document.createElement('div'); body.className = 'display-bridge-settings-body';
        const current = document.createElement('p');
        const label = document.createElement('label');
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox';
        label.append(checkbox, document.createTextNode(' Enable Display Bridge for this character'));
        checkbox.addEventListener('change', () => setEnabled(character()?.avatar, checkbox.checked));
        const compactLabel=document.createElement('label'),compactCheckbox=document.createElement('input');compactCheckbox.type='checkbox';compactLabel.append(compactCheckbox,document.createTextNode(' Compact ordinary images: hover preview and click to expand (trial)'));compactCheckbox.addEventListener('change',()=>{settings().compactImages=compactCheckbox.checked;saveSettings();imageViewer.refresh();});
        const note = document.createElement('p');
        note.textContent = 'Choose the panels this character uses. All are optional and saved separately for each character. Switching a panel off restores its ordinary display.';
        const streamLabel = document.createElement('label');
        const streamCheckbox = document.createElement('input'); streamCheckbox.type = 'checkbox';
        streamLabel.append(streamCheckbox, document.createTextNode(' Stream window'));
        streamCheckbox.addEventListener('change', () => setStreamEnabled(character()?.avatar, streamCheckbox.checked));
        const galleryLabel = document.createElement('label');
        const galleryCheckbox = document.createElement('input'); galleryCheckbox.type = 'checkbox';
        galleryLabel.append(galleryCheckbox, document.createTextNode(' Streamer gallery'));
        galleryCheckbox.addEventListener('change', () => setGalleryEnabled(character()?.avatar, galleryCheckbox.checked));
        const witchLabel = document.createElement('label');
        const witchCheckbox = document.createElement('input'); witchCheckbox.type = 'checkbox';
        witchLabel.append(witchCheckbox, document.createTextNode(' Witchcure panels (roster, report, status, map)'));
        witchCheckbox.addEventListener('change', () => setWitchcureEnabled(character()?.avatar, witchCheckbox.checked));
        const portraitLabel=document.createElement('label'),portraitCheckbox=document.createElement('input');portraitCheckbox.type='checkbox';portraitLabel.append(portraitCheckbox,document.createTextNode(' Portrait and dialogue preset'));portraitCheckbox.addEventListener('change',()=>setAdapterEnabled(character()?.avatar,'portrait-dialogue',portraitCheckbox.checked));
        const setupPreset=document.createElement('button');setupPreset.type='button';setupPreset.className='menu_button';setupPreset.textContent='Set up portrait and dialogue';
        const editorSlot=document.createElement('div');
        setupPreset.addEventListener('click',()=>{const target=character();if(!target)return;const avatar=target.avatar,identity=lifecycle.ensure(target).id;
            let openingSource=JSON.stringify(profile(avatar).portraitSource),openingPending=JSON.stringify(profile(avatar).pendingProfile);
            editorSlot.replaceChildren(createPresetEditor({source:profile(avatar).portraitSource??undefined,avatar,sample:displaySource(getContext().chat?.findLast(m=>!m.is_user&&!m.is_system)??{})??'',close:()=>editorSlot.replaceChildren(),review(source){requireCurrent(avatar);if(lifecycle.ensure(character()).id!==identity)throw Error('Character was replaced. Open setup again.');if(JSON.stringify(profile(avatar).portraitSource)!==openingSource||JSON.stringify(profile(avatar).pendingProfile)!==openingPending)throw Error('This profile changed while the editor was open. Close and reopen setup.');const adapters=profile(avatar).adapters?.length?exportProfile(avatar).adapters.filter(a=>a.id!=='portrait-dialogue'):[];importProfile(avatar,{kind:'display-bridge-profile',schemaVersion:1,adapters:[...adapters,{id:'portrait-dialogue',version:portraitVersion(source),source}]});openingPending=JSON.stringify(profile(avatar).pendingProfile);}}));});
        const attach = document.createElement('button'); attach.type = 'button'; attach.className = 'menu_button'; attach.textContent = 'Attach Witchcure JSON';
        const attachStatus = document.createElement('p'); attachStatus.setAttribute('aria-live', 'polite');
        attach.addEventListener('click', () => {
            const avatar = character()?.avatar;
            if (!avatar) return;
            const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
            input.addEventListener('change', async () => {
                try {
                    if (!input.files[0]) return;
                    attachWitchcure(avatar, JSON.parse(await input.files[0].text()));
                    attachStatus.textContent = 'Templates attached to this character. Enable the Witchcure checkbox to use them.';
                } catch (error) { attachStatus.textContent = error.message; }
            }, { once: true });
            input.click();
        });
        const importButton = document.createElement('button'); importButton.type='button'; importButton.className='menu_button'; importButton.textContent='Load UI profile';
        importButton.addEventListener('click',()=>{
            const avatar=character()?.avatar; if (!avatar) return;
            const input=document.createElement('input'); input.type='file'; input.accept='.json,application/json';
            input.addEventListener('change',async()=>{
                try {
                    const file=input.files?.[0]; if (!file) return;
                    if (file.size>2000000) throw new Error('Profile file is too large.');
                    if (character()?.avatar!==avatar) throw new Error('Character changed; select the intended character first.');
                    const value=JSON.parse(await file.text());
                    if (character()?.avatar!==avatar) throw new Error('Character changed; select the intended character first.');
                    importProfile(avatar,value); attachStatus.textContent='UI profile loaded for review.';
                } catch(error) {attachStatus.textContent=error.message;}
            },{once:true}); input.click();
        });
        const exportButton=document.createElement('button'); exportButton.type='button'; exportButton.className='menu_button'; exportButton.textContent='Export UI profile';
        exportButton.addEventListener('click',()=>{
            try {
                const definition=exportProfile(character()?.avatar);
                const url=URL.createObjectURL(new Blob([JSON.stringify(definition,null,2)],{type:'application/json'}));
                const link=document.createElement('a'); link.href=url; link.download='display-bridge-profile.json'; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
                attachStatus.textContent='Profile exported without chat state or image files.';
            } catch(error) {attachStatus.textContent=error.message;}
        });
        const importSummary=document.createElement('p'); importSummary.setAttribute('aria-live','polite');
        const keepMappingsLabel=document.createElement('label'),keepMappings=document.createElement('input');keepMappings.type='checkbox';keepMappings.checked=true;keepMappingsLabel.append(keepMappings,document.createTextNode(' Keep existing portrait mappings and appearance choices'));
        const applyButton=document.createElement('button'); applyButton.type='button'; applyButton.className='menu_button'; applyButton.textContent='Apply imported UI profile';
        applyButton.addEventListener('click',()=>{try{const avatar=controls.avatar;requireCurrent(avatar);applyPending(avatar,{preserveMappings:keepMappings.checked});}catch(error){attachStatus.textContent=error.message;}});
        const dismissButton=document.createElement('button'); dismissButton.type='button'; dismissButton.className='menu_button'; dismissButton.textContent='Keep current panels';
        dismissButton.addEventListener('click',()=>{try{const avatar=controls.avatar;requireCurrent(avatar);updateProfile(avatar,{pendingProfile:null,importReport:{...profile(avatar).importReport,status:'kept-current'}});saveSettings();schedule();}catch(error){attachStatus.textContent=error.message;}});
        const previewButton = document.createElement('button'); previewButton.type = 'button'; previewButton.className = 'menu_button'; previewButton.textContent = 'Preview sample panel';
        const preview = document.createElement('div');
        previewButton.addEventListener('click', () => {
            if (preview.childNodes.length) { preview.replaceChildren(); previewButton.textContent = 'Preview sample panel'; return; }
            const plan = makePlan(SAMPLE);
            preview.append(createMediaPanel(plan.items[0], { resolver: () => ({ status: 'missing' }) }).host);
            previewButton.textContent = 'Close preview';
        });
        const report = document.createElement('p'); report.setAttribute('aria-live', 'polite');
        const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'menu_button'; retry.textContent = 'Refresh panels';
        retry.addEventListener('click', () => { errors.clear(); schedule(); });
        const compatibilityView=createCompatibilityView(recover);
        const storyBox=document.createElement('details'),storyTitle=document.createElement('summary'),storyStatus=document.createElement('p'),storyChoice=document.createElement('select'),storyButton=document.createElement('button');
        storyTitle.textContent='Conversation state';storyChoice.className='text_pole';storyChoice.setAttribute('aria-label','Starting branch');storyButton.type='button';storyButton.className='menu_button';storyButton.textContent='Initialize / rebuild scene state';
        const storyHelp=document.createElement('p');storyHelp.textContent='Replays the saved active messages using the reviewed profile. A starting branch replaces the startup marker in a fresh chat. Declared context fields are sent with future requests; this does not execute Risu scripts.';
        storyButton.addEventListener('click',async()=>{storyButton.disabled=true;try{await story.rebuild(storyChoice.value||null);storyStatus.textContent='State saved.';}catch(e){storyStatus.textContent=e.message;}finally{storyButton.disabled=false;}});
        storyBox.append(storyTitle,storyHelp,storyChoice,storyButton,storyStatus);
        body.append(current, label, compactLabel, note, streamLabel, witchLabel, galleryLabel, portraitLabel, setupPreset, editorSlot, attach, importButton, exportButton, attachStatus, importSummary, keepMappingsLabel, applyButton, dismissButton, compatibilityView.host, previewButton, retry, report, preview);
        body.append(storyBox);
        panel.addEventListener('toggle',()=>{if(panel.open&&!stopped)updateUI();});
        panel.append(summary, body); container.append(panel);
        controls = { panel, checkbox, compactCheckbox, portraitCheckbox, setupPreset, editorSlot, streamCheckbox, witchCheckbox, galleryCheckbox, attach, importButton, exportButton, importSummary, keepMappingsLabel, keepMappings, applyButton, dismissButton, current, report, compatibilityView,storyBox,storyChoice,storyStatus };
    }
    function updateUI() {
        if (!controls) return;
        const selected = character();
        if(controls.avatar!==selected?.avatar)controls.editorSlot.replaceChildren();
        controls.avatar=selected?.avatar;
        controls.portraitCheckbox.disabled=!selected||!profile(selected.avatar).portraitSource;
        controls.portraitCheckbox.checked=!!selected&&profile(selected.avatar).adapters?.includes('portrait-dialogue');
        controls.setupPreset.disabled=!selected;
        controls.compactCheckbox.checked=settings().compactImages===true;
        controls.checkbox.disabled = !selected;
        controls.checkbox.checked = !!selected && enabled(selected.avatar);
        controls.streamCheckbox.disabled = !selected;
        controls.streamCheckbox.checked = !!selected && profile(selected.avatar).adapters?.includes('media-panel');
        controls.witchCheckbox.disabled = !selected;
        controls.witchCheckbox.checked = !!selected && profile(selected.avatar).adapters?.includes('witchcure');
        controls.galleryCheckbox.disabled = !selected;
        controls.galleryCheckbox.checked = !!selected && profile(selected.avatar).adapters?.includes('gallery');
        controls.attach.disabled = !selected;
        controls.importButton.disabled = !selected; controls.exportButton.disabled = !selected;
        const imported = selected ? profile(selected.avatar).importReport : null;
        const pending = !!selected && !!profile(selected.avatar).pendingProfile;
        controls.applyButton.hidden = !pending; controls.dismissButton.hidden = !pending;
        const importText = imported ? `UI profile: ${imported.status}. Imported panels: ${(imported.adapters ?? []).map(id=>panelNames[id]??id).join(', ') || 'none recognized'}. See compatibility details below.` : '';
        if (controls.importSummary.textContent !== importText) controls.importSummary.textContent = importText;
        const current = selected ? `Character: ${selected.name}` : 'Select a single-character chat to enable panels.';
        if (controls.current.textContent !== current) controls.current.textContent = current;
        controls.keepMappingsLabel.hidden=!pending||!imported?.preservePortraitMappings;
        const mappingReceipt=JSON.stringify([controls.avatar,imported?.importId]);if(controls.mappingReceipt!==mappingReceipt){controls.keepMappings.checked=true;controls.mappingReceipt=mappingReceipt;}
        // Reports inspect all assets/rules; keep them out of ordinary chat updates.
        // Opening settings computes a fresh report, including external edits.
        if(!controls.panel.open)return;
        const stateConfig=selected?profile(selected.avatar).portraitSource?.sceneState:null;
        controls.storyBox.hidden=!stateConfig;
        if(stateConfig){const signature=JSON.stringify(stateConfig.startup);if(controls.storySignature!==signature){controls.storyChoice.replaceChildren();for(const c of stateConfig.startup?.choices??[]){const o=document.createElement('option');o.value=c.id;o.textContent=c.label;controls.storyChoice.append(o);}controls.storySignature=signature;}controls.storyChoice.hidden=!stateConfig.startup;const state=story.read();controls.storyStatus.textContent=state?.issue??'Accepted state is ready. Live totals are excluded from profile exports.';}
        const compatibilityReport=compatibility(),d=compatibilityReport.runtime??diagnostics();
        const report = `Images: ${d.provider}. Panels: ${d.mounted}. Unresolved images: ${d.unresolvedImages}. Incomplete: ${d.incomplete}. Unsupported: ${d.unsupported}. Conflicts: ${d.conflicts.length}. Witchcure: ${d.witchcure}${d.witchcurePanels.length ? ` (${d.witchcurePanels.join(', ')})` : ''}.`;
        if (controls.report.textContent !== report) controls.report.textContent = report;
        controls.compatibilityView.update(compatibilityReport);
    }

    function start() {
        const ctx = getContext();
        for(const [name,handler]of [
            ['GENERATION_STARTED',story.begin],['GENERATION_AFTER_COMMANDS',(...args)=>{try{story.prepare(...args);}catch(e){window.toastr?.error?.(e.message,'Display Bridge scene state');}}],
            ['MESSAGE_RECEIVED',async(id,type)=>{try{await story.received(id,type);}catch(e){window.toastr?.error?.(e.message,'Display Bridge scene state');story.invalidate();}}],
            ['GENERATION_STOPPED',story.cancel],['GENERATION_ENDED',story.end],['CHAT_CHANGED',story.switched],
            ...['MESSAGE_EDITED','MESSAGE_UPDATED','MESSAGE_SWIPED','MESSAGE_DELETED','CHAT_CREATED'].map(name=>[name,story.invalidate]),
        ]){const type=(ctx.eventTypes??ctx.event_types)?.[name];if(type){ctx.eventSource.on(type,handler);subscriptions.push(()=>ctx.eventSource.removeListener(type,handler));}}
        for(const target of ctx.characters??[]) lifecycle.ensure(target);
        for(const [name,handler] of [
            ['CHARACTER_DELETED',({character:target}={})=>{if(target)lifecycle.remove(target);schedule();}],
            ['CHARACTER_RENAMED',(oldAvatar,newAvatar)=>{lifecycle.move(oldAvatar,newAvatar);saveSettings();schedule();}],
            ['CHARACTER_EDITED',()=>{compiledSources.clear();plans=new WeakMap();schedule();}],
            ['CHAT_CREATED',()=>{const target=character(),chat=durableChat();if(target&&chat)preferences.reset(lifecycle.ensure(target)?.id,chat);schedule();}],
        ]) {const type=(ctx.eventTypes??ctx.event_types)?.[name];if(type){ctx.eventSource.on(type,handler);subscriptions.push(()=>ctx.eventSource.removeListener(type,handler));}}
        // Token-count dry runs have no matching end event. Offline attempts can
        // also return early. Keep playback running without leaving a busy latch.
        for(const name of ['GENERATION_STARTED','GENERATION_ENDED','GENERATION_STOPPED','CHAT_CHANGED']){const type=(ctx.eventTypes??ctx.event_types)?.[name];if(type){const handler=(_type,_options,dryRun)=>{if(name==='GENERATION_STARTED'&&dryRun===true)return;generationBusy=name==='GENERATION_STARTED'&&getContext().onlineStatus!=='no_connection';if(name==='CHAT_CHANGED'){chatMusic.clear();chatInformation.clear();}schedule();};ctx.eventSource.on(type,handler);subscriptions.push(()=>ctx.eventSource.removeListener(type,handler));}}
        for (const name of ['APP_READY', 'CHAT_CHANGED', 'CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED', 'MESSAGE_EDITED', 'MESSAGE_UPDATED', 'MESSAGE_SWIPED', 'MESSAGE_DELETED', 'MORE_MESSAGES_LOADED', 'GENERATION_ENDED', 'SETTINGS_UPDATED']) {
            const type = (ctx.eventTypes ?? ctx.event_types)?.[name];
            if (type) { ctx.eventSource.on(type, schedule); subscriptions.push(() => ctx.eventSource.removeListener(type, schedule)); }
        }
        for (const type of ['v3sprites:provider-ready', 'v3sprites:assets-changed', 'display-bridge:image-status']) {
            window.addEventListener(type, schedule);
            subscriptions.push(() => window.removeEventListener(type, schedule));
        }
        schedule();
        window.dispatchEvent(new CustomEvent('display-bridge:import-ready'));
    }
    function stop() {
        stopped = true;chatMusic.dispose();chatInformation.dispose();chatDock.dispose();story.stop();
        imageViewer.stop();
        cancelAnimationFrame(frame); frame = 0;
        observer?.disconnect();
        subscriptions.splice(0).forEach(remove => remove());
        for (const [root, state] of states) restore(root, state);
        controls?.panel.remove(); controls = null;
        plans = new WeakMap(); errors.clear(); compiledSources.clear(); actionStore.clear();
        window.dispatchEvent(new CustomEvent('display-bridge:ownership-changed'));
    }
    return { start, stop, refresh: schedule, render, setEnabled, setStreamEnabled, setGalleryEnabled, setWitchcureEnabled, attachWitchcure, importProfile, exportProfile, applyPending, diagnostics, compatibility, restorePanels, resetPreferences,exportPreferences,importPreferences, story, interceptRequest:(...args)=>{if(!stopped)story.intercept(...args);}, api: Object.freeze({ apiVersion: 1, getAssetReplay, importApiVersion:1, receiveImport, exportApiVersion:1, exportProfile:exportCardProfile, recoveryApiVersion:1, captureRecovery, restoreRecovery, snapshot }) };
}
