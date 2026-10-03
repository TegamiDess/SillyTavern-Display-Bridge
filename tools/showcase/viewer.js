import {createPortraitDialogue} from '../../display-bridge/components/portrait-dialogue.js';
import {createChatDock} from '../../display-bridge/components/chat-dock.js';
const data=JSON.parse(document.getElementById('scene-data').textContent);
const q=s=>document.querySelector(s),el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const container=q('#rounds'),jump=q('#jump'),readAll=q('#read-all'),widgets=[],sections=[];
const compactStyle=`.toolbar,.console{display:none!important}:host{margin:0}article{color:#eff3f8}.words{scrollbar-color:#94a7bc #26313e}article.demo-still .cast-slot img,article.demo-still .scene-layer{animation:none!important}`;
for(const round of data.rounds){
 const option=el('option',`${String(round.number).padStart(2,'0')} · ${round.title}`);option.value=String(round.number);jump.append(option);
 const section=el('section');section.className='round';section.id='round-'+round.number;
 const kicker=el('div',`EXCHANGE ${String(round.number).padStart(2,'0')} / 10`);kicker.className='eyebrow';
 const heading=el('h2',round.title);heading.tabIndex=-1;
 const prompt=el('blockquote',round.prompt);prompt.className='prompt';
 const promptLabel=el('div','ALEX · PLAYER PROMPT');promptLabel.className='prompt-label';
 section.append(kicker,heading,promptLabel,prompt);
 round.scenes.forEach((scene,index)=>{
  const frame=el('section');frame.className='scene-frame';frame.setAttribute('aria-label',`Round ${round.number}, scene ${index+1}`);
  const caption=el('div',`SCENE ${index+1} OF ${round.scenes.length} · ${scene.period??''}`);caption.className='scene-caption';frame.append(caption);
  const widget=createPortraitDialogue({...scene,config:data.config,controls:false,animateEntrance:false},{resolver:(_,ref)=>data.images[ref]?{status:'resolved',url:data.images[ref]}:{status:'missing'}});
  const style=el('style',compactStyle);widget.host.shadowRoot.append(style);frame.append(widget.host);widgets.push(widget);section.append(frame);
 });
 const details=el('details');details.className='roster';details.append(el('summary','Recorded character state after this reply'));
 details.append(el('p','Affection, location and relationship values recorded by the card. Source labels are retained.'));
 const wrap=el('div');wrap.className='table-wrap';const table=el('table');const head=el('tr');for(const title of ['Character','Affection','Location','Relationship'])head.append(el('th',title));table.append(head);
 for(const row of round.roster){const tr=el('tr');for(const value of [row.id,row.score,row.location,row.relationship])tr.append(el('td',String(value??'Unavailable')));table.append(tr);}wrap.append(table);details.append(wrap);section.append(details);
 container.append(section);sections.push(section);
}
let active=1,all=false;
const dock=createChatDock({rebuild:async()=>{}}),information=el('button','Character information');information.type='button';information.style.cssText='margin:8px;font-size:13px';
information.addEventListener('click',()=>{const roster=sections[active-1].querySelector('.roster');roster.open=true;roster.querySelector('summary').focus();roster.scrollIntoView({behavior:'instant',block:'center'});});
let appearance={dialogue:80,status:92,colors:true};
function applyAppearance(value){appearance={...value};for(const widget of widgets){widget.host.style.setProperty('--db-dialogue-alpha',value.dialogue+'%');widget.host.style.setProperty('--db-status-alpha',value.status+'%');widget.host.style.setProperty('--db-speaker-strength',value.colors?'100%':'0%');widget.host.style.setProperty('--db-speaker-shadow',value.colors?'var(--speaker-shadow)':'none');}}
function updateDock(){dock.update({chat:container,key:'showcase',information,stateEnabled:false,generating:false,appearance:{hasColors:true,values:appearance,defaults:{dialogue:80,status:92,colors:true},preview:applyAppearance,commit:applyAppearance,reset:()=>applyAppearance({dialogue:80,status:92,colors:true})}});q('#scene-controls').append(dock.host);}
dock.host.style.cssText='position:static;display:block;width:100%;max-width:100%;margin-top:14px;--SmartThemeBodyColor:#e6edf6;--SmartThemeBorderColor:#4f637b;--SmartThemeBlurTintColor:#202d40';
const dockStyle=el('style','details:not([open]){margin-left:0}.body{max-width:440px}fieldset{font-size:13px}');dock.host.shadowRoot.append(dockStyle);
function navigate(value,focus=false){active=Math.max(1,Math.min(10,Number(value)||1));jump.value=String(active);sections.forEach((s,i)=>s.hidden=!all&&i!==active-1);q('#previous').disabled=active===1;q('#next').disabled=active===10;q('#position').textContent=`Exchange ${active} of 10`;updateDock();if(focus){sections[active-1].querySelector('h2').focus({preventScroll:true});sections[active-1].scrollIntoView({behavior:'instant',block:'start'});}}
jump.addEventListener('change',()=>navigate(jump.value,true));q('#previous').addEventListener('click',()=>navigate(active-1,true));q('#next').addEventListener('click',()=>navigate(active+1,true));
readAll.addEventListener('change',()=>{all=readAll.checked;navigate(active,true);});
q('#motion').addEventListener('change',e=>{for(const widget of widgets)widget.host.shadowRoot.querySelector('article').classList.toggle('demo-still',!e.target.checked);});
applyAppearance(appearance);
navigate(1);dock.host.shadowRoot.querySelector('details').open=false;q('#loading').remove();q('#reader').hidden=false;
window.addEventListener('error',()=>{q('#error-note').hidden=false;});
