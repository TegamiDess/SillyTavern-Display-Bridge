export const sceneControls={version:1,roster:{title:'Guide information',entities:[{id:'alex',label:'Alex',portrait:'guide',badges:[{id:'friend',label:'Friend',image:'guide-smile'}]},{id:'river',label:'River',portrait:'curator'}]},music:{title:'Observatory music',volume:.2,loop:false,tracks:[{id:'evening',label:'Evening study',asset:'evening-chime'},{id:'missing',label:'Missing track test',asset:'missing-track'}]}};
export const sceneSnapshot={roster:[{id:'alex',score:57,location:'Observatory',relationship:'Colleague',badge:'friend'},{id:'river',score:null,location:null}],track:'evening'};
export const suffix=value=>'<scene-state>'+JSON.stringify(value)+'</scene-state>';
// Original, quiet twelve-second plucked-chord phrase. No borrowed soundtrack.
export function neutralWav(){
 const rate=16000,count=rate*12,bytes=new Uint8Array(44+count*2),v=new DataView(bytes.buffer),write=(at,s)=>[...s].forEach((c,i)=>bytes[at+i]=c.charCodeAt(0));
 write(0,'RIFF');v.setUint32(4,bytes.length-8,true);write(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);write(36,'data');v.setUint32(40,count*2,true);
 const notes=[[0,130.81],[.6,196],[1.2,246.94],[1.8,293.66],[3,110],[3.6,164.81],[4.2,220],[4.8,261.63],[6,87.31],[6.6,130.81],[7.2,174.61],[7.8,220],[9,130.81],[9.5,196],[10,261.63]];
 for(let i=0;i<count;i++){const t=i/rate;let value=0;for(const [start,f] of notes){const x=t-start;if(x<0||x>4)continue;const envelope=(1-Math.exp(-x*18))*Math.exp(-x*1.4);value+=envelope*(Math.sin(2*Math.PI*f*x)+.18*Math.sin(2*Math.PI*f*2*x));}value*=Math.min(1,(12-t)/1.5);v.setInt16(44+i*2,Math.round(2600*value),true);}return bytes;
}
