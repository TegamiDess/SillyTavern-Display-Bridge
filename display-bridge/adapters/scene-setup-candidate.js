// Prepare a reviewable form from literal declarations, not a trigger interpreter.
import {validateSceneState} from './scene-state.js';

export function buildSetupCandidate(source, {title='Conversation setup', unset=[], required=[], unique=[], preserveOnReset=[], labels={}}={}) {
    if(source.actionSourceVersion!==1)throw Error('Reattach the source with action metadata before preparing setup.');
    if(source.requiredMacros?.some(m=>m!=='getvar')||source.macroReferences?.some(r=>r.kind!=='getvar'||r.field!=='prompt'))throw Error('This setup candidate supports declared prompt reads only.');
    const names=[...new Set((source.macroReferences??[]).map(r=>r.name))],defaults=Object.create(null);
    if(!names.length||names.length>32)throw Error('Expected one to 32 prompt variables.');
    for(const line of String(source.risuai?.defaultVariables??'').split(/\r?\n/)){
        const i=line.indexOf('=');if(i<1)continue;const key=line.slice(0,i).trim();if(Object.hasOwn(defaults,key))throw Error('Duplicate default: '+key);defaults[key]=line.slice(i+1).trim();
    }
    const effects=(source.risuai?.triggerscript??[]).filter(t=>t.type==='manual').flatMap(t=>t.effect??[]);
    const variables={},fields=[];
    for(const key of names){
        if(!/^[A-Za-z][\w-]{0,59}$/.test(key)||['constructor','prototype','__proto__'].includes(key)||!Object.hasOwn(defaults,key))throw Error('Missing or invalid setup declaration: '+key);
        const initial=defaults[key];
        const input=effects.some(e=>e.type==='v2GetAlertInput'&&e.outputVar===key);
        const values=[...new Set([initial,...effects.filter(e=>e.type==='v2SetVar'&&e.operator==='='&&e.var===key&&e.valueType==='value'&&typeof e.value==='string'&&!/[{}]/.test(e.value)).map(e=>e.value)])];
        if(!input&&values.length<2)throw Error('No finite options or text input found for '+key);
        variables[key]=input?{type:'string',initial,maxLength:4096}:{type:'enum',initial,values};
        fields.push({key,label:labels[key]??key,required:required.includes(key),unset:[...unset],reset:!preserveOnReset.includes(key),native:true});
    }
    for(const key of [...required,...preserveOnReset,...unique.flat(),...Object.keys(labels)])if(!names.includes(key))throw Error('Unknown reviewed field: '+key);
    // Values found inside conditional actions are choices, not evidence that the
    // original action semantics are supported. This result always needs review.
    return {requiresReview:true,state:validateSceneState({version:4,variables,rules:[],setup:{version:1,title,fields,unique}}),
        notes:['Review choice values, unset/required policies, uniqueness and reset before importing. Original triggers are not executed.']};
}
