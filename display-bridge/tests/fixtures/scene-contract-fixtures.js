// Original neutral data. No private card dialogue, artwork, prompts or scripts.
// Expected future fields are specification data, not currently accepted profile JSON.
import {sceneRules, sceneMessage} from '../browser/scene-fixture.js';

export const families = ['four', 'five'].map(family => ({
    family, rules: sceneRules(family),
    cases: Array.from({length: 5}, (_, count) => ({
        source: sceneMessage(family, '1', count),
        expected: {
            count, background: 'room', time: '18:30',
            offset: {value: 0, unit: 'px'},
            tooltips: family === 'four' ? ['A guide', 'On duty', 'Ready'] : ['A guide'],
            ...(family === 'four' ? {sky: 'sky', effect: 'weather'} : {period: 'daytime', date: '2026-09-22', location: 'Observatory'}),
        },
    })),
}));

export const sourceCases = {
    locationChange: sceneMessage('five', '1', 1) + '\n' + sceneMessage('five', '2', 2)
        .replace('"room"', '"garden"').replace('"Observatory"', '"Garden"'),
    duplicateLabels: sceneMessage('four', '1', 1) + '\n' + sceneMessage('four', '1', 2),
    incomplete: sceneMessage().slice(0, -6),
    unknownMetadata: sceneMessage().replace('"0px"', '"calc(100% - 1px)"'),
    specialized: '<#1><img src="room"_"sky"_"weather"_"18:30"><1><img="guide_ev_lying_neutral.png"_"guide-smile"><ct="0px"_"Guide"_"On duty"_"Ready"><div><div tn="1">The guide checks the chart.</div></div>',
};

export const stateDefaults = {'guide.score': 5, 'guide.location': null, 'guide.relationship': 'new', weather: 'clear', track: null, choice: null};
export const event = (id, parent, updates = [], scene = {background: 'room'}) => ({id, parent, updates, scene});
export const assign = (key, value) => ({op: 'assign', key, value});
export const delta = (key, value) => ({op: 'delta', key, value});
export const drawerInput = {entity: 'guide', scoreKey: 'guide.score', locationKey: 'guide.location', relationshipKey: 'guide.relationship', icons: {new: 'guide-icon', friend: 'guide-friend-icon'}};
export const audioInput = {tracks: {quiet: 'quiet.mp3', evening: 'evening.mp3'}, stop: null, enabledDefault: false};
