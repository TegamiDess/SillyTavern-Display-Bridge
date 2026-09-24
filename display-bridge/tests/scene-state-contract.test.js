import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverProfile} from '../core/profiles.js';
import {parsePortraitDialogue} from '../adapters/portrait-dialogue.js';
import {createSceneStateReference} from './support/scene-state-reference.js';
import {families, sourceCases, stateDefaults, event, assign, delta, drawerInput, audioInput} from './fixtures/scene-contract-fixtures.js';

const owner = ['character-generation-a', 'chat-a', 'state-v1'];
const create = (scope = owner, saved) => createSceneStateReference(scope, stateDefaults, saved);
const commit = (model, record) => { model.begin('attempt-' + record.id, record.parent); return model.commit('attempt-' + record.id, record); };
const sourceFor = f => discoverProfile({sourceVersion: 1, ruleOptionsVersion: 1, risuai: {customScripts: f.rules}}).profile.adapters[0].source;

test('design fixtures: both source families retain 0–4 cast and their current supported fields', () => {
    for (const family of families) for (const {source, expected} of family.cases) {
        const [scene] = parsePortraitDialogue(source, sourceFor(family)).blocks;
        assert.equal(scene.portraits.length, expected.count);
        assert.equal(scene.background, expected.background); assert.equal(scene.time, expected.time);
        assert.equal(scene.location, expected.location);
        assert.equal(source.slice(scene.start, scene.end), source);
        // Offset/tooltips/layers are future expectations, not claims of current rendering support.
    }
});

test('design fixtures: location changes and repeated source labels remain separate scenes', () => {
    const changed = parsePortraitDialogue(sourceCases.locationChange, sourceFor(families[1])).blocks;
    assert.deepEqual(changed.map(x => [x.background, x.location, x.portraits.length]), [['room', 'Observatory', 1], ['garden', 'Garden', 2]]);
    const repeated = parsePortraitDialogue(sourceCases.duplicateLabels, sourceFor(families[0])).blocks;
    assert.equal(repeated.length, 2); assert.notEqual(repeated[0].start, repeated[1].start);
    assert.equal(parsePortraitDialogue(sourceCases.incomplete, sourceFor(families[0])).blocks.length, 0);
});

test('reference: first load keeps unknown fields distinct from explicit defaults', () => {
    const model = create(); assert.equal(model.view()['guide.score'], 5);
    assert.equal(model.view()['guide.location'], null); assert.equal(model.visibleScene(), null);
});

test('reference: repeated stream previews have no durable state or playback effects', () => {
    const model = create(), before = model.save(); model.begin('stream');
    for (let i = 0; i < 5; i++) model.preview('stream', {background: 'garden', track: 'evening'});
    assert.deepEqual(model.save(), before); assert.equal(model.view().track, null);
    assert.deepEqual(model.visibleScene(), {background: 'garden', track: 'evening'});
});

test('reference: successful final output commits once, including duplicate completion notification', () => {
    const model = create(), record = event('m1-s0-r1', null, [delta('guide.score', 3)]);
    assert.equal(commit(model, record), true); assert.equal(model.commit('attempt-m1-s0-r1', record), false);
    for (let i = 0; i < 10; i++) assert.equal(model.view()['guide.score'], 8);
    assert.equal(model.save().records.length, 1);
});

test('reference: failed swipe hides old scene while pending, then restores scene and state', () => {
    const model = create(); commit(model, event('m1-s0-r1', null, [delta('guide.score', 3)]));
    const before = model.save(); model.begin('swipe', null); assert.equal(model.visibleScene(), null);
    model.preview('swipe', {background: 'garden'}); model.fail('swipe');
    assert.deepEqual(model.save(), before); assert.deepEqual(model.visibleScene(), {background: 'room'});
});

test('reference: successful alternate swipe derives from parent, never from replaced swipe', () => {
    const model = create(); commit(model, event('m1-s0-r1', null, [delta('guide.score', 3)]));
    commit(model, event('m1-s1-r1', null, [delta('guide.score', -2)]));
    assert.equal(model.view()['guide.score'], 3); model.select('m1-s0-r1'); assert.equal(model.view()['guide.score'], 8);
});

