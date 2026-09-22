import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectPortraitRule } from '../adapters/portrait-recognition.js';
import { REFERENCE_RULE, parsePortraitDialogue } from '../adapters/portrait-dialogue.js';
import { discoverProfile, validateProfile } from '../core/profiles.js';
import { captureDisplaySource } from '../../v3-asset-sprites/display-handoff.js';

const reordered=()=>({type:'editdisplay',in:String.raw`\[Talk\|words:([^\]|]+)\|picture:([^|\]]*)\|who:([^|\]]+?)\]`,out:`<FIGURE class='scene'>\n <IMG alt='$3' class='portrait' src='{{asset::$2}}' />\n <FIGCAPTION><STRONG>$3</STRONG><P>$1</P></FIGCAPTION>\n</FIGURE>`});
const divRule=()=>({type:'editdisplay',in:String.raw`\{Dialogue\|person:([^|}]*)\|says:([^}|]+)\|sprite:([^|}]*)\}`,out:`<div class="portrait-dialogue blue"><img src="$3"><div class="dialogue-box"><span class="speaker">$1</span><div class="dialogue">$2</div></div></div>`});
const inspect=rule=>inspectPortraitRule(rule,{optionsPreserved:true});
const capture=rules=>captureDisplaySource({data:{extensions:{risuai:{customScripts:rules}}}}, {format:'charx'});

test('Recognition extracts changed field names and reordered bindings through equivalent HTML',()=>{
 const result=inspect(reordered());assert.equal(result.status,'supported',result.reason);assert.deepEqual(result.source.format,{kind:'fields',open:'[Talk|',close:']',fields:{speaker:'who',dialogue:'words',portrait:'picture'}});
 const block=parsePortraitDialogue('[Talk|words:Welcome to the museum.|picture:guide|who:Robin]',result.source).blocks[0];assert.equal(block.speaker,'Robin');assert.equal(block.dialogue,'Welcome to the museum.');assert.equal(block.portrait,'guide');assert.equal(result.source.variants.length,0);
});
test('Div layout and brace-delimited source compile to the same preset renderer',()=>{
 const result=inspect(divRule());assert.equal(result.status,'supported',result.reason);assert.equal(result.source.format.open,'{Dialogue|');assert.equal(parsePortraitDialogue('{Dialogue|person:Alex|says:Ready.|sprite:guide}',result.source).blocks[0].speaker,'Alex');
 const profile=discoverProfile(capture([divRule()])).profile;assert.deepEqual(validateProfile(profile),profile);
});
test('Input matching grammar rejects operators, malformed captures and ambiguous fields without running regex',()=>{
 for(const pattern of [String.raw`(a+)+$`,reordered().in.replace('([^\\]|]+)','(.*?)'),reordered().in+'$',reordered().in.replace('words:','who:'),reordered().in.replace('([^|\\]]*)','([^|\\]x]*)'),reordered().in.replace('([^|\\]]*)','(?<image>[^|\\]]*)')]){
  const result=inspect({...reordered(),in:pattern});assert.equal(result.status,'unsupported',pattern);
 }
});
test('Additional scripting, markup, attributes and duplicate bindings are rejected, not silently dropped',()=>{
 for(const out of [reordered().out+'<script>throw 1</script>',reordered().out.replace('<IMG ','<IMG onerror="alert(1)" '),reordered().out.replace("src='{{asset::$2}}'","src='https://example.com/$2'"),reordered().out.replace('<STRONG>$3','<STRONG>$1'),reordered().out.replace('<P>$1','<P>{{getvar::state}} $1'),reordered().out.replace("class='scene'","style='position:fixed'"),reordered().out+'<button>Toggle</button>'])assert.equal(inspect({...reordered(),out}).status,'unsupported',out);
});
test('Importer retains regex option metadata without retaining unrelated rule fields',()=>{
 const source=capture([{...reordered(),ableFlag:true,flag:'gi',secret:'omit'}]);assert.equal(source.ruleOptionsVersion,1);assert.deepEqual(source.risuai.customScripts[0].matchOptions,{ableFlag:true,flag:'gi'});assert(!JSON.stringify(source).includes('secret'));
 const result=discoverProfile(source);assert.equal(result.profile,null);assert.match(result.discovery.rules[0].reason,/flags/);assert(!JSON.stringify(result.discovery).includes(reordered().in));
});
test('Old retained envelopes require renewed option capture for broader recognition; legacy exact rule remains supported',()=>{
 const source=capture([reordered()]);delete source.ruleOptionsVersion;assert.equal(discoverProfile(source).profile,null);assert.match(discoverProfile(source).discovery.rules[0].reason,/Reattach/);
 assert(discoverProfile({sourceVersion:1,risuai:{customScripts:[REFERENCE_RULE]}}).profile);
 for(const matchOptions of [{ableFlag:true,flag:'g'},{ableFlag:false,flag:''},{}])assert.equal(inspect({...reordered(),matchOptions}).status,'supported');
 for(const matchOptions of [{flag:'i'},{flag:'s'},{ableFlag:'false'},{flags:'<inject>'},{unknown:true}])assert.equal(inspect({...reordered(),matchOptions}).status,'unsupported');
});
test('Equivalent duplicate rules coalesce; differing or partially unsupported candidates never select the first silently',()=>{
 const first=reordered(),duplicate={...first,out:first.out.replace("class='scene'","class='other'")};
 const success=discoverProfile(capture([first,duplicate]));assert.equal(success.profile.adapters.length,1);assert(success.discovery.rules.every(r=>r.status==='adapted'));
 for(const other of [divRule(),{...first,out:first.out+'<button>Extra</button>'}]){const result=discoverProfile(capture([first,other]));assert.equal(result.profile,null);assert(result.discovery.rules.every(r=>r.status==='not-translated'));assert.match(result.discovery.rules[0].reason,/Other portrait/);}
});
test('Explicit profiles take precedence over source discovery, including incompatible candidate rules',()=>{
 const source=capture([divRule()]);source.profile={kind:'display-bridge-profile',schemaVersion:1,adapters:[{id:'gallery',version:1}]};assert.equal(discoverProfile(source).profile.adapters[0].id,'gallery');assert(discoverProfile(source).discovery.explicitProfile);
});

test('Malformed option payloads are rejected without retaining unrelated nested data',()=>{
 const source=capture([{...reordered(),flag:{privatePrompt:'must not travel'},ableFlag:'yes'}]);assert(!JSON.stringify(source).includes('privatePrompt'));assert.deepEqual(source.risuai.customScripts[0].matchOptions,{ableFlag:null,flag:null});assert.equal(discoverProfile(source).profile,null);
});
