import {setupNativeValues,verifySetupBindings,commitSetupBindings,setupGreeting,sameSetupText} from '../adapters/scene-setup.js';
import {createStoryJournal,STORY_KEY,MESSAGE_KEY} from '../core/story-journal.js';
import {parseStoryUpdates,applyStory,initialStory,storySnapshot,storyContext} from '../adapters/scene-state.js';
import {parsePortraitDialogue} from '../adapters/portrait-dialogue.js';
import {projectSourceRequest} from '../adapters/scene-source-context.js';
import {sceneScoreCaptionRanges} from '../adapters/scene-fragments.js';

// Host mutations happen only at explicit initialization or accepted message events.
// Render reads the cached projection; it never commits an update.
export function createStoryState({getContext,scope,changed=()=>{}}){
 let cache=null,attempt=null,busy=false,saving=false,serial=Promise.resolve();
 const contextKey='display_bridge_scene_state';
 const warnedEntities=new Set();let warningScope=null;
 function reportIgnored(text,p){
  const key=JSON.stringify(p.owner);if(warningScope!==key){warningScope=key;warnedEntities.clear();}
  parseStoryUpdates(text,p.state,p.config.format?.kind==='scene-fragments'?sceneScoreCaptionRanges(text):[],({entity})=>{
   if(warnedEntities.has(entity)||warnedEntities.size>=128)return;warnedEntities.add(entity);
   console.warn('[Display Bridge] Ignored location update for '+JSON.stringify(entity)+': no matching character in this profile. Valid updates were retained.');
  });
 }
 function parameters(){const s=scope();if(!s?.config?.sceneState)return null;const ctx=getContext(),chat=ctx.chatId??ctx.getCurrentChatId?.();if(!chat||!ctx.chatMetadata)return null;return {...s,ctx,owner:[s.identity,chat],state:s.config.sceneState};}
 function parse(text,p,onIgnored){
  const updates=parseStoryUpdates(text,p.state,p.config.format?.kind==='scene-fragments'?sceneScoreCaptionRanges(text):[],onIgnored);
  for(const b of parsePortraitDialogue(text,p.config).blocks){
   if(b.sceneSnapshot||b.snapshotIssue)throw Error('Scene state: explicit snapshots cannot be mixed with stored state; use declared updates.');
   if(b.presentation==='scene'&&p.state.track&&Object.hasOwn(p.state.backgroundTracks??{},b.background))updates.push({start:b.start,end:b.start,key:p.state.track,value:p.state.backgroundTracks[b.background],op:'set'});
  }
  return updates.sort((a,b)=>a.start-b.start);
 }
 function journal(p,saved=p.ctx.chatMetadata[STORY_KEY],ignored){return createStoryJournal({config:p.state,owner:p.owner,saved,parse:text=>parse(text,p,ignored?d=>{if(!ignored.has(text))ignored.set(text,[]);ignored.get(text).push({start:d.start,end:d.end});}:undefined)});}
 function invalidate(){cache=null;changed();}
 function read(){
  const p=parameters();if(!p)return null;
  // ST can restore a failed swipe after GENERATION_ENDED without emitting
  // MESSAGE_SWIPED again. Observe the tail revision without rescanning history
  // on every streamed token, or trusting an uncommitted replacement.
  const last=p.ctx.chat.at(-1),lastSource=busy?null:last?.mes,swipe=last?.swipe_id,length=p.ctx.chat.length;
  if(cache?.chat===p.ctx.chat&&cache.config===p.config&&cache.saved===p.ctx.chatMetadata[STORY_KEY]&&cache.last===last&&cache.lastSource===lastSource&&cache.swipe===swipe&&cache.length===length)return cache.result;
  if(cache)changed();
  let result;try{if(!p.ctx.chatMetadata[STORY_KEY])throw Error('Initialize this chat’s reviewed scene state before generating.');const ignored=new Map(),j=journal(p,p.ctx.chatMetadata[STORY_KEY],ignored);result={...j.read(p.ctx.chat),choice:j.save().choice};for(const [m,v] of result.views)v.cleanup=[...v.updates,...ignored.get(m.mes)??[]];}catch(e){result={values:null,views:new Map(),issue:e.message};}
  cache={chat:p.ctx.chat,config:p.config,saved:p.ctx.chatMetadata[STORY_KEY],last,lastSource,swipe,length,result};return result;
 }
 async function persist(p,j){
  if(getContext().chat!==p.ctx.chat)throw Error('Chat changed before state save');
  const saved=j.save(),old=p.ctx.chatMetadata[STORY_KEY];
  const undoBindings=p.state.setup?commitSetupBindings(p.ctx.chatMetadata,setupNativeValues(initialStory(p.state,saved.choice),p.state.setup),JSON.stringify(p.owner)):()=>{};
  p.ctx.chatMetadata[STORY_KEY]=saved;
  saving=true;
  try{if(typeof p.ctx.saveChat!=='function')throw Error('This host cannot save scene state');await p.ctx.saveChat();}
  catch(e){undoBindings();if(old===undefined)delete p.ctx.chatMetadata[STORY_KEY];else p.ctx.chatMetadata[STORY_KEY]=old;throw e;}
  finally{saving=false;invalidate();}
 }
 function enqueue(fn){const next=serial.then(fn);serial=next.catch(()=>{});return next;}
 function rebuild(choice=null,{start=false}={}){
  const requested=parameters(),requestedChat=requested?.ctx.chat,selection=choice===null?null:structuredClone(choice);
  return enqueue(async()=>{
  const p=parameters();if(!p)throw Error('Enable a scene-state profile in a saved single-character chat first.');
  if(!requested||requestedChat!==p.ctx.chat||requested.config!==p.config||JSON.stringify(requested.owner)!==JSON.stringify(p.owner))throw Error('Chat or profile changed before setup save.');
  choice=selection;
  if(busy)throw Error('Finish or stop generation before rebuilding state.');
  if(p.state.setup){const saved=p.ctx.chatMetadata[STORY_KEY]?.choice;choice=choice??saved;if(!choice)throw Error('Choose the setup values first.');if(p.ctx.chat.length!==1&&(!saved||p.state.setup.fields.some(f=>choice[f.key]!==saved[f.key])))throw Error('Changing setup requires a fresh chat.');initialStory(p.state,choice);}
  const first=p.ctx.chat[0],oldText=first?.mes,c=p.state.startup?.choices.find(c=>c.id===choice),screen=p.state.setup?.screen;
  let replace=false,nextText;
  if(start&&!screen)throw Error('This profile has no startup screen.');
  if(screen){
   const saved=p.ctx.chatMetadata[STORY_KEY]?.choice,changed=!saved||p.state.setup.fields.some(f=>saved[f.key]!==choice[f.key]);
   const fresh=p.ctx.chat.length===1&&first&&!first.is_user&&!first.is_system&&!first.extra?.display_text;
   if(start&&(!fresh||!sameSetupText(oldText,screen.marker)))throw Error('Start requires a fresh chat containing its exact menu marker.');
   if(!saved||changed||start){
    if(!fresh||(!sameSetupText(oldText,screen.marker)&&(!saved||!sameSetupText(oldText,setupGreeting(initialStory(p.state,saved),p.state.setup)))))throw Error('Setup can only replace its unchanged greeting in a fresh chat.');
    nextText=setupGreeting(initialStory(p.state,choice),p.state.setup);replace=true;
   }
  }
  const oldSwipes=first?.swipes?first.swipes.slice():null;
  if(p.state.startup){if(!c)throw Error('Choose a starting branch');replace=p.ctx.chat.length===1&&!p.ctx.chat[0].is_user&&oldText===p.state.startup.marker;if(!replace&&p.ctx.chatMetadata[STORY_KEY]?.choice!==choice)throw Error('A startup choice requires a fresh chat containing its exact marker.');if(replace){p.ctx.chat[0].mes=c.text;if(Array.isArray(p.ctx.chat[0].swipes))p.ctx.chat[0].swipes[p.ctx.chat[0].swipe_id??0]=c.text;}}
  if(screen&&replace){first.mes=nextText;if(Array.isArray(first.swipes)){const slot=first.swipe_id??0;if(!Number.isInteger(slot)||slot<0||slot>=first.swipes.length){first.mes=oldText;throw Error('Finish the pending greeting swipe before setup.');}first.swipes[slot]=nextText;}}
  const messageIds=p.ctx.chat.map(m=>[m,m[MESSAGE_KEY]]);
  try{const j=journal(p,null);j.rebuild(p.ctx.chat,choice);const accepted=p.ctx.chat.filter(m=>!m.is_user&&!m.is_system).map(m=>m.mes);await persist(p,j);for(const text of accepted)reportIgnored(text,p);}
  catch(e){for(const [m,id] of messageIds){if(id===undefined)delete m[MESSAGE_KEY];else m[MESSAGE_KEY]=id;}if(replace){first.mes=oldText;if(oldSwipes)first.swipes=oldSwipes;invalidate();}throw e;}
  // A redraw failure must not undo a greeting already saved to disk.
  if(replace&&getContext().chat===p.ctx.chat)await p.ctx.reloadCurrentChat?.();
  return read();
 });}
 function received(index,type){if(type==='first_message'){invalidate();return Promise.resolve();}const eventScope=parameters(),eventAttempt=attempt;return enqueue(async()=>{
  const p=parameters();if(!p||p.ctx.chat!==eventScope?.ctx.chat||attempt!==eventAttempt)return;
  const streaming=p.ctx.streamingProcessor;
  if(attempt?.chat!==p.ctx.chat||attempt?.config!==p.config||attempt?.identity!==p.identity||attempt?.cancelled||streaming&&(streaming.abortController?.signal?.aborted||streaming.isStopped))return;
  if(type==='first_message'||!p.ctx.chatMetadata[STORY_KEY]){invalidate();return;}
  const j=journal(p);if(j.accept(p.ctx.chat,index)){const accepted=p.ctx.chat[index].mes;await persist(p,j);reportIgnored(accepted,p);}else invalidate();
 });}
 function begin(type,_options,dryRun){
  if(dryRun)return;const p=parameters();if(!p)return;
  if(saving)throw Error('Wait for scene setup to finish saving.');
  if(p.ctx.onlineStatus==='no_connection')return;
  invalidate();const r=read(),replacing=['swipe','regenerate','continue'].includes(type),last=p.ctx.chat.at(-1);
  if(r?.issue&&!(replacing&&r.index===p.ctx.chat.length-1))throw Error(r.issue);
  const requestValues=replacing&&!last?.is_user?r.views.get(last)?.before??r.values:r.values;
  attempt={chat:p.ctx.chat,config:p.config,identity:p.identity,type,requestValues,cancelled:false};busy=true;
 }
 function cancel(){if(attempt)attempt.cancelled=true;busy=false;invalidate();}
 function end(){busy=false;invalidate();}
 function switched(){attempt=null;busy=false;warningScope=null;warnedEntities.clear();invalidate();getContext().setExtensionPrompt?.(contextKey,'',1,0);}
 function project(message,plan){
  const p=parameters();if(!p)return plan;const r=read(),view=r?.views.get(message);
  const scenes=plan.items.filter(i=>i.presentation==='scene');
  for(const item of scenes){
   if(!view||message.extra?.display_text&&message.extra.display_text!==message.mes){item.sceneSnapshot={};item.snapshotIssue=r?.issue??'State is unavailable for an uncommitted or independently modified display';continue;}
   const values=item===scenes.at(-1)?view.after:applyStory(view.before,view.updates.filter(u=>u.end<=item.end),p.state);
   item.sceneSnapshot=storySnapshot(values,p.state,item.background);
  }
  return plan;
 }
 function context(){const p=parameters(),r=read();if(!p)return '';if(saving)throw Error('Wait for scene setup to finish saving.');if(p.state.setup){if(r.issue)throw Error(r.issue);verifySetupBindings(p.ctx.chatMetadata,setupNativeValues(r.values,p.state.setup),JSON.stringify(p.owner));}if(busy&&attempt?.chat===p.ctx.chat&&attempt.config===p.config)return storyContext(attempt.requestValues,p.state);if(r.issue)throw Error(r.issue);return storyContext(r.values,p.state);}
 function prepare(_type,_options,dryRun){
  const ctx=getContext(),p=parameters();
  try{const text=p?context():'';ctx.setExtensionPrompt?.(contextKey,p?.state.request?'':text,1,0,false,0);}
  catch(e){ctx.setExtensionPrompt?.(contextKey,'',1,0,false,0);if(!dryRun){cancel();ctx.stopGeneration?.();throw e;}}
 }
 function intercept(messages,_size,abort){
  const p=parameters();if(!p||(!p.state.request&&!p.state.setup))return;
  try{const text=context();if(!p.state.request)return;p.ctx.setExtensionPrompt?.(contextKey,'',1,0,false,0);if(messages===p.ctx.chat)throw Error('The host supplied live history instead of a request copy');const projected=projectSourceRequest(messages,p.state.request,text);messages.splice(0,messages.length,...projected);}
  catch(e){abort?.(true);cancel();throw e;}
 }
 return {read,project,rebuild,startSetup:choice=>rebuild(choice,{start:true}),received,begin,cancel,end,switched,invalidate,prepare,context,intercept,stop:switched};
}
