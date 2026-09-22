import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createRecovery,canonical,isolateNativeCard} from '../../v3-asset-sprites/recovery.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
function harness(){let record=null,state={cardRevision:'a',settingsRevision:'a'},selected='card.png',approve=true,restores=0;
 const api=createRecovery({load:async()=>structuredClone(record),save:async r=>{record=structuredClone(r);},capture:async()=>structuredClone(state),restore:async(a,s)=>{state=structuredClone(s);restores++;},confirm:async()=>approve,selected:()=>selected,lock:async(a,f)=>f()});
 return {api,get record(){return record;},get restores(){return restores;},set state(v){state=v;},set selected(v){selected=v;},set approve(v){approve=v;}};
}
test('Recovery point precedes mutation and restores only its verified result',async()=>{const h=harness();await h.api.run('card.png','replace',async checkpoint=>{assert.equal(h.record.status,'prepared');await checkpoint(async()=>{assert.equal(h.record.status,'writing');h.state={cardRevision:'b',settingsRevision:'b'};});});assert.equal(h.record.status,'complete');await h.api.undo('card.png');assert.equal(h.restores,1);assert.equal(h.record.status,'restored');await assert.rejects(h.api.undo('card.png'),/already/);});
test('Cancelled replacement and restore do not change stored state',async()=>{const h=harness();h.approve=false;assert.equal(await h.api.run('card.png','replace',()=>assert.fail()),null);assert.equal(h.record,null);h.approve=true;await h.api.run('card.png','replace',async()=>{});h.approve=false;await h.api.undo('card.png');assert.equal(h.restores,0);assert.equal(h.record.status,'complete');});
test('Later card edits, settings edits and selected-character changes block rollback',async()=>{for(const state of [{cardRevision:'new',settingsRevision:'a'},{cardRevision:'a',settingsRevision:'new'}]){const h=harness();await h.api.run('card.png','replace',async()=>{});h.state=state;await assert.rejects(h.api.undo('card.png'),/changed/);assert.equal(h.restores,0);}const h=harness();await h.api.run('card.png','replace',async()=>{});h.selected='other.png';await assert.rejects(h.api.undo('card.png'),/original character/);});
test('Interrupted writes retain backup and block automatic retries or rollback',async()=>{const h=harness();await assert.rejects(h.api.run('card.png','replace',checkpoint=>checkpoint(()=>{throw Error('Connection lost');})),/kept/);assert.equal(h.record.status,'writing');await assert.rejects(h.api.undo('card.png'),/unverified/);await assert.rejects(h.api.run('card.png','replace',()=>{}),/unfinished/);});
test('A failure before a write remains recoverable',async()=>{const h=harness();await assert.rejects(h.api.run('card.png','replace',()=>{throw Error('Bad image');}),/kept/);assert.equal(h.record.status,'failed');await h.api.undo('card.png');assert.equal(h.restores,1);});
test('Native import isolates every original asset including expressions, backgrounds and misleading icon aliases',()=>{const source={spec:'chara_card_v3',data:{name:'Example',assets:[{type:'image',uri:'embedded://v3-import-avatar.png'},{type:'expression',uri:'embedded://happy.png'},{type:'background',uri:'embedded://room.png'},{type:'icon',uri:'embedded://main.png'}]}};const before=JSON.stringify(source),card=isolateNativeCard(source,'png');assert.equal(JSON.stringify(source),before);assert.equal(card.data.assets.filter(a=>a.uri.startsWith('embedded://')).length,1);assert.equal(card.data.assets[0].type,'icon');assert(card.data.assets.slice(1).every(a=>a.uri.startsWith('v3-isolated://')));});
test('Canonical comparison is independent of object-key ordering but preserves array order',()=>{assert.equal(canonical({b:1,a:2}),canonical({a:2,b:1}));assert.notEqual(canonical([1,2]),canonical([2,1]));});
test('Later image-byte changes block restoration even when its path is unchanged',async()=>{const h=harness();h.state={cardRevision:'a',settingsRevision:'a',imagesRevision:'red'};await h.api.run('card.png','replace',async()=>{});h.state={cardRevision:'a',settingsRevision:'a',imagesRevision:'blue'};await assert.rejects(h.api.undo('card.png'),/changed/);assert.equal(h.restores,0);});
test('Reviewed keep closes an interrupted point without restoring and permits a new operation',async()=>{const h=harness();await assert.rejects(h.api.run('card.png','replace',checkpoint=>checkpoint(()=>{throw Error('Lost');})));await h.api.keep('card.png');assert.equal(h.record.status,'kept');assert.equal(h.restores,0);await h.api.run('card.png','replace',async()=>{});assert.equal(h.record.status,'complete');});
test('A failed durable backup prevents every mutation',async()=>{let touched=false;const api=createRecovery({load:async()=>null,save:async()=>{throw Error('Disk full');},capture:async()=>({cardRevision:'a',settingsRevision:'a'}),selected:()=> 'a',confirm:async()=>true,lock:async(a,f)=>f()});await assert.rejects(api.run('a','replace',()=>{touched=true;}),/Disk full/);assert.equal(touched,false);});
test('Edits during confirmation are detected before creating a journal or writing a card',async()=>{let cardRevision='a',writes=0;const api=createRecovery({load:async()=>null,save:async()=>{writes++;},capture:async()=>({cardRevision,settingsRevision:'a'}),selected:()=> 'a',confirm:async()=>{cardRevision='b';return true;},lock:async(a,f)=>f()});await assert.rejects(api.run('a','replace',()=>assert.fail()),/during review/);assert.equal(writes,0);});

