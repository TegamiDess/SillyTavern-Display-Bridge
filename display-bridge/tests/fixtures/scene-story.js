export const sceneStory={
 version:1,
 variables:{score:{type:'number',initial:10,min:0,max:100},place:{type:'string',initial:'Observatory'},relationship:{type:'enum',initial:'Colleague',values:['Colleague','Friend']},badge:{type:'enum',initial:null,values:['friend']},track:{type:'enum',initial:null,values:['evening','missing']}},
 rules:[{template:'<❤{entity}+{value}>',op:'add',targets:{alex:'score'}},{template:'<❤{entity}-{value}>',op:'subtract',targets:{alex:'score'}},{template:'<MOVE_{entity}_{value}>',op:'set',targets:{alex:'place'}},{template:'<relationship={entity}={value}>',op:'set',targets:{alex:'relationship'}}],
 derive:[{from:'relationship',to:'badge',values:{Friend:'friend'}}],
 roster:[{id:'alex',score:'score',location:'place',relationship:'relationship',badge:'badge'}],
 track:'track',backgroundTracks:{room:'evening',courtyard:null},
 context:{title:'Current scene facts',fields:[{key:'score',label:'Alex score'},{key:'place',label:'Alex location'},{key:'relationship',label:'Alex relationship'}]},
};
