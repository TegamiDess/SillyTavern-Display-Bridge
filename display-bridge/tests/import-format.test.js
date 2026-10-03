import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const helper=async name=>import('data:text/javascript;base64,'+fs.readFileSync(new URL('../../v3-asset-sprites/'+name,import.meta.url)).toString('base64'));
const {decodeRisuModule,mergeModuleSource}=await helper('risu-module.js');
const {namedImageRule}=await helper('named-image-rule.js');
const fixture=new Uint8Array(fs.readFileSync(new URL('./browser/module-fixture.risum',import.meta.url)));
test('Legacy Risu module decodes rules/triggers and excludes lorebook/body/assets',()=>{
    const module=decodeRisuModule(fixture);
    assert.equal(module.regex.length,4);assert.equal(module.trigger.length,1);assert.equal(module.assetCount,0);
    assert.deepEqual(Object.keys(module),['regex','trigger','assetCount']);
    const card={data:{extensions:{risuai:{backgroundHTML:'styles',customScripts:[module.regex[0]]}}}};
    const merged=mergeModuleSource(card,module);
    assert.equal(merged.data.extensions.risuai.customScripts.length,4);
    assert.equal(card.data.extensions.risuai.customScripts.length,1);
    assert.equal(merged.data.extensions.risuai.backgroundHTML,'styles');
});
test('Malformed, oversized and unsupported module framing fails explicitly',()=>{
    const badVersion=fixture.slice();badVersion[1]=99;
    const badLength=fixture.slice();badLength.fill(255,2,6);
    const badType=fixture.slice();badType[6]=0;
    for(const bad of [new Uint8Array(),fixture.slice(0,-1),badVersion,badLength,badType,new Uint8Array(4000001),new Uint8Array([...fixture,0])]) assert.throws(()=>decodeRisuModule(bad));
});
test('Native bare-image rule matches only exact declared names in simple tags',()=>{
    const spec=namedImageRule(['Lerevan Peinard','a.b(2)','https://example.test/a','/absolute.png']);
    const match=text=>new RegExp(spec.source,spec.flags).exec(text);
    assert.equal(match('<img src="Lerevan Peinard">')[2],'Lerevan Peinard');
    assert.equal(match("<IMG SRC='a.b(2)' />")[2],'a.b(2)');
    for(const text of ['<img src="unknown">','<img src="/absolute.png">','<img src="https://example.test/a">','<img src="axb2">','<img src="Lerevan Peinard" onerror="anything">']) assert.equal(match(text),null);
    assert.equal(namedImageRule([]),null);
});

test('Native named-image rule handles char attributes without broadening src or asset-name matching',()=>{
    const spec=namedImageRule(['smile','shy','neutral','happy-wave','a.b(2)']);
    const match=text=>new RegExp(spec.source,spec.flags).exec(text);
    for(const [text,name] of [['<img char=smile>','smile'],['<img char="shy">','shy'],["<IMG CHAR='neutral' />",'neutral'],['<img char = happy-wave/>','happy-wave'],['<img char="a.b(2)">','a.b(2)']]) {
        assert.equal(match(text)?.[2],name);
        assert.equal(text.replace(new RegExp(spec.source,spec.flags),spec.output),`<img src="${name}">`);
    }
    const text='<img char=smile> Welcome.\n<img char=shy> Hello.\n<img char=neutral> A quiet library.';
    assert.deepEqual([...text.matchAll(new RegExp(spec.source,spec.flags))].map(m=>m[2]),['smile','shy','neutral']);
    for(const value of ['<img char=unknown>','<img char=Smile>','<img char="smile\'>','<img char=smile onerror=anything>','<img char=smile src="other">','<img char=https://example.test/smile>','<img char=../smile>','<img character=smile>','<img src=smile>']) assert.equal(match(value),null,value);
});
