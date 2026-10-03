import {detailedSceneRules} from '../browser/scene-fixture.js';

// Neutral fixtures reproduce only reviewed display contracts.
export const motionCSS=`
.fullBgImage3 {animation-name:fadeEffect;animation-duration:120s;animation-timing-function:ease-in-out;animation-iteration-count:infinite;}
.simpleFrame .characterImage1 {animation-name:fadeInAndMoveUp,breathingEffect;animation-duration:0.7s,4s;animation-timing-function:ease-out,ease-in-out;}
@keyframes fadeEffect {0%{opacity:0.8;}50%{opacity:0.5;}100%{opacity:0.8;}}
@keyframes fadeInAndMoveUp {from{opacity:0;transform:translate(-50%,-50%) translateY(40px);}to{opacity:1;transform:translate(-50%,-50%);}}
@keyframes breathingEffect {0%{transform:translate(-50%,-50%) translateY(0) scaleY(1);}50%{transform:translate(-50%,-50%) translateY(-3px) scaleY(1.01);}100%{transform:translate(-50%,-50%) translateY(0) scaleY(1);}}
`;
export function behaviorSource(){
 const rules=detailedSceneRules();
 rules[2].out=rules[2].out.replace('class="char-img"','class="characterImage1"').replace('class="char-img-hover"','class="characterImageHover1"');
 for(const rule of rules)if(rule.out.includes('<img')||rule.out.includes('text-area-container'))rule.out='{{#if {{greater_equal::{{chat_index}}::{{? {{lastmessageid}}-{{getvar::remove}} }}}}}}'+rule.out+'{{/if}}';
 return {sourceVersion:1,ruleOptionsVersion:1,sceneSourceVersion:1,risuai:{customScripts:rules,backgroundHTML:motionCSS,defaultVariables:'remove=3'}};
}
