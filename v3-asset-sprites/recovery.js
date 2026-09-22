// Recoverable, single-character operations. The journal is persisted before
// each mutation; an uncertain native write is never silently retried.
export function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',') + '}';
    return JSON.stringify(value);
}

export async function digest(value) {
    const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(canonical(value));
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
}

export function isolateNativeCard(source, iconExt) {
    const card=JSON.parse(JSON.stringify(source));
    if(!card.data) {
        card.data={...card,creator_notes:card.creator_notes??card.creatorcomment??'',extensions:{...card.extensions}};
        for(const key of ['talkativeness','fav'])if(card[key]!==undefined)card.data.extensions[key]=card[key];
        if(card.depth_prompt_prompt!==undefined)card.data.extensions.depth_prompt={prompt:card.depth_prompt_prompt,depth:card.depth_prompt_depth??4,role:card.depth_prompt_role??'system'};
    }
    if(!card.spec){card.spec='chara_card_v2';card.spec_version='2.0';}
    card.data.assets=(Array.isArray(card.data.assets)?card.data.assets:[]).map((asset,i)=>({...asset,uri:`v3-isolated://${i}`}));
    if(iconExt)card.data.assets.unshift({type:'icon',name:'main',ext:iconExt,uri:`embedded://v3-import-avatar.${iconExt}`});
    return card;
}

export function createRecovery({load,save,capture,restore,confirm,selected,lock}) {
    const matches = (a,b) => a.cardRevision===b.cardRevision && a.settingsRevision===b.settingsRevision && a.imagesRevision===b.imagesRevision;
    const guard = avatar => {if(selected()!==avatar)throw Error('Select the original character before continuing.');};
    async function current(avatar) {guard(avatar);const value=await capture(avatar);guard(avatar);return value;}
    return {
        async run(avatar,label,work) {
            return lock(avatar,async()=>{
                const previous=await load(avatar);
                if(previous && !['restored','complete','kept'].includes(previous.status))throw Error('An unfinished recovery point exists. Restore it, or export its backup and choose Keep current card before starting another replacement.');
                guard(avatar);const before=await capture(avatar,true);guard(avatar);
                if(!await confirm(label,before,previous))return null;
                if(!matches(before,await current(avatar)))throw Error('Character or settings changed during review. Nothing was replaced.');
                const record={version:1,avatar,id:crypto.randomUUID(),label,created:new Date().toISOString(),status:'prepared',before,expected:before};
                await save(record);
                // A checkpoint distinguishes verified writes from an interrupted
                // request whose result cannot safely be attributed to this run.
                const checkpoint=async(fn)=>{
                    if(!matches(record.expected,await current(avatar)))throw Error('Character or settings changed during replacement. Recovery point retained.');
                    record.status='writing';await save(record);
                    // Saving/verifying the journal performs network I/O. Recheck
                    // edits and selection after that await, before the mutation.
                    if(!matches(record.expected,await current(avatar)))throw Error('Character or settings changed while saving the recovery journal. Nothing further was written.');
                    const result=await fn();
                    record.expected=await current(avatar);record.status='verified';await save(record);
                    return result;
                };
                try {
                    const result=await work(checkpoint);
                    // Only checkpointed writes may advance the expected result.
                    // Adopting a later edit here would let Undo erase that edit.
                    if(!matches(record.expected,await current(avatar)))throw Error('Character or settings changed after the last verified replacement step.');
                    record.status='complete';await save(record);
                    return result;
                } catch(error) {
                    if(record.status!=='writing')record.status='failed';
                    record.error=String(error.message).slice(0,300);
                    try{await save(record);}catch{/* The earlier durable journal remains. */}
                    throw Error(`${error.message} The recovery point was kept; use Recovery to review it.`);
                }
            });
        },
        async undo(avatar) {
            return lock(avatar,async()=>{
                const record=await load(avatar);
                if(!record||record.version!==1||record.avatar!==avatar)throw Error('No recovery point exists for this character.');
                if(['restored','kept'].includes(record.status))throw Error('This recovery point has already been restored or closed.');
                if(['writing','restoring'].includes(record.status))throw Error('A native write was interrupted or unverified. Automatic restore is blocked. Export the recovery backup for manual review.');
                const now=await current(avatar);
                if(!matches(record.expected,now))throw Error('This character or its import settings changed after the recovery point. Automatic restore is blocked to preserve those edits. Export the backup for manual recovery.');
                if(!await confirm('restore',record.before,record))return null;
                if(!matches(now,await current(avatar)))throw Error('Character changed during review. Nothing was restored.');
                record.status='restoring';await save(record);
                if(!matches(now,await current(avatar)))throw Error('Character or settings changed while saving the restore journal. Nothing was restored.');
                await restore(avatar,record.before,record.label);
                record.expected=await current(avatar);record.status='restored';await save(record);
                return {restored:true};
            });
        },
        async keep(avatar) {
            return lock(avatar,async()=>{
                guard(avatar);const record=await load(avatar);
                if(!record||record.avatar!==avatar)throw Error('No recovery point exists.');
                if(!await confirm('keep',record.before,record))return null;
                guard(avatar);record.status='kept';await save(record);return {kept:true};
            });
        },
    };
}
