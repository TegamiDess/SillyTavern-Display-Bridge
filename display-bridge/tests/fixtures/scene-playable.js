import {sceneImportCard} from './scene-import.js';
import {contextWrapperEffects,contextCompletionEffects} from '../../adapters/scene-source-context.js';
export function scenePlayableCard(){
 const card=sceneImportCard(),r=card.data.extensions.risuai;
 card.data.name='Neutral Scene Context';
 card.data.first_mes='{{getvar::fm}}\n'+card.data.first_mes.replace('<2>','<5>').replaceAll('"guide','"helper').replace('src="room"','src="BG_observatory_night.png"');
 card.data.assets.push({name:'BG_observatory.png',type:'x-risu-asset',ext:'png',uri:'embeded://room'});
 r.defaultVariables+='\nfm=&&&\nTa=&&&{{br}}\nTb={{br}}Current guides: [guide / score={{getvar::guide_p}} / location={{getvar::guide_loc}} / relationship={{getvar::guide_r}}] [curator / score={{getvar::curator_p}} / location={{getvar::curator_loc}} / relationship={{getvar::curator_r}}]. Keep these facts consistent and emit declared update annotations when they change.';
 r.triggerscript.push({type:'start',conditions:[],effect:contextWrapperEffects()},{type:'output',conditions:[],effect:contextCompletionEffects()});
 const rule=(input,output,type='editoutput')=>({type,in:input,out:output,ableFlag:false});
 r.customScripts.push(rule('<5>','<2>'),rule('helper','guide'),rule('<img src="BG_(observatory)_(daytime|dusk|night|midnight).png"','<img src="BG_$1.png"'),rule('&&&','','editdisplay'),rule('&&&','','editprocess'));
 return card;
}
