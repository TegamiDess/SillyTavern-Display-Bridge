import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverProfile,validateProfile,portraitVersion,profileFromSettings} from '../core/profiles.js';
import {validatePortraitPreset,parsePortraitDialogue} from '../adapters/portrait-dialogue.js';
import {detailedSceneRules,sceneMessage} from './browser/scene-fixture.js';
import {makePortableCard} from '../../v3-asset-sprites/portable-card.js';

const profile=()=>discoverProfile({sourceVersion:1,ruleOptionsVersion:1,risuai:{customScripts:detailedSceneRules('five')}}).profile;
const layout=()=>({version:1,aspectRatio:[16,8.5],maxWidth:1200,metadataPosition:'top'});
test('Reviewed frame round-trips through profile/settings/card export and requires adapter 13',()=>{
    const p=profile(),s=p.adapters[0].source;s.sceneLayout=layout();p.adapters[0].version=portraitVersion(s);
    assert.equal(p.adapters[0].version,13);assert.deepEqual(validateProfile(p),p);
    assert.deepEqual(profileFromSettings({adapters:['portrait-dialogue'],portraitSource:s}),p);
    const card=makePortableCard({data:{name:'Neutral wide scene'},profile:p,rules:[],assets:[]});
    assert.deepEqual(discoverProfile({sourceVersion:1,profile:card.data.extensions.display_bridge_profile}).profile,p);
    p.adapters[0].version=12;assert.throws(()=>validateProfile(p),/version 13/);
});
test('Layout does not change parsed story fields or legacy profiles',()=>{
    const p=profile(),s=p.adapters[0].source,message=sceneMessage('five'),before=parsePortraitDialogue(message,s).blocks[0];
    const oldVersion=portraitVersion(s);assert.equal(validateProfile(p).adapters[0].version,oldVersion);
    const next=validatePortraitPreset({...s,sceneLayout:layout()}),after=parsePortraitDialogue(message,next).blocks[0];
    const fields=block=>Object.fromEntries(Object.entries(block).filter(([key])=>key!=='config'));
    assert.deepEqual(fields(after),fields(before));assert.equal(s.sceneLayout,undefined);
});
test('Layout rejects raw CSS, bad bounds, unknown fields and conflicting layered frames',()=>{
    for(const mutate of [l=>l.version=2,l=>l.aspectRatio=[16,0],l=>l.aspectRatio=['16',9],l=>l.aspectRatio=[100,1],l=>l.aspectRatio=[1,100],l=>l.aspectRatio=[16,9,1],l=>l.maxWidth=319,l=>l.maxWidth=2401,l=>l.maxWidth=1200.5,l=>l.metadataPosition='fixed',l=>l.css='color:red']){
        const s=profile().adapters[0].source;s.sceneLayout=layout();mutate(s.sceneLayout);assert.throws(()=>validatePortraitPreset(s),/Scene layout/);
    }
    const s=profile().adapters[0].source;s.sceneLayout=layout();s.format.details.layers=true;assert.throws(()=>validatePortraitPreset(s),/non-layered/);
    s.format={kind:'scene'};assert.throws(()=>validatePortraitPreset(s),/non-layered/);
});
