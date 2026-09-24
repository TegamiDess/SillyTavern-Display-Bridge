// One native player per bridge instance. Only opted-in state transitions may
// resume a previous user Play; initial binding never starts playback.
export function createSceneAudio({createAudio=()=>new Audio()}={}){
    let player=null,owner=null,epoch=0,resume=false;
    const listeners=new Set(),emit=()=>{for(const fn of listeners)fn();};
    function stop(remember=false){epoch++;if(!remember)resume=false;owner=null;if(player){player.pause();player.removeAttribute('src');player.load();player.remove?.();}emit();}
    function sweep(){if(owner&&!owner.valid())stop(owner.autoTransition===true);}
    function bind(next){
        if(!next.valid())return null;
        const transition=owner?.key!==next.key||owner?.url!==next.url;
        if(transition)stop(next.autoTransition===true);
        if(!player){
            player=createAudio();player.preload='none';player.controls=true;
            player.setAttribute?.('aria-label','Scene music');
            player.addEventListener('play',()=>{if(!owner?.valid()){stop();return;}resume=true;owner.error='';emit();});
            // Native pause events can be delayed or cancelled by load(). Read
            // current ownership/playback rather than counting expected events.
            player.addEventListener('ended',emit);player.addEventListener('pause',()=>{if(owner&&player.paused&&!player.ended)resume=false;emit();});
            player.addEventListener('volumechange',()=>owner?.onVolume?.(player.volume));
            player.addEventListener('error',()=>{if(owner){owner.error='Audio could not be decoded or loaded.';emit();}});
        }
        const error=owner?.error;owner=next;if(error)owner.error=error;
        if(player.volume!==next.volume)player.volume=next.volume;player.loop=next.loop;
        if(player.getAttribute('src')!==next.url)player.src=next.url;
        if(transition&&resume&&next.autoTransition){const token=epoch;Promise.resolve(player.play()).catch(()=>{if(epoch===token&&owner){resume=false;owner.error='Automatic playback was unavailable. Press Play to continue.';emit();}});}
        return player;
    }
    async function play(next){
        if(!bind(next))return false;
        const token=++epoch;
        try{await player.play();if(token!==epoch||!next.valid()){if(token===epoch)stop();return false;}emit();return true;}
        catch{if(token===epoch){owner.error='Playback was unavailable. Try Play again or check the audio file.';emit();}return false;}
    }
    return {bind,play,stop,suspend:()=>stop(true),sweep,release(key){if(owner?.key===key)stop(owner.autoTransition===true);},owns:key=>owner?.key===key,pause(key){if(owner?.key===key){epoch++;resume=false;player.pause();emit();}},status(key){sweep();return owner?.key===key?{playing:!player.paused,error:owner.error??''}:{playing:false,error:''};},volume(key,value){if(owner?.key===key)player.volume=value;},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}};
}
