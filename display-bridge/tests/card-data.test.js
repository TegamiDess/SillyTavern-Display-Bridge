import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCardDataReader} from '../../v3-asset-sprites/card-data.js';

test('Repeated card reads reuse JSON parsing while live edits, replacements and malformed input stay fresh',()=>{
    let parses=0;
    const read=createCardDataReader(text=>{parses++;return JSON.parse(text);});
    const card={json_data:JSON.stringify({data:{name:'Stored',extensions:{regex_scripts:[{id:'old'}]}}}),data:{name:'Live',extensions:{other:true}}};
    assert.equal(read(card).name,'Live');assert.equal(read(card).extensions.regex_scripts[0].id,'old');assert.equal(parses,1);
    card.data.extensions.regex_scripts=[{id:'edited'}];assert.equal(read(card).extensions.regex_scripts[0].id,'edited');assert.equal(parses,1);
    delete card.data.extensions.regex_scripts;
    card.json_data=JSON.stringify({data:{extensions:{regex_scripts:[{id:'replacement'}]}}});assert.equal(read(card).extensions.regex_scripts[0].id,'replacement');assert.equal(parses,2);
    card.json_data='{broken';assert.equal(read(card).extensions.regex_scripts,undefined);read(card);assert.equal(parses,3);
    delete card.json_data;assert.deepEqual(read(card),{name:'Live',extensions:{other:true}});
    assert.deepEqual(read({json_data:'null'}),{extensions:{}});
    assert.deepEqual(read({json_data:'[]'}),{extensions:{}});
});

test('Serialized-card cache holds one revision and does not mix direct metadata between characters',()=>{
    let parses=0;const read=createCardDataReader(text=>{parses++;return JSON.parse(text);});
    const a={json_data:'{"data":{"name":"A"}}'},b={json_data:'{"data":{"name":"B"}}'};
    assert.equal(read(a).name,'A');assert.equal(read(b).name,'B');assert.equal(read(a).name,'A');assert.equal(parses,3);
    assert.equal(read({...a,data:{name:'Other character'}}).name,'Other character');assert.equal(read(a).name,'A');assert.equal(parses,3);
});
