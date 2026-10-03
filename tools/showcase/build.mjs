import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import os from 'node:os';

// Rebuild the public display-only replay; never reads cards, chats or settings.
const here=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(here,'../..');
const host=process.argv[2];
if(!host)throw Error('Usage: node tools/showcase/build.mjs /path/to/installed/SillyTavern');
const webpack=createRequire(path.resolve(host,'package.json'))('webpack');
const destination=path.join(repo,'docs/index.html');
const current=fs.readFileSync(destination,'utf8');
const encoded=current.match(/<script id="scene-data" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
if(!encoded)throw Error('Public replay data is missing');
const data=JSON.parse(encoded);
if(data.rounds?.length!==10||data.rounds.reduce((n,r)=>n+r.scenes.length,0)!==20)throw Error('Unexpected replay shape');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'display-bridge-showcase-'));
try{
 await new Promise((resolve,reject)=>webpack({mode:'production',entry:path.join(here,'viewer.js'),output:{path:temp,filename:'viewer.js'},devtool:false,optimization:{minimize:true},performance:{hints:false}},(error,stats)=>error||stats.hasErrors()?reject(error??Error(stats.toString({all:false,errors:true}))):resolve()));
 const script=fs.readFileSync(path.join(temp,'viewer.js'),'utf8').replace(/<\/script/gi,'<\\/script');
 const safeData=JSON.stringify(data).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
 const html=fs.readFileSync(path.join(here,'shell.html'),'utf8').replace('/* VIEWER_SCRIPT */',script).replace('/* SCENE_DATA */',safeData);
 fs.writeFileSync(destination,html);
 console.log('Rebuilt docs/index.html from the public replay and current renderer.');
}finally{
 // Remove only the files this invocation created in its unique temporary folder.
 for(const name of fs.readdirSync(temp))fs.unlinkSync(path.join(temp,name));
 fs.rmdirSync(temp);
}
