import { captureDisplaySource } from './display-handoff.js';
export async function runRecognitionTests({test,assert,setup,wait,ctx,characters,extension_settings,bridge}) {
 const rule={type:'editdisplay',in:String.raw`\[Talk\|words:([^\]|]+)\|picture:([^|\]]*)\|who:([^|\]]+?)\]`,out:`<figure class='scene'><img src='{{asset::$2}}' alt='$3'/><figcaption><strong>$3</strong><p>$1</p></figcaption></figure>`,ableFlag:true,flag:'g'};
 const text='[Talk|words:Welcome to the museum.|picture:guide|who:Robin]';
 const source=rules=>captureDisplaySource({data:{extensions:{risuai:{customScripts:rules}}}});
 const envelope=rules=>({handoffVersion:1,avatar:'test-b.png',importId:crypto.randomUUID(),source:source(rules),images:{status:'mapped',mapped:0,issues:[]}});
 await test('Source recognition creates a mapped preset through importer handoff without an embedded profile',async()=>{
  setup(text,{stream:false});const before=ctx.chat[0].mes;const result=bridge().api.receiveImport(envelope([rule]));assert(result.status==='applied');ctx.characterId=1;bridge().render();await wait();const root=document.querySelector('.display-bridge-widget')?.shadowRoot;assert(root?.querySelector('.name').textContent==='Robin');assert(root.querySelector('.words').textContent==='Welcome to the museum.');assert(ctx.chat[0].mes===before);
  const report=bridge().compatibility();assert(!report.discovery.explicitProfile&&report.discovery.rules[0].status==='adapted');assert(report.discovery.rules[0].reason.includes('bindings'));assert(bridge().exportProfile('test-b.png').adapters[0].source.format.fields.portrait==='picture');
 });
 await test('Unsupported source flags and competing layouts remain unenabled with specific compatibility reasons',()=>{
  setup(text,{stream:false});const bad={...rule,flag:'i'};const result=bridge().api.receiveImport(envelope([bad]));assert(result.status==='unsupported');ctx.characterId=1;bridge().render();let report=bridge().compatibility();assert(!report.enabled&&!document.querySelector('.display-bridge-widget'));assert(report.discovery.rules[0].reason.includes('flags'));
  const second={...rule,in:rule.in.replace('Talk','Other')};const conflict=bridge().api.receiveImport(envelope([rule,second]));assert(conflict.status==='unsupported');report=bridge().compatibility();assert(report.discovery.rules.every(r=>r.status==='not-translated'));assert(report.notes.some(n=>n.includes('needs review')));
 });
 await test('A CHARX without profile metadata imports images and discovers its reordered source bindings',async()=>{
  setup(undefined,{stream:false});const start=characters.length,avatar='recognized-portrait.png';
  const input={spec:'chara_card_v3',spec_version:'3.0',data:{name:'Neutral recognized portrait',first_mes:text,assets:[{type:'image',name:'guide',uri:'embeded://assets/guide.png',ext:'png'}],extensions:{risuai:{customScripts:[rule]}}}};
  const imported={name:input.data.name,avatar,data:{extensions:{regex_scripts:[]}}};let uploaded=0;
  window.fixtureImport={drop:async()=>characters.push(imported),fetch:async(url,options)=>{
   const body=JSON.parse(options?.body??'{}'),response=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
   if(url==='/api/files/sanitize-filename')return response({fileName:body.fileName});if(url==='/api/images/folders')return response([]);if(url==='/api/characters/get')return response(imported);if(url==='/api/files/upload'){uploaded++;return response({path:'user/files/recognized-guide.png'});}if(String(url).startsWith('/api/'))throw Error('Unexpected mock API '+url);return globalThis.fetch(url,options);
  }};
  try{const zip=new JSZip();zip.file('card.json',JSON.stringify(input));zip.file('assets/guide.png',Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='),x=>x.charCodeAt(0)));const result=await window.v3sprites.import(new File([await zip.generateAsync({type:'uint8array'})],'recognized.charx'));assert(result.ui.status==='applied'&&uploaded===1);const profile=bridge().exportProfile(avatar);assert(profile.adapters[0].source.format.fields.speaker==='who');assert(extension_settings.display_bridge.profiles[avatar].enabled);
  }finally{delete window.fixtureImport;characters.splice(start);}
 });
}
