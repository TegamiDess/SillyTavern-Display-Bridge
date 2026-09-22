import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatReferenceSaver} from '../integrations/chat-reference.js';

function fixture() {
    const card={avatar:'fixture.png',create_date:'stamp',json_data:JSON.stringify({data:{name:'Fixture'}})};
    const ctx={characters:[card],characterId:0,chatId:'generated-chat'};
    let remote=structuredClone(card);const writes=[],errors=[];
    const args={getContext:()=>ctx,readCharacter:async()=>structuredClone(remote),writeReference:async(avatar,chat)=>{writes.push({avatar,chat});remote.json_data=JSON.stringify({...JSON.parse(remote.json_data),chat});},report:e=>errors.push(e)};
    return {ctx,card,writes,errors,args,remote:()=>remote};
}
test('First display choice pins only a missing native chat reference; reload uses the same chat',async()=>{
    const f=fixture(),remember=createChatReferenceSaver(f.args);
    assert.equal(await remember('fixture.png','generated-chat'),true);
    assert.deepEqual(f.writes,[{avatar:'fixture.png',chat:'generated-chat'}]);
    assert.deepEqual(JSON.parse(f.card.json_data),{data:{name:'Fixture'},chat:'generated-chat'});
    f.ctx.characters=[structuredClone(f.remote())];
    assert.equal(await remember('fixture.png','generated-chat'),false);
    assert.equal(f.writes.length,1);
});
test('Chat-reference save never overwrites existing pointers or guesses unreadable, duplicate, group or replaced cards',async()=>{
    for(const mutate of [
        f=>f.remote().json_data=JSON.stringify({chat:'existing-chat'}),
        f=>f.card.json_data='broken',
        f=>f.ctx.characters.push({...f.card}),
        f=>f.ctx.groupId='group',
        f=>f.remote().create_date='replacement',
    ]) {const f=fixture();mutate(f);assert.equal(await createChatReferenceSaver(f.args)('fixture.png','generated-chat'),false);assert.equal(f.writes.length,0);}
});
test('Deferred chat-reference reads cannot follow a character/chat switch; repeated saves coalesce',async()=>{
    const f=fixture();let resolve;
    const firstRead=new Promise(r=>resolve=r);let reads=0;
    f.args.readCharacter=()=>++reads===1?firstRead:Promise.resolve(structuredClone(f.remote()));
    const remember=createChatReferenceSaver(f.args),a=remember('fixture.png','generated-chat'),b=remember('fixture.png','generated-chat');
    assert.equal(a,b);f.ctx.chatId='other-chat';resolve(structuredClone(f.remote()));await a;assert.equal(f.writes.length,0);
});
test('Failed native pointer writes are reported without discarding saved presentation preferences',async()=>{
    const f=fixture();f.args.writeReference=async()=>{throw Error('offline');};
    assert.equal(await createChatReferenceSaver(f.args)('fixture.png','generated-chat'),false);
    assert.equal(f.errors.length,1);assert.equal(JSON.parse(f.card.json_data).chat,undefined);
});
