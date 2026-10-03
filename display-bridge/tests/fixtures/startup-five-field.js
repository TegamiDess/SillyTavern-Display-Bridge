// Original neutral startup/dependency fixture. No private card content or assets.
import {detailedSceneRules, sceneMessage} from '../browser/scene-fixture.js';

export function startupFiveFieldCard() {
    return {data: {
        first_mes: '<setup>',
        description: 'Season: {{getvar::season}}. Meeting point: {{getvar::place}}.',
        assets: ['room', 'garden', 'guide', 'guide-smile', 'curator', 'curator-smile']
            .map(name => ({name, type: 'x-risu-asset', ext: 'png'})),
        extensions: {risuai: {
            defaultVariables: 'season=unselected\nplace=unselected',
            customScripts: [
                ...detailedSceneRules('five'),
                {type: 'editdisplay', in: '<setup>', out: '<button risu-trigger="season_spring">Spring</button>'},
            ],
            triggerscript: [{comment: 'season_spring', type: 'manual', conditions: [], effect: [
                {type: 'v2SetVar', operator: '=', var: 'season', value: 'spring', valueType: 'value', indent: 0},
            ]}],
        }},
    }};
}

export const fiveFieldTrial = (count, id = '1') => sceneMessage('five', id, count);
