import {resolveAudio} from '../integrations/assets.js';

// The element and playback belong to the chat, never to a message widget.
export function createChatMusic(session){
 const host=document.createElement('div');host.id='display-bridge-chat-music';
 const root=host.attachShadow({mode:'open'});root.innerHTML='<style>:host{display:block;flex:none;color:var(--SmartThemeBodyColor);font:inherit}section{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:4px 8px;background:var(--SmartThemeBlurTintColor)}section>*{min-width:0}.player{display:block;width:100%;max-width:100%}audio{width:100%;max-width:100%;height:32px}button{font:inherit;color:inherit;background:var(--SmartThemeBlurTintColor);border:1px solid var(--SmartThemeBorderColor);border-radius:5px;padding:4px 8px;cursor:pointer}label{display:flex;gap:4px;align-items:center}small{max-width:380px}[hidden]{display:none!important}</style><section aria-label="Chat music"><button type="button">Hide music</button><span class="player"></span><label><input type="checkbox" checked>Loop</label><small role="status"></small></section>';
 const button=root.querySelector('button'),slot=root.querySelector('.player'),loop=root.querySelector('input'),label=root.querySelector('label'),note=root.querySelector('small');
 let binding=null,hidden=false;
 function visibility(){slot.hidden=hidden;label.hidden=hidden;button.textContent=hidden?'Show music':'Hide music';}
 button.addEventListener('click',()=>{hidden=!hidden;visibility();});
 loop.addEventListener('change',()=>{if(binding)update(binding);});
 const unsubscribe=session.subscribe(()=>{if(binding){const error=session.status(binding.key).error;if(error)note.textContent=error;}});
 function update(next){
  if(binding?.key!==next.key){hidden=false;loop.checked=true;visibility();}
  binding=next;const {avatar,music,track,key,valid}=next;
  const selected=music.tracks.find(t=>t.id===track),resolved=selected?resolveAudio(avatar,selected.asset):null;
  if(!valid()){clear();return;}
  if(resolved?.status==='resolved'){
   const player=session.bind({key,url:resolved.url,valid,autoTransition:true,volume:next.volume??music.volume,loop:loop.checked,onVolume:next.onVolume});
   if(player&&player.parentNode!==slot)slot.append(player);
   note.textContent=session.status(key).error;
  }else{session.release(key);slot.replaceChildren();note.textContent=selected?'Local audio unavailable ('+resolved?.status+').':'No music selected for this scene.';}
 }
 function clear(){binding=null;session.stop();host.remove();slot.replaceChildren();}
 return {host,update,clear,dispose(){clear();unsubscribe();}};
}