test('Isolated legacy imports preserve creator notes and native extension fields',()=>{const source={name:'Legacy',creatorcomment:'Notes',talkativeness:0.7,fav:true,depth_prompt_prompt:'Depth',depth_prompt_depth:3};const card=isolateNativeCard(source);assert.equal(card.spec,'chara_card_v2');assert.equal(card.data.creator_notes,'Notes');assert.equal(card.data.extensions.talkativeness,0.7);assert.equal(card.data.extensions.depth_prompt.depth,3);assert.equal(source.data,undefined);assert.equal(isolateNativeCard({data:{name:'Wrapped'}}).spec,'chara_card_v2');});

test('Edits after the last verified checkpoint are never adopted as replacement output',async()=>{
 const h=harness();
 await assert.rejects(h.api.run('card.png','replace',async checkpoint=>{
  await checkpoint(async()=>{h.state={cardRevision:'b',settingsRevision:'b'};});
  h.state={cardRevision:'user-edit',settingsRevision:'b'};
 }),/changed/);
 assert.equal(h.record.expected.cardRevision,'b');
 await assert.rejects(h.api.undo('card.png'),/changed/);
 assert.equal(h.restores,0);
});

test('Changes while the writing journal is being saved block the pending native mutation',async()=>{
 let state={cardRevision:'a',settingsRevision:'a'},record,writes=0;
 const api=createRecovery({load:async()=>null,save:async r=>{record=structuredClone(r);if(r.status==='writing')state={...state,cardRevision:'external-edit'};},capture:async()=>structuredClone(state),selected:()=> 'card.png',confirm:async()=>true,lock:async(a,f)=>f()});
 await assert.rejects(api.run('card.png','replace',checkpoint=>checkpoint(async()=>{writes++;})),/changed/);
 assert.equal(writes,0);assert.equal(record.expected.cardRevision,'a');
});

test('Changes while the restore journal is being saved cannot be overwritten',async()=>{
 let state={cardRevision:'a',settingsRevision:'a'},record,restores=0;
 const api=createRecovery({load:async()=>structuredClone(record),save:async r=>{record=structuredClone(r);if(r.status==='restoring')state={...state,cardRevision:'external-edit'};},capture:async()=>structuredClone(state),restore:async()=>{restores++;},selected:()=> 'card.png',confirm:async()=>true,lock:async(a,f)=>f()});
 await api.run('card.png','replace',async checkpoint=>checkpoint(async()=>{state={cardRevision:'b',settingsRevision:'b'};}));
 await assert.rejects(api.undo('card.png'),/changed/);assert.equal(restores,0);
});
