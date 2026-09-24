import {inspectSceneRule, assembleSceneRules, sceneOffsetAliases} from '../adapters/scene-recognition.js';
import {assembleSceneImport} from '../adapters/scene-import.js';
import {coveredSourceMacros} from '../adapters/scene-source-context.js';
import { readPresentationStyles } from '../adapters/presentation-style.js';
import { inspectPresentationRule } from '../adapters/presentation-recognition.js';
import { DEFAULT_PRESET } from '../adapters/portrait-dialogue.js';
import { inspectPortraitRule } from '../adapters/portrait-recognition.js';
import { validatePortraitPreset } from '../adapters/portrait-dialogue.js';
import { witchcureSource, compileWitchcure } from '../adapters/witchcure.js';
import { portraitRule, AUTO_ROSTER_PATTERN } from '../adapters/witchcure-portraits.js';

export const PROFILE_KIND = 'display-bridge-profile';
const IDS = new Set(['media-panel','gallery','witchcure','portrait-dialogue']);
const fail = message => { throw new Error(`Profile: ${message}`); };
function object(value, allowed) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key=>!allowed.includes(key))) fail('unknown fields or invalid object');
}
// Runtime identity, enabled choices, paths and live variables are deliberately
// not part of this portable definition. Adapter v1 owns its fixed parser,
// capture types, action bindings, aliases and reviewed layout contract.
export function validateProfile(input, css) {
    if (JSON.stringify(input)?.length > 1500000) fail('definition exceeds size limit');
    object(input,['kind','schemaVersion','adapters']);
    if (input.kind !== PROFILE_KIND || input.schemaVersion !== 1) fail('unsupported kind or schema version');
    if (!Array.isArray(input.adapters) || input.adapters.length > 4 || !input.adapters.length) fail('expected one to four adapters');
    const seen = new Set();
    const adapters = input.adapters.map(adapter=>{
        object(adapter,['id','version','source']);
        if (!IDS.has(adapter.id) || ![1,...(adapter.id==='portrait-dialogue'?[2,3,4,5,6,7,8,9,10,11]:adapter.id==='witchcure'?[2]:[])].includes(adapter.version) || seen.has(adapter.id)) fail('unknown, repeated or unsupported adapter');
        seen.add(adapter.id);
        if(adapter.id==='portrait-dialogue') {const source=validatePortraitPreset(adapter.source);if(adapter.version<portraitVersion(source))fail('portrait fields require adapter version '+portraitVersion(source));return {id:adapter.id,version:adapter.version,source};}
        if (adapter.id !== 'witchcure') {
            if (Object.hasOwn(adapter,'source')) fail('built-in adapter cannot accept source overrides');
            return {id:adapter.id,version:1};
        }
        object(adapter.source,['roster','report','styles','map','status',...(adapter.version===2?['portraits','autoRoster','cleanMoveTop']:[])]);
        for (const key of ['roster','report','styles']) if (typeof adapter.source[key] !== 'string') fail(`missing Witchcure ${key}`);
        for (const key of ['roster','report','styles','map','status']) if (Object.hasOwn(adapter.source,key) && (typeof adapter.source[key] !== 'string' || adapter.source[key].length > 500000)) fail('invalid template source');
        for(const key of ['autoRoster','cleanMoveTop']) if(Object.hasOwn(adapter.source,key)&&typeof adapter.source[key]!=='boolean') fail('invalid display option');
        compileWitchcure(adapter.source,css);
        return {id:adapter.id,version:adapter.version,source:JSON.parse(JSON.stringify(adapter.source))};
    });
    return {kind:PROFILE_KIND,schemaVersion:1,adapters};
}

