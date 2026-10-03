export const SCENE_MOTION_CSS=`
@keyframes db-cloud-fade{0%,100%{opacity:.8}50%{opacity:.5}}
@keyframes db-portrait-entry{from{opacity:0;translate:0 40px}to{opacity:1;translate:0 0}}
@keyframes db-portrait-breath{0%,100%{scale:1 1;translate:0 0}50%{scale:1 1.01;translate:0 -3px}}
.motion-cloud .scene-layer.effect{animation:db-cloud-fade 120s ease-in-out infinite}
.motion-entry .cast-slot{animation:db-portrait-entry .7s ease-out backwards}
.motion-breath .cast-slot img{animation:db-portrait-breath 4s ease-in-out infinite}
.motion-breath .cast-slot img{animation-delay:.7s}
.motion-breath .cast-2 .cast-slot:nth-child(1) img{animation-delay:1.1s}
.motion-breath :is(.cast-3,.cast-4) .cast-slot:nth-child(1) img{animation-delay:1.2s}
.motion-breath :is(.cast-3,.cast-4) .cast-slot:nth-child(2) img,.motion-breath .cast-4 .cast-slot:nth-child(4) img{animation-delay:.8s}
.motion-breath :is(.cast-3,.cast-4) .cast-slot:nth-child(3) img{animation-delay:1.3s}
.motion-paused .scene-layer.effect,.motion-paused .cast-slot,.motion-paused .cast-slot img,.cast-slot.portrait-hover img,.cast-slot:focus-visible img{animation-play-state:paused}
@media(prefers-reduced-motion:reduce){.scene-layer.effect,.cast-slot,.cast-slot img{animation:none!important}}
`;

export function bindSceneMotion(host,article,behavior,{entrance=true}={}){
 if(!behavior||!['cloudFade','portraitEntrance','portraitBreathing'].some(key=>behavior[key]))return {dispose(){}};
 for(const [key,name]of [['cloudFade','cloud'],['portraitBreathing','breath']])article.classList.toggle('motion-'+name,behavior[key]===true);
 let visible=false,active=true,firstObservation=true;
 // Default to settled artwork until visibility is known. An entrance is a
 // one-shot reveal, never a deferred animation for scrolling into old scenes.
 const settle=()=>article.classList.remove('motion-entry');
 const update=()=>{const paused=!active||!visible||document.hidden;if(paused)settle();article.classList.toggle('motion-paused',paused);};
 const observer=new IntersectionObserver(entries=>{
  visible=entries.some(e=>e.isIntersecting);
  if(firstObservation){firstObservation=false;if(entrance&&behavior.portraitEntrance&&visible&&active&&!document.hidden)article.classList.add('motion-entry');}
  update();
 });
 const ended=event=>{if(event.animationName==='db-portrait-entry')settle();};
 article.addEventListener('animationend',ended);
 observer.observe(host);document.addEventListener('visibilitychange',update);update();
 return {setActive(value){active=value;update();},dispose(){observer.disconnect();document.removeEventListener('visibilitychange',update);article.removeEventListener('animationend',ended);}};
}
