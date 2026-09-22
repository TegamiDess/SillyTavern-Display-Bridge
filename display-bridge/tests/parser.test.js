import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePanels, protectPanels } from '../core/parser.js';
import { acceptedImageURL, resolveImage } from '../integrations/assets.js';
import { parseWitchcure, witchcureSource } from '../adapters/witchcure.js';

const panel = (chat = '<p><span>A</span><span>Hello</span></p>') => `[Assets:sample.webp|Chat:${chat}|Time:12:30|AkaChat:]`;

test('preserves exact source ranges around repeated panels and prose', () => {
    const source = `Before **bold**\n${panel()}\nBetween\n${panel()}\nAfter`;
    const parsed = parsePanels(source);
    assert.equal(parsed.blocks.length, 2);
    for (const block of parsed.blocks) assert.equal(source.slice(block.start, block.end), panel());
    const plan = protectPanels(source, parsed.blocks, 'aabb');
    assert.notEqual(plan.items[0].token, plan.items[1].token);
    let restored = plan.source;
    for (const item of plan.items) restored = restored.replace(item.token, source.slice(item.start, item.end));
    assert.equal(restored, source);
});
test('nested brackets do not close the outer block', () => {
    const parsed = parsePanels(panel('<p><span>A</span><span>Hello [world [again]]</span></p>'));
    assert.equal(parsed.blocks.length, 1);
    assert.match(parsed.blocks[0].chat, /world \[again\]/);
});
test('streaming tail remains unclaimed and completes later', () => {
    const complete = panel();
    assert.equal(parsePanels(complete.slice(0, -1)).blocks.length, 0);
    assert.equal(parsePanels(complete.slice(0, -1)).incomplete, 1);
    assert.equal(parsePanels(complete).blocks.length, 1);
});
test('ignores fenced, inline and escaped examples', () => {
    const source = '```text\n' + panel() + '\n```\n`' + panel() + '`\n\\' + panel() + '\n' + panel();
    assert.equal(parsePanels(source).blocks.length, 1);
    assert.equal(parsePanels('~~~\n' + panel()).blocks.length, 0);
});
test('malformed fields and missing image remain raw', () => {
    assert.equal(parsePanels('[Assets:sample.webp|Time:now]').blocks.length, 0);
    assert.equal(parsePanels('[Assets:|Chat:|Time:now|AkaChat:]').blocks.length, 0);
});
test('brackets inside quoted attributes cannot truncate a block', () => {
    assert.equal(parsePanels(panel('<p title="]"><span>A</span><span>B</span></p>')).blocks.length, 1);
});
test('rejects collisions with generated placeholders', () => {
    const source = panel() + 'DBPabcX0END';
    assert.throws(() => protectPanels(source, parsePanels(source).blocks, 'abc'));
});
test('provider URLs must stay inside explicit local image roots', () => {
    for (const url of ['/user/files/test.webp', '/user/images/Example/a%20b.png', '/characters/portrait.png']) assert.equal(acceptedImageURL(url), url);
    for (const url of ['https://example.com/a.png', '//example.com/a.png', '/user/files/../a.png', '/user/files/%2e%2e/a.png', '/user/files/%2fhost.png', '/user/files/%5c.png', '/user/files/a.svg', '/user/files/a.png?x=1', '/user/files/%zz.png', '/secret/a.png']) assert.equal(acceptedImageURL(url), null, url);
});
test('provider requires version, identity and valid return URL', () => {
    let received;
    const provider = { apiVersion: 1, resolveImage: args => { received = args; return { status: 'resolved', url: '/user/files/a.png' }; } };
    assert.equal(resolveImage('avatar.png', 'asset', provider).status, 'resolved');
    assert.deepEqual(received, { avatar: 'avatar.png', reference: 'asset' });
    assert.equal(resolveImage('a', 'b', { apiVersion: 2 }).status, 'incompatible-provider');
    assert.equal(resolveImage('a', 'b', { apiVersion: 1, resolveImage: () => ({ status: 'resolved', url: 'https://evil.test/a.png' }) }).status, 'invalid-url');
});
test('Witchcure markers exclude code, escaped text and existing panel ranges', () => {
    const source='[명부] `[명부]` \\[명부] [평가 보고서]';
    assert.equal(parseWitchcure(source).length,2);
    assert.equal(parseWitchcure(source,[[0,4]]).length,1);
});
test('Witchcure extraction selects only the two exact display rules and styles', () => {
    const source=witchcureSource({data:{extensions:{risuai:{backgroundHTML:'<style></style>',customScripts:[
        {type:'editdisplay',in:String.raw`\[명부\]`,out:'roster'},
        {type:'editdisplay',in:String.raw`\[평가 보고서\]`,out:'report'},
    ]}}}});
    assert.deepEqual(source,{roster:'roster',report:'report',styles:'<style></style>'});
    assert.equal(witchcureSource({}),null);
});
