import { resolveAudio } from '../integrations/assets.js';
import { mappedPortraitReference } from '../adapters/portrait-mappings.js';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export const SCENE_CONTROLS_CSS=`.scene-tools{margin:8px 0;color:var(--ink)}.scene-drawer{background:var(--paper);border:1px solid var(--accent);border-radius:10px;padding:12px;max-height:440px;overflow:auto}.scene-roster{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.scene-entity{border:1px solid var(--accent);border-radius:8px;padding:10px;overflow-wrap:anywhere}.scene-entity img{width:100%;height:130px;object-fit:contain}.scene-entity progress{width:100%}.scene-entity dd{font-weight:400}.scene-music{display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:var(--paper);padding:10px;border-radius:8px}.scene-music audio{width:300px;max-width:100%}.scene-tool-note{font-size:12px}.scene-tools [hidden]{display:none!important}`;
export function createSceneControls(data,{avatar,resolver,state,media}={}){
    const c=data.config.sceneControls;if(!c||data.presentation!=='scene')return null;
    const host=el('section');host.className='scene-tools';host.setAttribute('aria-label','Scene information and music');const images=[];
    let musicBox,musicNote,musicSlot,unsubscribe=()=>{};
    const snapshot=data.sceneSnapshot??{};
    if(data.snapshotIssue)host.append(el('p',data.snapshotIssue));
    if(c.roster&&!media?.externalRoster){
        const toggle=el('button',c.roster.title);toggle.type='button';toggle.setAttribute('aria-expanded','false');
        const drawer=el('section');drawer.className='scene-drawer';drawer.hidden=true;drawer.tabIndex=-1;drawer.id='scene-drawer-'+crypto.randomUUID();drawer.setAttribute('aria-label',c.roster.title);toggle.setAttribute('aria-controls',drawer.id);
        const close=el('button','Close information');close.type='button';const hide=()=>{drawer.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.focus();};close.addEventListener('click',hide);drawer.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();hide();}});
        toggle.addEventListener('click',()=>{drawer.hidden=!drawer.hidden;toggle.setAttribute('aria-expanded',String(!drawer.hidden));if(!drawer.hidden)close.focus();});
        drawer.append(close,el('p',data.chatLevel?'Values from the active chat branch. Unavailable values have not been supplied.':'Values recorded for this scene. Unavailable values have not been supplied.'));
        const grid=el('div');grid.className='scene-roster';
        for(const entity of c.roster.entities){const row=snapshot.roster?.find(r=>r.id===entity.id)??{},card=el('section');card.className='scene-entity';card.setAttribute('aria-label',entity.label);card.append(el('h4',entity.label));const badge=entity.badges?.find(b=>b.id===row.badge),ref=badge?.image??entity.portrait;
            if(ref){const img=el('img');img.alt=entity.label;img.loading='lazy';card.append(img);const item={image:img,reference:ref,status:'missing',failedUrl:null};img.addEventListener('error',()=>{item.failedUrl=img.getAttribute('src');item.status='load-error';img.hidden=true;});images.push(item);}
            if(badge)card.append(el('p',badge.label));
            const list=el('dl');for(const [key,label] of [['score','Affection / score'],['location','Location'],['relationship','Relationship']]){const val=row[key],entry=el('div');entry.append(el('dt',c.roster.labels?.[key]??label),el('dd',val===undefined||val===null?'Unavailable':String(val)));list.append(entry);}
            if(Number.isFinite(row.score)){const gauge=el('progress');gauge.max=100;gauge.value=Math.max(0,Math.min(100,row.score));gauge.setAttribute('aria-label',entity.label+' score');card.append(gauge);}card.append(list);grid.append(card);}
        drawer.append(grid);host.append(toggle,drawer);
    }
    if(c.music&&!media?.external){
        musicBox=el('section');musicBox.className='scene-music';musicBox.setAttribute('aria-label',c.music.title);
        musicSlot=el('div');musicNote=el('span');musicNote.className='scene-tool-note';musicNote.setAttribute('role','status');
        const hide=el('button','Hide music');hide.type='button';hide.addEventListener('click',()=>{state.dispatch('music');refresh();});
        const show=el('button','Show music');show.type='button';show.addEventListener('click',()=>{state.dispatch('music');refresh();});
        musicBox.append(musicSlot,hide,musicNote);host.append(show,musicBox);musicBox.showButton=show;
        if(media)unsubscribe=media.session.subscribe(()=>{const error=media.session.status(media.key).error;if(error)musicNote.textContent=error;});
    }
    function refresh(){const s=state.read();host.hidden=!s.visual;for(const item of images){const ref=mappedPortraitReference(data.config,item.reference,s.variant),r=resolver(avatar,ref);item.activeReference=ref;item.status=r.url&&r.url===item.failedUrl?'load-error':r.status;item.image.hidden=!s.image||item.status!=='resolved';if(r.url&&item.image.getAttribute('src')!==r.url)item.image.src=r.url;}
        if(musicBox){
            musicBox.hidden=!s.music;musicBox.showButton.hidden=s.music;
            const track=c.music.tracks.find(t=>t.id===snapshot.track),resolved=track?resolveAudio(avatar,track.asset):null;
            const valid=()=>host.isConnected&&media?.canPlay?.()===true&&state.read().visual;
            if(valid()&&resolved?.status==='resolved'){
                const player=media.session.bind({key:media.key,url:resolved.url,valid,autoTransition:!!data.config.sceneState,volume:s.volume/10,loop:c.music.loop,onVolume:value=>{const volume=Math.round(value*10);if(state.read().volume!==volume)state.dispatch('volume-'+volume);}});
                if(player&&player.parentNode!==musicSlot)musicSlot.append(player);
                musicNote.textContent=media.session.status(media.key).error;
            }else{
                media?.session.release(media.key);
                musicNote.textContent=!valid()?'Music is available on the latest completed scene.':track?'Local audio unavailable ('+resolved?.status+').':'No music selected for this scene.';
            }
        }
    }
    return {host,refresh,dispose(){unsubscribe();media?.session?.release(media.key);},images};
}
