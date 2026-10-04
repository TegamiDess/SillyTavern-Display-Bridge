import {test} from 'node:test';
import assert from 'node:assert/strict';
import {displayProvenance,isDisplayAssistant} from '../core/message-visibility.js';

test('Display retains owned hidden assistants without admitting system notes or hidden users',()=>{
    const provenance=displayProvenance({display_bridge_story:{records:[{message:'accepted'}]},summaryception:{ghostedMessageIds:['owned','system','user']}});
    assert.equal(isDisplayAssistant({is_system:true,display_bridge_message_id:'accepted'},provenance),true);
    assert.equal(isDisplayAssistant({is_system:true,sc_id:'owned'},provenance),true);
    assert.equal(isDisplayAssistant({is_system:true,sc_id:'other',mes:'<#1><img src="background.png">'},provenance),false);
    assert.equal(isDisplayAssistant({is_system:true,sc_id:'system',extra:{type:'system'}},provenance),false);
    assert.equal(isDisplayAssistant({is_system:true,is_user:true,sc_id:'user'},provenance),false);
    assert.equal(isDisplayAssistant({mes:'Normal assistant'},provenance),true);
    assert.equal(isDisplayAssistant({is_system:true,sc_id:'owned'},displayProvenance()),false);
    assert.equal(isDisplayAssistant({is_system:true},displayProvenance({display_bridge_story:{records:[null,{}]},summaryception:{ghostedMessageIds:[null,undefined,'']}})),false);
    assert.equal(isDisplayAssistant({is_system:true},displayProvenance({display_bridge_story:{records:{}},summaryception:{ghostedMessageIds:'bad'}})),false);
});
