// Declarative scene data only. Risu state evaluation belongs to a later stage.
const fail=message=>{throw Error('Scene controls: '+message);};
const obj=x=>x&&typeof x==='object'&&!Array.isArray(x);
const shape=(x,keys)=>{if(!obj(x)||Object.keys(x).some(k=>!keys.includes(k)))fail('unknown fields');};
const text=(x,n=256)=>typeof x==='string'&&x.trim()&&x.length<=n&&!/[\u0000-\u001f]/.test(x);
const id=x=>text(x,60)&&/^[A-Za-z][\w-]*$/.test(x)&&!['constructor','prototype','__proto__'].includes(x);
export function validateSceneControls(c){
    shape(c,['version','roster','music']);if(c.version!==1||(!c.roster&&!c.music))fail('invalid version or empty controls');
    if(c.roster){
        shape(c.roster,['title','entities','labels']);if(!text(c.roster.title,80)||!Array.isArray(c.roster.entities)||!c.roster.entities.length||c.roster.entities.length>32)fail('invalid roster');
        if(c.roster.labels!==undefined){shape(c.roster.labels,['score','location','relationship']);if(Object.values(c.roster.labels).some(v=>!text(v,80)))fail('invalid field labels');}
        const ids=new Set();for(const e of c.roster.entities){shape(e,['id','label','portrait','badges']);if(!id(e.id)||ids.has(e.id)||!text(e.label,80)||(e.portrait!==undefined&&!text(e.portrait)))fail('invalid entity');ids.add(e.id);
            if(e.badges!==undefined){if(!Array.isArray(e.badges)||e.badges.length>16)fail('invalid badges');const keys=new Set();for(const b of e.badges){shape(b,['id','label','image']);if(!id(b.id)||keys.has(b.id)||!text(b.label,80)||(b.image!==undefined&&!text(b.image)))fail('invalid badge');keys.add(b.id);}}
        }
    }
    if(c.music){shape(c.music,['title','tracks','volume','loop']);if(!text(c.music.title,80)||!Array.isArray(c.music.tracks)||!c.music.tracks.length||c.music.tracks.length>128||!Number.isFinite(c.music.volume)||c.music.volume<0||c.music.volume>1||typeof c.music.loop!=='boolean')fail('invalid music');const ids=new Set();for(const t of c.music.tracks){shape(t,['id','label','asset']);if(!id(t.id)||ids.has(t.id)||!text(t.label,80)||!text(t.asset))fail('invalid track');ids.add(t.id);}}
}
export function validateSceneSnapshot(value,c){
    shape(value,['roster','track']);
    if(value.roster!==undefined){if(!c.roster||!Array.isArray(value.roster)||value.roster.length>32)fail('invalid roster snapshot');const ids=new Set();for(const row of value.roster){shape(row,['id','score','location','relationship','badge']);const entity=c.roster.entities.find(e=>e.id===row.id);if(!entity||ids.has(row.id))fail('unknown or repeated entity');ids.add(row.id);if(row.score!==undefined&&row.score!==null&&(!Number.isFinite(row.score)||Math.abs(row.score)>1000000))fail('invalid score');for(const k of ['location','relationship'])if(row[k]!==undefined&&row[k]!==null&&!text(row[k]))fail('invalid '+k);if(row.badge!==undefined&&row.badge!==null&&!entity.badges?.some(b=>b.id===row.badge))fail('unknown badge');}}
    if(value.track!==undefined&&value.track!==null&&(!c.music||!c.music.tracks.some(t=>t.id===value.track)))fail('unknown track');
    return JSON.parse(JSON.stringify(value));
}
// An optional complete snapshot immediately follows its scene. No carry-over,
// increments, source macros or writes to chat are performed during rendering.
export function sceneSnapshotSuffix(source,end,config){
    if(!config.sceneControls)return {end};
    const tail=source.slice(end,end+16000),open=/^\s*<scene-state>/.exec(tail);
    if(!open)return {end};
    const close=tail.indexOf('</scene-state>',open[0].length);
    if(close<0)return {end,snapshotIssue:'Incomplete scene snapshot'};
    try{return {end:end+close+14,sceneSnapshot:validateSceneSnapshot(JSON.parse(tail.slice(open[0].length,close)),config.sceneControls)};}
    catch{return {end,snapshotIssue:'Unsupported scene snapshot; original annotation retained'};}
}
