// A trailing, balanced translation pair is a display convention, not language detection.
// Keep the full text for ordinary chat mode; neither text is interpreted as HTML.
export function taggedDialogue(raw,quoted=false){
 let text=raw.trim();if(!text||text.length>12000)return null;
 const closing={'"':'"','“':'”'};
 const endQuote=closing[text[0]];
 if(quoted){
  if(!endQuote)return null;
  let end=-1;for(let i=1;i<text.length;i++){if(text[i]==='\\'){i++;continue;}if(text[i]===endQuote){end=i;break;}}
  if(end<0)return null;
  if(text.endsWith(endQuote))text=text.slice(1,-1);
 }
 const end=text.at(-1),open=end===')'?'(':end==='」'?'「':null;
 if(!open)return {dialogue:text};
 let depth=0,start=-1;
 for(let i=text.length-1;i>=0;i--){if(text[i]===end)depth++;else if(text[i]===open&&--depth===0){start=i;break;}}
 if(start<=0)return {dialogue:text};
 let original=text.slice(0,start).trim(),translation=text.slice(start+1,-1).trim();
 const q=closing[original[0]];if(q&&original.endsWith(q))original=original.slice(1,-1).trim();
 if(!original||!translation)return {dialogue:text};
 // Do not hide earlier/unmatched translation delimiters as part of the original.
 if(/[()「」]/.test(original))return {dialogue:text};
 return {dialogue:text,originalDialogue:original,translatedDialogue:translation};
}
