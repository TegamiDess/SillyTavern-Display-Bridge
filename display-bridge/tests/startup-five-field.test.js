import test from 'node:test';
import assert from 'node:assert/strict';
import {captureDisplaySource} from '../../v3-asset-sprites/display-handoff.js';
import {discoverProfile} from '../core/profiles.js';
import {parsePortraitDialogue} from '../adapters/portrait-dialogue.js';
import {startupFiveFieldCard, fiveFieldTrial} from './fixtures/startup-five-field.js';

const discover = () => discoverProfile(captureDisplaySource(startupFiveFieldCard()));

for (let count = 0; count <= 4; count++) {
    test(`Five-field startup family preserves scene fields and ${count} normal/hover pairs`, () => {
        const preset = discover().profile.adapters[0].source;
        const parsed = parsePortraitDialogue(fiveFieldTrial(count), preset);
        assert.equal(parsed.unsupported, 0);
        assert.equal(parsed.incomplete, 0);
        assert.equal(parsed.blocks.length, 1);
        const scene = parsed.blocks[0];
        assert.equal(scene.background, 'room');
        assert.equal(scene.period, 'daytime');
        assert.equal(scene.date, '2026-09-22');
        assert.equal(scene.time, '18:30');
        assert.equal(scene.location, 'Observatory');
        assert.equal(scene.portraits.length, count);
        for (const [i, portrait] of scene.portraits.entries()) {
            assert.equal(portrait.image, i % 2 ? 'curator' : 'guide');
            assert.equal(portrait.hover, i % 2 ? 'curator-smile' : 'guide-smile');
            assert.deepEqual(portrait.offset, {value: 0, unit: 'px'});
            assert.deepEqual(portrait.tooltips, ['A guide']);
        }
    });
}

test('Uncompiled startup dependencies keep a recognized scene profile under review', () => {
    const card = startupFiveFieldCard(), before = structuredClone(card);
    const source = captureDisplaySource(card), result = discoverProfile(source);
    assert.deepEqual(card, before, 'Discovery must not replace the stored greeting or prompt');
    assert.ok(source.requiredMacros.includes('getvar'));
    assert.deepEqual(source.macroReferences.map(r => r.name), ['season', 'place']);
    assert.equal(result.requiresReview, true);
    assert.ok(result.discovery.sceneAssembly.some(c => c.status === 'unsupported'));
    assert.equal(parsePortraitDialogue(card.data.first_mes, result.profile.adapters[0].source).blocks.length, 0);
    assert.ok(result.discovery.effects.every(e => e.status === 'not-run'));
});

test('Incomplete five-field scenes are not rendered as accepted complete scenes', () => {
    const preset = discover().profile.adapters[0].source;
    const incomplete = fiveFieldTrial(2).slice(0, -6);
    assert.equal(parsePortraitDialogue(incomplete, preset).blocks.length, 0);
});

test('Two five-field scenes retain separate locations and portrait counts', () => {
    const preset = discover().profile.adapters[0].source;
    const text = fiveFieldTrial(1) + '\n' + fiveFieldTrial(4, '2')
        .replace('"room"', '"garden"').replace('"Observatory"', '"Garden"');
    const parsed = parsePortraitDialogue(text, preset);
    assert.equal(parsed.unsupported, 0);
    assert.equal(parsed.incomplete, 0);
    assert.deepEqual(parsed.blocks.map(b => [b.background, b.location, b.portraits.length]),
        [['room', 'Observatory', 1], ['garden', 'Garden', 4]]);
});
