// Chat-owned controls live outside the chat/composer layout. On wide desktop
// layouts they occupy the right gutter; otherwise the tray starts collapsed.
export function createChatDock({rebuild}){
 const host=document.createElement('aside');host.id='display-bridge-chat-dock';host.setAttribute('aria-label','Scene controls');
 const root=host.attachShadow({mode:'open'});root.innerHTML=`<style>
 :host{position:fixed;right:12px;top:60px;width:240px;max-width:calc(100vw - 24px);z-index:30;color:var(--SmartThemeBodyColor,#ddd);font:14px system-ui;pointer-events:none}
 details{pointer-events:auto;border:1px solid var(--SmartThemeBorderColor,#666);border-radius:8px;background:var(--SmartThemeBlurTintColor,#20252dee);box-shadow:0 3px 14px #0004}summary{padding:8px 10px;cursor:pointer;user-select:none}details:not([open]){width:max-content;margin-left:auto}
 .body{padding:0 4px 6px}button{font:inherit;color:inherit;background:transparent;border:1px solid var(--SmartThemeBorderColor,#666);border-radius:5px;padding:5px 8px;margin:4px;cursor:pointer}button:disabled{opacity:.5;cursor:default}p{margin:4px 8px;font-size:12px;overflow-wrap:anywhere}[hidden]{display:none!important}
 </style><details><summary>Scene controls</summary><div class="body"><slot></slot><button type="button" title="Replay the current saved branch from the profile defaults. This does not change story text.">Rebuild scene state</button><p role="status" hidden></p></div></details>`;
 const tray=root.querySelector('details'),button=root.querySelector('button'),note=root.querySelector('p');let chat=null,key=null,busy=false,working=false,observing=false,appearance=null;
 const appearanceBox=document.createElement('fieldset');appearanceBox.hidden=true;appearanceBox.style.cssText='margin:8px;border:1px solid var(--SmartThemeBorderColor,#666);border-radius:6px;padding:8px';
 const legend=document.createElement('legend');legend.textContent='Appearance';appearanceBox.append(legend);const sliders={};
 const colorsLabel=document.createElement('label'),colors=document.createElement('input');colors.type='checkbox';colors.setAttribute('aria-label','Character colours');colorsLabel.append(colors,document.createTextNode(' Character colours'));colorsLabel.style.cssText='display:block;margin:8px 0';colorsLabel.hidden=true;appearanceBox.append(colorsLabel);
 const values=()=>({...Object.fromEntries(Object.entries(sliders).map(([name,{input}])=>[name,Number(input.value)])),...(appearance?.hasColors?{colors:colors.checked}:{})});
 colors.addEventListener('change',()=>{appearance?.preview(values());appearance?.commit(values());});
 for(const [name,title]of [['dialogue','Dialogue background'],['status','Status background']]){
  const label=document.createElement('label'),caption=document.createElement('span'),output=document.createElement('output'),input=document.createElement('input');label.style.cssText='display:block;margin:4px 0 10px';caption.textContent=title+' ';input.type='range';input.min='0';input.max='100';input.step='1';input.setAttribute('aria-label',title);input.style.cssText='display:block;width:100%;margin:6px 0';
  const readout=()=>{output.value=input.value+'%';input.setAttribute('aria-valuetext',input.value+'% opaque');};
  input.addEventListener('input',()=>{readout();appearance?.preview(values());});input.addEventListener('change',()=>appearance?.commit(values()));label.append(caption,output,input);appearanceBox.append(label);sliders[name]={input,readout};
 }
 const reset=document.createElement('button');reset.type='button';reset.textContent='Reset appearance';reset.addEventListener('click',()=>{if(!appearance)return;appearance.reset();showAppearance(appearance.defaults);});appearanceBox.append(reset);root.querySelector('.body').append(appearanceBox);
 function showAppearance(value){for(const [name,control]of Object.entries(sliders)){control.input.value=String(value[name]);control.readout();}colors.checked=value.colors!==false;}
 function layout(){if(!chat?.isConnected)return;const gutter=window.innerWidth-chat.getBoundingClientRect().right;host.style.right=gutter>=264?'12px':'8px';if(key===null)tray.open=gutter>=264;}
 const observer=typeof ResizeObserver==='function'?new ResizeObserver(layout):null;
 button.addEventListener('click',async()=>{if(busy||working)return;working=true;button.disabled=true;note.hidden=true;try{await rebuild();note.textContent='Scene state rebuilt.';}catch(e){note.textContent=e.message;}finally{working=false;button.disabled=busy;note.hidden=false;}});
 function clear(){host.remove();observer?.disconnect();if(observing)window.removeEventListener('resize',layout);observing=false;chat=null;key=null;note.hidden=true;appearance=null;appearanceBox.hidden=true;}
 function update({chat:next,key:nextKey,music,information,stateEnabled,generating,appearance:nextAppearance}){
  const children=[music,information].filter(Boolean);if(!children.length&&!stateEnabled&&!nextAppearance){clear();return;}
  appearance=nextAppearance??null;appearanceBox.hidden=!appearance;colorsLabel.hidden=!appearance?.hasColors;if(appearance&&(key!==nextKey||!Object.values(sliders).some(c=>c.input===root.activeElement)))showAppearance(appearance.values);
  if(chat!==next){observer?.disconnect();chat=next;observer?.observe(chat);}
  if(!observing){window.addEventListener('resize',layout);observing=true;}
  if(!host.isConnected)document.body.append(host);
  for(const child of Array.from(host.children))if(!children.includes(child))child.remove();
  for(const child of children)if(child.parentNode!==host)host.append(child);
  if(key!==nextKey){key=null;note.hidden=true;layout();key=nextKey;}
  busy=generating;button.hidden=!stateEnabled;button.disabled=busy||working;
 }
 return {host,update,clear,dispose:clear};
}
