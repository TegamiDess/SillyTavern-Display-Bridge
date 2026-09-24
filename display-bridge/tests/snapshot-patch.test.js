import test from 'node:test';
import assert from 'node:assert/strict';
import {patchSnapshot} from '../../tools/patch-snapshot.mjs';

const source = `async function capture() {
    try {
        //First of all, build capture
        const clone = el.cloneNode(true);
        document.body.appendChild(containerDiv);

        //Thankfully grid
    } catch (error) {}
}`;
test('Snapshot patch is opt-in, before anonymization/grid, repeatable and preserves line endings', () => {
    for (const newline of ['\n', '\r\n']) {
        const result = patchSnapshot(source.replaceAll('\n', newline));
        assert.match(result, /snapshotHelper\.cloneMessage\(el\)/);
        assert.match(result, /await snapshotHelper\?\.prepare\(containerDiv\)/);
        assert.ok(result.indexOf('prepare(containerDiv)') < result.indexOf('//Thankfully'));
        assert.ok(result.includes('containerDiv.remove();'));
        assert.equal(patchSnapshot(result), result);
        if (newline === '\r\n') assert.equal(result.replaceAll('\r\n', '').includes('\n'), false);
    }
});
test('Snapshot patch rejects unknown and ambiguous source without generating a partial patch', () => {
    assert.throws(() => patchSnapshot('unrecognized extension'), /no files changed/);
    assert.throws(() => patchSnapshot(source + source), /no files changed/);
    assert.throws(() => patchSnapshot(source.replace('el.cloneNode(true)', 'el.cloneNode(false)')), /no files changed/);
});
