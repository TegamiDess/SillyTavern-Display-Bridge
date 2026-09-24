import {detailedSceneRules,sceneMessage} from '../browser/scene-fixture.js';

// Independent source-only fixture. Names and prose are not copied from a card.
export function sceneImportCard(){
 const badge=entity=>({type:'output',conditions:[],effect:[
  {type:'v2SetVar',operator:'=',var:'ss',value:entity,valueType:'value',indent:0},
  ...['New','Friend'].flatMap((relationship,i)=>[
   {type:'v2If',indent:0,condition:'=',targetType:'value',target:relationship,source:'{{getvar::ss}}_r'},
   {type:'v2SetVar',operator:'=',var:'{{getvar::ss}}_ap',valueType:'value',indent:1,value:'badge badge-'+relationship.toLowerCase()},
   {type:'v2SetVar',operator:'=',var:'{{getvar::ss}}_as',valueType:'value',indent:1,value:String(i+1)},
   {type:'v2EndIndent',indent:1,endOfLoop:false},
  ])]});
 const rule=(input,output,flags='g')=>({type:'editoutput',in:input,out:output,ableFlag:true,flag:flags});
 return {spec:'chara_card_v3',spec_version:'3.0',data:{name:'Neutral Automatic Scene Import',description:'Observatory guides. Follow the current scene facts supplied with the request.',first_mes:sceneMessage(),alternate_greetings:[],assets:[
  ...['guide','guide-smile','curator','curator-smile','room','sky','weather','guide1_icon.png','guide2_icon.png','curator1_icon.png','curator2_icon.png'].map(name=>({type:'x-risu-asset',name,ext:'png',uri:'embeded://'+name})),
  ...['evening-chime','morning-chime'].map(name=>({type:'x-risu-asset',name,ext:'wav',uri:'embeded://'+name})),
 ],extensions:{risuai:{
  defaultVariables:['bgm=1',...['guide','curator'].flatMap(name=>[name+'_p=5',name+'_loc=Observatory',name+'_r=New',name+'_as=1'])].join('\n'),
  backgroundHTML:'{{#if {{equal::{{getvar::bgm}}::1}}}}{{audio::evening-chime}}{{/if}}\n{{#if {{equal::{{getvar::bgm}}::2}}}}{{audio::morning-chime}}{{/if}}',
  customScripts:[...detailedSceneRules(),{type:'editdisplay',in:'&&&',out:['guide','curator'].map(name=>'<div class="character-card"><img src="{{raw::'+name+'{{getvar::'+name+'_as}}_icon.png}}"><div class="character-name">'+name+'</div><div class="heart-percent">{{getvar::'+name+'_p}}%</div><div>{{getvar::'+name+'_loc}}</div><div>{{getvar::'+name+'_r}}</div></div>').join(''),ableFlag:false},
   rule('<MOVE_(.+?)_(.+?)>','{{setvar::$1_loc::$2}}','gi'),
   rule('<관계=(.+?)=(New|Friend)>','{{setvar::$1_r::$2}}'),
   rule('<❤([a-zA-Z]+?)\\+(\\d+)>','"❤$1+$2"{{setvar::$1_p::{{calc::{{getvar::$1_p}}+$2}}}}'),
   rule('<❤([a-zA-Z]+?)-(\\d+)>','{{setvar::$1_p::{{calc::{{getvar::$1_p}}-$2}}}}'),
   rule('<BGM=@BGM_0(\\d+)_(Evening|Morning)>','{{setvar::bgm::$1}}'),
   rule('@BGMoff|<@BGMoff>|<@BGM=BGMoff>','{{setvar::bgm::0}}'),
  ],triggerscript:['guide','curator'].map(badge),
 }}}};
}
