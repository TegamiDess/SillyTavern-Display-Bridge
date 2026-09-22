// Only durable presentation preferences live here. Open posts, map popups and
// portrait details remain transient; message text and story state are excluded.
export function createPreferences({state,save}) {
    const validMode=x=>['auto','roster','report'].includes(x);
    const validView=v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===5&&['visual','image','dialogue','console'].every(k=>typeof v[k]==='boolean')&&typeof v.variant==='string'&&/^[A-Za-z][\w-]{0,79}$/.test(v.variant);
    const validPreset=v=>v&&typeof v==='object'&&Object.keys(v).every(k=>['signature','state','previous'].includes(k))&&typeof v.signature==='string'&&v.signature.length<=100000&&validView(v.state)&&(v.previous===null||validView(v.previous));
    const copy=x=>JSON.parse(JSON.stringify(x));
    function getPreset(identity,chat,signature){const v=store()[key(identity,chat)]?.preset;return validPreset(v)&&v.signature===signature?copy(v):null;}
    function setPreset(identity,chat,preset){if(!identity||!chat||chat.length>500||!validPreset(preset))return false;const k=key(identity,chat),old=store()[k]??{mode:'auto'};set(identity,chat,old.mode);store()[k]={...old,preset:copy(preset),updated:Date.now()};save();return true;}
    function store(){const s=state();if(!s.chats||typeof s.chats!=='object'||Array.isArray(s.chats))s.chats={};s.version=1;return s.chats;}
    const key=(identity,chat)=>JSON.stringify([identity,chat]);
    function get(identity,chat){if(!identity||!chat)return 'auto';const v=store()[key(identity,chat)]?.mode;return validMode(v)?v:'auto';}
    function set(identity,chat,mode){if(!identity||typeof chat!=='string'||!chat||chat.length>500||!validMode(mode))return false;
        const entries=store(),k=key(identity,chat);if(entries[k]?.mode===mode)return true;
        Object.defineProperty(entries,k,{value:{...entries[k],mode,updated:Date.now()},writable:true,configurable:true,enumerable:true});
        const keys=Object.keys(entries).sort((a,b)=>(entries[a]?.updated??0)-(entries[b]?.updated??0));while(keys.length>200)delete entries[keys.shift()];save();return true;}
    function reset(identity,chat){const entries=store();for(const k of Object.keys(entries)){let scope;try{scope=JSON.parse(k);}catch{continue;}if(scope[0]===identity&&(chat===undefined||scope[1]===chat))delete entries[k];}save();}
    function exportFor(identity){const chats=[];for(const k of Object.keys(store())){let scope;try{scope=JSON.parse(k);}catch{continue;}if(scope[0]===identity&&typeof scope[1]==='string'&&validMode(store()[k]?.mode))chats.push({chat:scope[1],mode:store()[k].mode,...(validPreset(store()[k].preset)?{preset:copy(store()[k].preset)}:{})});}return {kind:'display-bridge-preferences',schemaVersion:chats.some(r=>r.preset)?2:1,chats};}
    function importFor(identity,input){
        if(!input||input.kind!=='display-bridge-preferences'||![1,2].includes(input.schemaVersion)||Object.keys(input).some(k=>!['kind','schemaVersion','chats'].includes(k))||!Array.isArray(input.chats)||input.chats.length>200||JSON.stringify(input).length>48000000)throw new Error('Unsupported preference file.');
        const seen=new Set();for(const row of input.chats){if(!row||Object.keys(row).some(k=>!['chat','mode',...(input.schemaVersion===2?['preset']:[])].includes(k))||typeof row.chat!=='string'||!row.chat||row.chat.length>500||seen.has(row.chat)||!validMode(row.mode)||(Object.hasOwn(row,'preset')&&!validPreset(row.preset)))throw new Error('Invalid chat preference.');seen.add(row.chat);}
        reset(identity);for(const row of input.chats){set(identity,row.chat,row.mode);if(row.preset)setPreset(identity,row.chat,row.preset);}
    }
    function migratePreset(identity,oldSignature,newSignature,variantIds,appearance) {
        if(!identity||oldSignature===newSignature)return;
        const allowed=new Set([...(appearance?.allowOriginal===false?[]:['original']),...variantIds]);let changed=false;
        const migrate=view=>view?{...view,variant:allowed.has(view.variant)?view.variant:(appearance?.defaultVariant??'original')}:null;
        for(const [k,row] of Object.entries(store())){
            let scope;try{scope=JSON.parse(k);}catch{continue;}
            if(scope[0]!==identity||!validPreset(row.preset)||row.preset.signature!==oldSignature)continue;
            row.preset={signature:newSignature,state:migrate(row.preset.state),previous:migrate(row.preset.previous)};changed=true;
        }
        if(changed)save();
    }
    return {get,set,reset,exportFor,importFor,getPreset,setPreset,migratePreset};
}
