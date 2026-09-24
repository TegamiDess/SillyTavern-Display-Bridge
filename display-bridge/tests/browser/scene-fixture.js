// Independently neutral scenes using the reviewed multi-rule source structures.
const rule=(input,output)=>({type:'editdisplay',in:input,out:output,ableFlag:false});
export const sceneRules = (family='four') => {
    const five=family==='five',fields=five?2:4;
    const background=rule('<(.+?)><img src="(.+?)"_"(.+?)"_"(.+?)"_"(.+?)"'+(five?'_"(.+?)"':'')+'>',
        '<div class="simpleFrame"><img class="backgroundImage" src="{{raw::$2}}"><div class="time-text">'+(five?'$5':'$5')+'</div>'+(five?'<span>$4</span><span>$6</span>':''));
    const casts=[];
    for(let n=1;n<=4;n++) {
        const tuple='<img="(.+?)"_"(.+?)"><ct='+Array(fields).fill('"(.+?)"').join('_')+'>';
        let output='';
        for(let i=0;i<n;i++) {const base=1+i*(fields+2),hover=base+1;
            output+='<div class="char-slot"><img class="char-img" src="{{raw::$'+base+'}}"><img class="char-img-hover" src="{{raw::$'+hover+'}}"></div>';
        }
        casts.push(rule('<'+(five?n:'\\d')+'>'+tuple.repeat(n),output));
    }
    return [background,rule('<0>',''),...casts,
        rule('<div><div tn="(.+?)">','<div class="text-area-container"><div class="text-area">'),
        rule('<text="(.+?)">([\\s\\S]+?)</text>','<p><span class="$1">$2</span> </p>')];
};
export const sceneMessage=(family='four',id='1',count=2)=>
    '<#'+id+'><img src="room"_'+(family==='five'?'"daytime"_"2026-09-22"_"18:30"_"Observatory"':'"sky"_"weather"_"18:30"')+'><'+count+'>'+
    Array.from({length:count},(_,i)=>'<img="'+(i%2?'curator':'guide')+'"_"'+(i%2?'curator-smile':'guide-smile')+'"><ct="0px"_"A guide"'+(family==='five'?'':'_"On duty"_"Ready"')+'>').join('')+
    '<div><div tn="'+id+'"><text="dialogue">Welcome to the observatory.</text><text="narration">The guides prepare the telescope.</text></div></div>';

// Stage-3 fixture: reviewed extra capture roles, without private art or text.
export function detailedSceneRules(family='four') {
    const rules=sceneRules(family),fields=family==='five'?2:4;
    if(family==='four')rules[0].out='<img class="fullBgImage2" src="{{raw::$3}}"><img class="fullBgImage3" src="{{raw::$4}}">'+rules[0].out+
        '{{#if {{equal::sky::$3}}}}<img class="backgroundImage3" src="{{raw::$2}}">{{/if}}';
    for(let count=1;count<=4;count++){
        let output='';
        for(let i=0;i<count;i++){
            const base=1+i*(fields+2);output+='<div class="char-slot"><img class="char-img" src="{{raw::$'+base+'}}" style="top: $'+(base+2)+'"><img class="char-img-hover" src="{{raw::$'+(base+1)+'}}" style="top: $'+(base+2)+'">';
            for(let j=0;j<fields-1;j++)output+='<div data-tooltip="$'+(base+3+j)+'"></div>';
            output+='</div>';
        }
        rules[count+1].out=output;
    }
    rules.push(rule('@guide|@curator','20%'));return rules;
}
