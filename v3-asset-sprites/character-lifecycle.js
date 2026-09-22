// Shared verbatim with V3. Identity comes from ST's native create_date, never
// from display names, prompt contents, or a guessed asset path.
export function createCharacterLifecycle({state,save,retire,rename,uuid=()=>crypto.randomUUID()}) {
    const own=(o,k)=>Object.hasOwn(o,k),put=(o,k,v)=>Object.defineProperty(o,k,{value:v,enumerable:true,writable:true,configurable:true});
    function records(){const s=state();if(!s.entries||typeof s.entries!=='object'||Array.isArray(s.entries))s.entries={};s.version=1;return s.entries;}
    const stamp=character=>typeof character?.create_date==='string'?character.create_date:null;
    function ensure(character) {
        if(!character?.avatar) return null;
        const entries=records(),avatar=character.avatar,created=stamp(character);
        let entry=own(entries,avatar)?entries[avatar]:null;
        if(entry?.created&&created&&entry.created!==created) {
            retire(avatar,'Character replaced');entry=null;
        }
        if(!entry) {entry={id:uuid(),created};put(entries,avatar,entry);save();}
        else if(!entry.created&&created) {entry.created=created;save();}
        return {...entry,active:!entry.deleted&&!entry.redirect};
    }
    function remove(character) {
        const known=records()[character?.avatar],created=stamp(character);
        if(known?.deleted||known?.redirect||(known?.created&&created&&known.created!==created))return;
        const entry=ensure(character);if(!entry)return;
        retire(character.avatar,'Character deleted');put(records(),character.avatar,{id:entry.id,created:entry.created,deleted:true});save();
    }
    function move(oldAvatar,newAvatar) {
        if(typeof oldAvatar!=='string'||typeof newAvatar!=='string'||!oldAvatar||!newAvatar||oldAvatar===newAvatar)return;
        const entries=records(),entry=own(entries,oldAvatar)?entries[oldAvatar]:{id:uuid(),created:null};
        if(entry?.redirect||entry?.deleted)return;
        // Returning to this identity's own former filename is not a collision.
        // Retiring that redirect would erase the current card's preferences.
        if(own(entries,newAvatar)&&entries[newAvatar]?.id!==entry.id)retire(newAvatar,'Rename destination reused');
        rename(oldAvatar,newAvatar);put(entries,newAvatar,{id:entry.id,created:entry.created});put(entries,oldAvatar,{...entry,redirect:newAvatar});save();
    }
    return {ensure,remove,move};
}
