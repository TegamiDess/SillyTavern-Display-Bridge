import { extractPresentationStyle } from './presentation-style.js';
import { COMMUNITY_PATTERN } from './presentation-formats.js';

const text=x=>typeof x==='string'&&x.trim()&&x.length<=256&&!/[<>${}\r\n]/.test(x);
// Match structure and field roles, never an author or card name. These trees
// only describe bindings; source HTML, styles and handlers are not installed.
function tree(html){
 const root={children:[]},stack=[root];let offset=0;
 for(const m of html.matchAll(/<[^<>]*>|[^<]+/g)){if(m.index!==offset)throw Error('Malformed template');offset+=m[0].length;const raw=m[0];
  if(!raw.startsWith('<')){if(raw.trim())stack.at(-1).children.push(raw.trim());continue;}
  const end=/^<\/(div|span)\s*>$/.exec(raw);if(end){if(stack.pop()?.tag!==end[1]||!stack.length)throw Error('Unbalanced template');continue;}
  const open=/^<(div|span|img)((?:\s+[^<>]*?)?)\s*\/?\s*>$/.exec(raw);if(!open)throw Error('Additional markup needs a reviewed profile');
  const attrs={};let used=0;for(const a of open[2].matchAll(/\s+(class|src|alt)="([^"<>]*)"/g)){if(a.index!==used||Object.hasOwn(attrs,a[1]))throw Error('Additional attributes need review');used+=a[0].length;attrs[a[1]]=a[2];}if(open[2].slice(used).trim())throw Error('Additional attributes need review');
  const node={tag:open[1],...attrs,children:[],parent:stack.at(-1)};stack.at(-1).children.push(node);if(node.tag!=='img')stack.push(node);
 }if(offset!==html.length||stack.length!==1)throw Error('Unbalanced template');return root;
}
function leaves(node,result=[]){for(const c of node.children??[])if(typeof c!=='string'){result.push(c);leaves(c,result);}return result;}
function unwrap(html){let recent;const m=/^\{\{#if \{\{greater_equal::\{\{chat_index\}\}::\{\{\? \{\{lastmessageid\}\}-(\d+)\}\}\}\}\}\}\s*([\s\S]*?)\s*\{\{\/if\}\}$/.exec(html.trim());if(m){recent=Number(m[1])+1;html=m[2];}return {html,recent};}
export function inspectPresentationRule(rule,{optionsPreserved=false,styles}={}){
 if(rule.type!=='editdisplay')return null;
 const out=String(rule.out??''),pattern=String(rule.in??'');
 const candidate=/character-area|dialogue-container|dark-container|narration-(?:box|text)|id-card-container|cute-date-info/.test(out);
 if(!candidate)return null;
 try{
  if(!optionsPreserved)throw Error('Reattach source to preserve matching options.');
  // Reviewed grammars contain no line anchors, so the multiline flag is inert.
  const o=rule.matchOptions;
  const bottom=/cute-date-info/.test(out)&&['flag','flags'].some(k=>/^(?:[gm]*<move_bottom>|<move_bottom>[gm]*)$/.test(o?.[k]??''));
  const flagValue=v=>typeof v==='string'&&bottom?v.replace('<move_bottom>',''):v;
  if(o!==undefined&&(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!['ableFlag','flag','flags'].includes(k))||o.ableFlag!==undefined&&typeof o.ableFlag!=='boolean'||['flag','flags'].some(k=>o[k]!==undefined&&!['','g','m','gm','mg'].includes(flagValue(o[k])))))throw Error('Custom source regex flags need review.');
  if(/id-card-container/.test(out)){
   if(pattern!==COMMUNITY_PATTERN)throw Error('Profile card needs the reviewed image plus eleven-field input pattern.');
   const captures=[...out.matchAll(/\$(\d+)/g)].map(m=>+m[1]);if(!Array.from({length:12},(_,i)=>i+1).every(n=>captures.includes(n))||captures.some(n=>n<1||n>12))throw Error('Profile template must bind exactly twelve capture roles.');
   // Text labels preserve the explicit input contract; arbitrary source CSS is omitted.
   return {status:'supported',family:'community',format:{kind:'community'},reason:'Mapped the twelve-field profile format to the built-in notice layout. Source CSS and activity/message actions are not executed.'};
  }
  const {html,recent}=unwrap(out);const suffix=recent===undefined?{}:{recent};
  if(/cute-date-info/.test(html)){
   const m=/^\\\[([^\\|\[\]]+)\\\|\(\.\*\?\)\\\|\(\.\*\?\)\\\|\(\.\*\?\)\\\|\(\.\*\?\)\\\]$/.exec(pattern);
   const values=[...html.matchAll(/<div class="cute-date-info">\$([1-4])<\/div>/g)].map(m=>m[1]).join('');
   if(!m||values!=='1234')throw Error('Status fields need the reviewed time/day/date/location order.');
   return {status:'supported',family:'tagged',entry:{kind:'status',tag:m[1],...suffix,...(bottom?{placement:'bottom'}:{})},reason:'Mapped four status fields and supplied preset visibility/console controls. Original buttons, appearance scripts and story actions are not translated.'};
  }
  const nodes=leaves(tree(html));const leaf=n=>n.children.length===1&&typeof n.children[0]==='string'?n.children[0]:null;
  const images=nodes.filter(n=>n.tag==='img');const captures=nodes.filter(n=>/^\$\d+$/.test(leaf(n)??''));
  const role=ending=>nodes.find(n=>(n.class??'').split(/\s+/).some(c=>ending.test(c)));
  const styled=()=>{
   if(!styles?.rules.length)return {};
   const style=extractPresentationStyle(styles,{container:role(/(?:dialogue-container|dark-container|narration-container)$/),box:role(/(?:dialogue-box|dark-textbox|narration-box)$/),words:captures[0],name:role(/(?:character-fullname|nameplate)$/),image:images[0]});
   return Object.keys(style).length?{style}:{};
  };

  if(!images.length){const match=/^<([A-Za-z][\w-]*)>\(\.\*\?\)<\/\1>$/.exec(pattern);const spaced=/^<\\s\*([A-Za-z][\w-]*)\\s\*>\(\[\\s\\S\]\*\?\)<\\\/\\s\*\1\\s\*>$/.exec(pattern);
   const tag=(match??spaced)?.[1];if(!tag||captures.length!==1||leaf(captures[0])!=='$1'||!/(?:^|-)narration-text$/.test(captures[0].class??''))throw Error('Narration template or tag grammar is unsupported.');
   return {status:'supported',family:'tagged',entry:{kind:'narration',tag,...suffix,...styled()},reason:'Mapped a narration tag to the preset text panel.'};
  }
  if(images.length!==1||captures.length!==1||!/(?:dialogue-text|dark-text)$/.test(captures[0].class??''))throw Error('Expected one portrait and one dialogue text binding.');
  const names=nodes.filter(n=>/(?:character-fullname|nameplate)$/.test(n.class??'')&&text(leaf(n)));if(names.length!==1)throw Error('A single fixed speaker label is required.');const speaker=leaf(names[0]);
  const fixed=/^<([A-Za-z][\w-]*)>"\(\.\*\?\)"<\/\1>$/.exec(pattern);
  const dynamic=pattern===String.raw`<\s*([A-Za-z ]+\.[1-3])\s*>([\s\S]*?)<\/[^>]+>`;
  const portrait=/^\{\{raw::([^{}]+)\}\}$/.exec(images[0].src??'')?.[1];
  if(fixed&&text(portrait)&&leaf(captures[0])==='$1')return {status:'supported',family:'tagged',entry:{kind:'dialogue',tag:fixed[1],quoted:true,speaker,portrait,...suffix,...styled()},reason:'Mapped a quoted character tag with fixed speaker and portrait bindings. Uses the common portrait-behind-dialogue preset.'};
  if(dynamic&&portrait==='$1'&&leaf(captures[0])==='$2')return {status:'supported',family:'tagged',entry:{kind:'dynamic',speaker,...suffix,...styled()},reason:'Mapped portrait-name tags and a fixed speaker. Closing tags must match; mismatched tags remain unsupported.'};
  throw Error('Dialogue tag grammar or portrait binding is unsupported.');
 }catch(e){return {status:'unsupported',reason:e.message};}
}
