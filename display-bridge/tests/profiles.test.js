import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProfile, discoverProfile, profileConflicts, profileFromSettings } from '../core/profiles.js';
import { sourceOrigin } from '../core/compatibility.js';

const definition = {kind:'display-bridge-profile',schemaVersion:1,adapters:[{id:'media-panel',version:1},{id:'gallery',version:1}]};
test('Portable definitions round-trip only reviewed adapter configuration',()=>{
    const profile = validateProfile(definition);
    assert.deepEqual(profile,definition);
    assert.notEqual(profile,definition);
    assert.deepEqual(profileFromSettings({adapters:['media-panel','gallery'],enabled:false,avatar:'private.png',variables:{secret:42}}),definition);
});
test('Unknown versions, fields, duplicate adapters and executable overrides are rejected',()=>{
    for (const bad of [null,{...definition,schemaVersion:2},{...definition,avatar:'x'},
        {...definition,adapters:[]},{...definition,adapters:[{id:'lua',version:1}]},
        {...definition,adapters:[{id:'gallery',version:2}]},
        {...definition,adapters:[{id:'gallery',version:1,source:'alert(1)'}]},
        {...definition,adapters:[{id:'gallery',version:1},{id:'gallery',version:1}]},
        {...definition,adapters:[{id:'witchcure',version:1,source:{roster:'',report:'',styles:'',code:'bad'}}]}]) {
        assert.throws(()=>validateProfile(bad));
    }
});
test('Discovery recognizes reviewed stream/gallery signatures without running source',()=>{
    const source = {sourceVersion:1,risuai:{customScripts:[{type:'editdisplay',in:String.raw`\[Assets:(.*?)\|Chat:(.*?)\|Time:(.*?)\|AkaChat:(.*?)\]`,out:'untrusted'}],
        triggerscript:[{effect:[{type:'triggerlua',code:'extractAllDcBlocks processDcBlock PNUM PCONT throw error'}]}]}};
    const result = discoverProfile(source);
    assert.deepEqual(result.profile,definition);
    assert.ok(result.notes.some(x=>x.includes('not executed')));
    assert.equal(discoverProfile({sourceVersion:1,risuai:{}}).profile,null);
    assert.throws(()=>discoverProfile({...source,profile:{...definition,schemaVersion:99}}));
    assert.deepEqual(discoverProfile({...source,profile:{...definition,adapters:[{id:'gallery',version:1}]}}).profile.adapters,[{id:'gallery',version:1}]);
});
test('Conflict scan reports active matching native display rules',()=>{
    const rules=[{scriptName:'overlap',findRegex:'\\[Assets:(.*?)'},{scriptName:'off',findRegex:'DC\\[',disabled:true},{findRegex:'DC\\[',promptOnly:true},{findRegex:'unrelated'}];
    assert.deepEqual(profileConflicts(definition,rules),['overlap']);
});
test('Exact standalone asset rule does not block stream imports; changed rules still require review',()=>{
    const rule={id:'v3s-builtin-panel-lax',findRegex:String.raw`/\[Assets:([^|\]\r\n]+)\]/g`,replaceString:'V3ASSETREF_'+'a'.repeat(32)+'_END',markdownOnly:true,scriptName:'single image'};
    assert.deepEqual(profileConflicts(definition,[rule]),[]);
    assert.deepEqual(profileConflicts(definition,[{...rule,findRegex:String.raw`/\[Assets:(.*?)\]/g`}]),['single image']);
});
test('Discovery summaries exclude source code and bound labels, macro arguments and provenance',()=>{
    const result=discoverProfile({sourceVersion:1,risuai:{customScripts:[{type:'editoutput',label:'x'.repeat(500),in:'secret-input',out:'{{getvar::secret-variable}} secret-output'}],triggerscript:[{effect:[{type:'triggerlua',code:'secret-script'}]}]}});
    const text=JSON.stringify(result.discovery);
    assert.ok(!text.includes('secret-'));
    assert.equal(result.discovery.rules[0].label.length,120);
    assert.deepEqual(result.discovery.rules[0].macros,['getvar']);
    assert.deepEqual(sourceOrigin({format:'untrusted',module:'untrusted',moduleRules:-1,moduleEffects:999999,inlineRules:2,code:'secret'}),{format:'unknown',module:'unknown',moduleRules:null,moduleEffects:100000,inlineRules:2});
});
