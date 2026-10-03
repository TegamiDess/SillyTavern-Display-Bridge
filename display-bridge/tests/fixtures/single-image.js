import {behaviorSource} from './scene-behavior.js';
import {sceneMessage} from '../browser/scene-fixture.js';
import {singleImagePattern,singleImageTemplate} from '../../adapters/scene-single-image.js';
import {RECENCY_GATE} from '../../adapters/scene-behavior.js';
export const singleCSS='.simpleFrame .characterImageEV {position:absolute;left:50%;top:60%;height:74%;width:74%;object-fit:contain;opacity:0;transform:translate(-50%, -50%) translateY(40px);animation-name:fadeInAndMoveUp,breathingEffect;animation-duration:0.7s,4s;animation-timing-function:ease-out,ease-in-out;animation-fill-mode:forwards,none;animation-iteration-count:1,infinite;animation-delay:0s,0.7s;backface-visibility:hidden;-webkit-backface-visibility:hidden;}';
export function singleSource(){const s=behaviorSource();s.risuai.customScripts.unshift({type:'editdisplay',in:singleImagePattern(),out:RECENCY_GATE('remove')+singleImageTemplate()+'{{/if}}',ableFlag:false});s.risuai.backgroundHTML+=singleCSS;return s;}
export function singleMessage(offset='60%',name='guide_ev_lying_reading.png'){
 return sceneMessage('four','1',1).replace('<img="guide"_"guide-smile"><ct="0px"_"A guide"_"On duty"_"Ready">','<img="'+name+'"_"'+offset+'"><ct="unused"_"A guide"_"Reading"_"Quiet">');
}