export function discoverProfile(source, css) {
    if (!source || source.sourceVersion !== 1 || JSON.stringify(source).length > 2000000) fail('unsupported source envelope');
    const notes = [], adapters = [];
    const risu = source.risuai ?? {};
    const rules = Array.isArray(risu.customScripts) ? risu.customScripts : [];
    const effects = (Array.isArray(risu.triggerscript) ? risu.triggerscript : []).flatMap(t=>Array.isArray(t.effect)?t.effect:[]);
    const consumed = new Map(), portraitResults = new Map();
    let assembly=null;
    const galleryEffect = effect => effect.type==='triggerlua' && typeof effect.code==='string' && ['extractAllDcBlocks','processDcBlock','PNUM','PCONT'].every(marker=>effect.code.includes(marker));
    const details = () => ({
        version:1, explicitProfile:Object.hasOwn(source,'profile'),sceneAssembly:assembly?.coverage??null,
        rules:rules.slice(0,500).map((rule,index)=>({
            number:index+1, label:String(rule.label || `Card rule ${index+1}`).slice(0,120), type:String(rule.type || 'unknown').slice(0,60),
            status:consumed.has(index)?'adapted':rule.type==='disabled'?'disabled':!rule.in&&!rule.out?'no-op':rule.type==='editdisplay'?'not-translated':'not-run',
            adapter:consumed.get(index) ?? null,
            macros:[...new Set(Array.from(String(rule.out??'').matchAll(/\{\{\s*(#?\/?[a-z_][a-z_0-9]*)/gi),match=>match[1].toLowerCase()))].slice(0,30),
            reason:portraitResults.get(index)?.reason ?? (consumed.has(index)?(rule.type==='editoutput'?'Roster placement is reproduced in the display only; stored replies remain unchanged.':'Handled by the reviewed panel adapter.'):rule.type==='disabled'?'Disabled in the source.':!rule.in&&!rule.out?'Empty separator; no behaviour to port.':rule.type==='editdisplay'?'Not translated by Display Bridge; check image-rule results below for image-only rules.':'Input/output rules are not run by Display Bridge.'),
        })),
        effects:effects.slice(0,500).map((effect,index)=>({number:index+1,type:String(effect.type || 'unknown').slice(0,60),
            status:'not-run', reason:galleryEffect(effect)&&adapters.some(a=>a.id==='gallery')?'Gallery presentation is supplied by the reviewed adapter. The original effect is not executed.':adapters.some(a=>a.id==='witchcure')&&effect.type==='triggerlua'&&/function\s+toggleNameFormat\s*\(/.test(effect.code??'')?'The roster/report switch is implemented by the adapter; the original Lua is not executed. Additional Lua behaviour is not inferred.':'Original trigger effects are not executed; story changes and other Lua actions are not ported.'})),
    });
    if (Object.hasOwn(source,'profile')) {
        const profile = validateProfile(source.profile,css);
        if (rules.length || effects.length) notes.push('An explicit profile was used. Other imported scripts were not executed.');
        adapters.push(...profile.adapters);
        const unresolved=adapters.some(a=>a.source?.format?.kind==='scene-fragments'&&!coveredSourceMacros(source,a.source.sceneState?.request))&&source.requiredMacros?.length;
        if(unresolved){assembly={coverage:[{feature:'Startup / prompt macros',status:'unsupported',reason:'The explicit profile is preserved, but source greeting/prompt macros still require review: '+source.requiredMacros.join(', ')+'.'}]};notes.push(assembly.coverage[0].reason);}
        return { profile, notes, discovery:details(), ...(unresolved?{requiresReview:true}:{}) };
    }
    if(source.suppressDiscovery===true)return {profile:null,notRequested:true,notes:['This configured export includes images only; UI discovery was deliberately omitted.'],discovery:details()};
    rules.forEach((rule,index)=>{
        if (rule.type === 'editdisplay' && rule.in === String.raw`\[Assets:(.*?)\|Chat:(.*?)\|Time:(.*?)\|AkaChat:(.*?)\]`) {
            if (!adapters.some(x=>x.id==='media-panel')) adapters.push({id:'media-panel',version:1});
            consumed.set(index,'media-panel');
        }
    });
    if (effects.some(galleryEffect)) adapters.push({id:'gallery',version:1});
    const styles=readPresentationStyles(risu.backgroundHTML,css);
    rules.forEach((rule,index)=>{const result=inspectSceneRule(rule,{optionsPreserved:source.ruleOptionsVersion===1})??inspectPresentationRule(rule,{optionsPreserved:source.ruleOptionsVersion===1,styles})??inspectPortraitRule(rule,{optionsPreserved:source.ruleOptionsVersion===1});if(result)portraitResults.set(index,result);});
    const portraitCandidates=[...portraitResults.values()];
    if(portraitCandidates.length){
        const supported=portraitCandidates.filter(r=>r.status==='supported');
        const extended=supported.filter(r=>r.family==='tagged'||r.family==='community');
        if(supported.length&&supported.every(r=>r.family==='scene-fragments')){
            try{const format=assembleSceneRules(portraitResults,rules),source=validatePortraitPreset({...DEFAULT_PRESET,format,variants:[],theme:{...DEFAULT_PRESET.theme,pattern:'plain',background:'#26313e',text:'#f2f4f8',accent:'#8499b1'}});for(const r of supported)r.source=source;}
            catch(e){for(const r of supported){r.status='unsupported';r.reason=e.message;}}
        }
        if(extended.length===supported.length&&extended.length){
            try{const families=new Set(extended.map(r=>r.family));if(families.size!==1)throw Error('Mixed presentation families require an explicit profile.');
                const format=extended[0].family==='community'?{kind:'community'}:{kind:'tagged',entries:[...new Map(extended.map(r=>[JSON.stringify(r.entry),r.entry])).values()]};
                const source=validatePortraitPreset({...DEFAULT_PRESET,format,variants:[]});for(const r of supported)r.source=source;
            }catch(e){for(const r of supported){r.status='unsupported';r.reason=e.message;}}
        }
        const signatures=new Set(supported.map(r=>JSON.stringify(r.source)));
        if(supported.length===portraitCandidates.length&&supported.every(r=>r.status==='supported'&&r.source)&&signatures.size===1){
            adapters.push({id:'portrait-dialogue',version:portraitVersion(supported[0].source),source:supported[0].source});
            if(styles.reason)notes.push(styles.reason+'. Built-in presentation styling was used.');
            for(const result of supported)if(result.entry?.style)result.reason+=' Imported bounded colour, typography and layout tokens; unsupported CSS remains omitted.';
            for(const index of portraitResults.keys())consumed.set(index,'portrait-dialogue');
            if(supported[0].source.format.kind==='scene-fragments')rules.forEach((rule,index)=>{if(rule.type==='editdisplay'&&rule.in==='<0>'&&['','</div>'].includes(String(rule.out).trim())){consumed.set(index,'portrait-dialogue');portraitResults.set(index,{reason:'Recognized an empty cast; the scene can show a background and dialogue without portraits.'});}});
            if(supported[0].source.format.details?.castMetadata)rules.forEach((rule,index)=>{const names=sceneOffsetAliases(rule);if(names.length&&names.every(name=>supported[0].source.format.details.offsetAliases[name]===rule.out)){consumed.set(index,'portrait-dialogue');portraitResults.set(index,{reason:'Literal portrait-position aliases compiled into a bounded lookup; source regex is not executed.'});}});
            notes.push('Presentation bindings were recognized. The preset supplies its own layout and visibility controls; only supported style tokens are extracted. Other source CSS, appearance choices and scripts are not executed.');
        }else{
            for(const [index,result] of portraitResults)if(result.status==='supported')portraitResults.set(index,{...result,status:'unsupported',reason:'Other portrait/dialogue rules are incompatible or use a different configuration. Choose one explicit profile; no portrait preset was enabled automatically.'});
            notes.push('Portrait/dialogue discovery needs review. See the per-rule reasons; use Set up portrait and dialogue or an explicit UI profile.');
        }
    }
    const witch = witchcureSource({data:{extensions:{risuai:risu}}});
    if (witch) {
        try {
            compileWitchcure(witch,css);
            adapters.push({id:'witchcure',version:witchVersion(witch),source:witch});
            rules.forEach((rule,index)=>{if (rule.type==='editdisplay' && [witch.roster,witch.report,witch.map,witch.status].filter(Boolean).includes(rule.out)) consumed.set(index,'witchcure');});
            rules.forEach((rule,index)=>{
                if((portraitRule(rule)&&witch.portraits?.some(p=>p.template===rule.out)) || (witch.cleanMoveTop&&rule.type==='editdisplay'&&rule.in==='@@move_top'&&rule.out==='') || (witch.autoRoster&&rule.type==='editoutput'&&rule.in===AUTO_ROSTER_PATTERN&&rule.out==='$1\n\n[명부]')) consumed.set(index,'witchcure');
            });
        } catch (error) { notes.push(`Witchcure was not enabled: ${error.message}`); }
    }
    const scene=adapters.find(a=>a.id==='portrait-dialogue'&&a.source.format.kind==='scene-fragments');
    if(scene){
        assembly=assembleSceneImport(source,scene.source);
        scene.source=assembly.preset;scene.version=portraitVersion(scene.source);
        for(const [index,reason] of assembly.adaptedRules){consumed.set(index,'portrait-dialogue');portraitResults.set(index,{reason});}
        for(const item of assembly.coverage)notes.push(`${item.feature}: ${item.status}. ${item.reason}`);
    }
    const otherDisplay = rules.filter((rule,index)=>rule.type==='editdisplay' && !consumed.has(index) && rule.out?.trim()).length;
    if (otherDisplay) notes.push(`${otherDisplay} other display rule(s) are outside this profile; image rules remain the image provider's responsibility.`);
    const nonDisplay = rules.filter((rule,index)=>!consumed.has(index)&&rule.type && !['editdisplay','disabled'].includes(rule.type) && (rule.in || rule.out)).length;
    if (nonDisplay) notes.push(`${nonDisplay} input/output rule(s) are not run by Display Bridge.`);
    if (effects.length) notes.push(`${effects.length} original trigger effect(s) were not executed. Only behavior represented by the reviewed adapters is available; see per-effect results.`);
    if (adapters.some(x=>['media-panel','gallery'].includes(x.id))) notes.push('Stream/gallery use the reviewed built-in layouts, not arbitrary imported HTML or Lua.');
    if (!adapters.length && !rules.length && !effects.length) notes.push('No supported UI rules were found in this source. Enabling a panel checkbox cannot supply missing templates. Attach the original CHARX with V3 to recover its UI source.');
    const discovery=details();
    if(assembly){let offset=0;for(const [i,t] of (risu.triggerscript??[]).entries()){
        if(assembly.adaptedTriggers.has(i))for(let j=0;j<(t.effect?.length??0);j++){
            const effect=discovery.effects[offset+j];if(effect){effect.status='adapted';effect.reason='Finite relationship-to-badge lookup compiled; original trigger code is not executed.';}
        }
        offset+=t.effect?.length??0;
    }}
    return {profile:adapters.length ? validateProfile({kind:PROFILE_KIND,schemaVersion:1,adapters},css) : null, notes, discovery, requiresReview:!!assembly?.coverage.some(c=>c.status!=='ready')};
}

export function profileFromSettings(settings, css) {
    const adapters = (settings.adapters ?? []).map(id=>id==='portrait-dialogue'?{id,version:portraitVersion(settings.portraitSource),source:settings.portraitSource}:id==='witchcure' ? {id,version:witchVersion(settings.witchcureSource),source:settings.witchcureSource} : {id,version:1});
    return validateProfile({kind:PROFILE_KIND,schemaVersion:1,adapters},css);
}
export function witchVersion(source) {return ['portraits','autoRoster','cleanMoveTop'].some(k=>Object.hasOwn(source??{},k))?2:1;}

export function profileConflicts(profile, rules) {
    const markers = profile.adapters.flatMap(adapter=>{
        if(adapter.id!=='portrait-dialogue')return adapter.id==='media-panel'?['Assets:']:adapter.id==='gallery'?['DC\\[','DC[']:['명부','평가 보고서','<MAP>'];
        const f=adapter.source.format;
        if(f.kind==='scene-fragments')return ['<img src=','<img=','<div tn=','<div><div tn='];
        if(f.kind==='community')return ['<img=','ID:','Personality:'];
        if(f.kind==='tagged')return f.entries.flatMap(e=>e.kind==='dynamic'?['[A-Za-z ]+']:e.kind==='status'?[e.tag]:['<'+e.tag,'<\\s*'+e.tag]);
        return [f.open,f.open.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')];
    });
    // This exact single-image grammar excludes pipes, so it cannot consume a
    // stream panel. Do not suppress warnings merely because a rule has a V3 ID.
    const standaloneImage=rule=>rule.id==='v3s-builtin-panel-lax'&&rule.findRegex===String.raw`/\[Assets:([^|\]\r\n]+)\]/g`&&/^V3ASSETREF_[a-f0-9]{32}_END$/.test(rule.replaceString??'')&&rule.markdownOnly===true;
    return rules.filter(rule=>rule && !rule.disabled && !rule.promptOnly && typeof rule.findRegex==='string' && !standaloneImage(rule) && markers.some(marker=>rule.findRegex.includes(marker))).map(rule=>String(rule.scriptName ?? rule.id ?? 'Unnamed display rule').slice(0,120));
}

export function portraitVersion(source) {if(source?.format?.normalization?.displayCleanup!==undefined)return 11;if(source?.sceneState?.version===3||source?.format?.normalization!==undefined)return 10;if(source?.sceneState!==undefined)return source.sceneState.version===2?9:8;if(source?.sceneControls!==undefined)return 7;if(source?.format?.details!==undefined)return 6;if(['appearance','portraitLabels'].some(k=>Object.hasOwn(source??{},k)))return 5;if(source?.format?.kind==='scene-fragments')return 4;if(['imageMappings','metadataLabels','defaults'].some(k=>Object.hasOwn(source??{},k)))return 3;return source?.format?.entries?.some(e=>e.style!==undefined||e.placement!==undefined)?2:1;}
