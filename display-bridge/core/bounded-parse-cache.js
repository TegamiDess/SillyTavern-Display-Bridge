// Cache deterministic parsing, never saved journal acceptance or applied state.
// Copies isolate cached results from callers and malformed saved update arrays.
export function createBoundedParseCache(parse,{maxEntries=2048,maxSize=8000000}={}){
 let scope=null,size=0;const entries=new Map();
 function clear(){entries.clear();size=0;scope=null;}
 return {clear,read(text,nextScope){
  if(scope!==nextScope){clear();scope=nextScope;}
  let entry=entries.get(text);
  if(entry){entries.delete(text);entries.set(text,entry);return structuredClone(entry.value);}
  const value=parse(text),cost=text.length+JSON.stringify(value).length;
  if(cost<=maxSize&&maxEntries>0){
   while(entries.size>=maxEntries||size+cost>maxSize){const first=entries.keys().next().value;size-=entries.get(first).cost;entries.delete(first);}
   entries.set(text,{value:structuredClone(value),cost});size+=cost;
  }
  return value;
 }};
}
