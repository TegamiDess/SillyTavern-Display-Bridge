import {createSceneControls,SCENE_CONTROLS_CSS} from './scene-controls.js';
import {resolveImage} from '../integrations/assets.js';

// A single drawer owned by the active chat. Rebuild only when committed values
// change, retaining open/scroll state while generations leave those values alone.
export function createChatInformation(){
 const host=document.createElement('div');host.id='display-bridge-chat-information';
 const root=host.attachShadow({mode:'open'}),style=document.createElement('style');
 style.textContent=SCENE_CONTROLS_CSS+`:host{display:block;flex:none;position:relative;color:var(--SmartThemeBodyColor);font:inherit}*{box-sizing:border-box}button{font:inherit;color:inherit;background:var(--paper);border:1px solid var(--accent);border-radius:5px;padding:5px 9px;cursor:pointer}.scene-tools{margin:0;padding:4px 8px}.scene-drawer{position:absolute;z-index:50;top:100%;right:0;width:min(820px,calc(100vw - 32px));max-height:min(60vh,650px);box-shadow:0 8px 30px #0006}.scene-roster{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}dl{margin:8px 0}dt{font-size:12px;opacity:.8}dd{margin:2px 0 8px}h4{margin:6px 0}.scene-entity img{height:130px}p{margin:8px 0}`;
 root.append(style);let widget=null,key=null,signature=null;
 function clear(){widget?.dispose();widget?.host.remove();widget=null;key=null;signature=null;host.remove();}
 function update({key:nextKey,config,snapshot,issue,avatar,state}){
  const next=JSON.stringify([config.sceneControls?.roster,snapshot,issue,config.theme,state.read().variant,config.imageMappings]);
  if(key===nextKey&&signature===next){widget?.refresh();return;}
  const drawer=widget?.host.querySelector('.scene-drawer'),open=key===nextKey&&drawer&&!drawer.hidden,scroll=drawer?.scrollTop??0;
  widget?.dispose();widget?.host.remove();key=nextKey;signature=next;
  for(const [name,value]of Object.entries({paper:config.theme.background,ink:config.theme.text,accent:config.theme.accent}))host.style.setProperty('--'+name,value);
  widget=createSceneControls({presentation:'scene',config,sceneSnapshot:snapshot,snapshotIssue:issue,chatLevel:true},{avatar,resolver:resolveImage,state,media:{external:true}});
  if(!widget)return;root.append(widget.host);widget.refresh();
  if(open){const d=widget.host.querySelector('.scene-drawer');d.hidden=false;d.scrollTop=scroll;widget.host.querySelector('button[aria-expanded]')?.setAttribute('aria-expanded','true');}
 }
 return {host,update,clear,dispose:clear};
}