test('reference: historical drawer values and weather remain attached to their revision', () => {
    const model = create(); commit(model, event('m1', null, [assign('guide.location', 'Library'), assign('weather', 'rain')]));
    commit(model, event('m2', 'm1', [assign('guide.location', 'Garden'), assign('weather', 'clear'), delta('guide.score', 4)]));
    assert.equal(model.view('m1')[drawerInput.locationKey], 'Library'); assert.equal(model.view('m1').weather, 'rain');
    assert.equal(model.view()[drawerInput.scoreKey], 9); assert.equal(model.view().weather, 'clear');
});

test('reference: edit starts new ancestry; old descendants cannot bleed into edited branch', () => {
    const model = create(); commit(model, event('m1-r1', null, [delta('guide.score', 3)]));
    commit(model, event('m2-r1', 'm1-r1', [delta('guide.score', 10)]));
    commit(model, event('m1-r2', null, [delta('guide.score', 1)]));
    assert.equal(model.view()['guide.score'], 6); assert.equal(model.view('m2-r1')['guide.score'], 18);
    commit(model, event('m2-r2', 'm1-r2', [delta('guide.score', 2)])); assert.equal(model.view()['guide.score'], 8);
});

test('reference: reload restores committed state; interrupted pending attempt is not persisted', () => {
    const model = create(); commit(model, event('m1', null, [delta('guide.score', 3)])); model.begin('interrupted');
    model.preview('interrupted', {background: 'garden'});
    const reload = create(owner, model.save()); assert.equal(reload.view()['guide.score'], 8);
    assert.deepEqual(reload.visibleScene(), {background: 'room'});
});

test('reference: chat, character and schema ownership are isolated on restore', () => {
    const model = create(); commit(model, event('m1', null, [delta('guide.score', 3)]));
    for (let i = 0; i < 3; i++) { const other = [...owner]; other[i] += '-other'; assert.throws(() => create(other, model.save()), /incompatible/); }
    const second = create(['character-generation-a', 'chat-b', 'state-v1']); assert.equal(second.view()['guide.score'], 5);
});

test('reference: stale callbacks and mismatched parents cannot commit', () => {
    const model = create(); model.begin('old'); model.begin('new');
    assert.throws(() => model.commit('old', event('m1', null)), /stale/);
    assert.throws(() => model.preview('old', {}), /stale/);
    assert.throws(() => model.commit('new', event('m1', 'missing')), /stale/);
    assert.equal(model.save().records.length, 0);
});

test('reference: invalid writes reject entire transaction, including earlier valid delta', () => {
    const model = create(), before = model.save(); model.begin('bad');
    assert.throws(() => model.commit('bad', event('m1', null, [delta('guide.score', 3), delta('guide.location', 1)])), /unknown numeric/);
    assert.deepEqual(model.save(), before);
    for (const update of [assign('constructor', 'bad'), {op: 'modifyChat', key: 'guide.score', value: 0}, assign('guide.score', 'wrong type')]) {
        assert.throws(() => model.commit('bad', event('m1', null, [update]))); assert.deepEqual(model.save(), before);
    }
});

test('reference: explicit snapshot assignments and ordered deltas do not erase unrelated values', () => {
    const model = create(); commit(model, event('m1', null, [assign('guide.location', 'Library'), assign('guide.score', 12), delta('guide.score', -2)]));
    commit(model, event('m2', 'm1', [assign('track', 'quiet')]));
    assert.equal(model.view()['guide.score'], 10); assert.equal(model.view()['guide.location'], 'Library');
    assert.equal(audioInput.tracks[model.view().track], 'quiet.mp3');
});

test('reference: resolved random choice is recorded once and survives replay without sampling', () => {
    const model = create(); commit(model, event('m1', null, [assign('choice', 'garden')]));
    assert.equal(create(owner, model.save()).view().choice, 'garden');
    model.begin('again', null); assert.throws(() => model.commit('again', event('m1', null, [assign('choice', 'library')])), /collision/);
    assert.equal(model.view().choice, 'garden');
});
