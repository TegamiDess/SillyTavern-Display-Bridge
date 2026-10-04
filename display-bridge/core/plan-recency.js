// Cache the presentation boundaries, not the changing numerical history depth.
// Keep this aligned with makePlan and the supported presentation grammars.
export function planRecency({depth,latestAssistant,portrait,witchcure}){
 return JSON.stringify([
  !!witchcure&&depth<2,!!witchcure&&depth<6,
  !!portrait&&latestAssistant,!!portrait&&latestAssistant&&depth===0,
  portrait?.format?.kind==='scene-fragments'&&portrait.sceneBehavior?.maxMessageDepth!==undefined&&depth>portrait.sceneBehavior.maxMessageDepth,
  portrait?.format?.kind==='tagged'?portrait.format.entries.map(e=>e.recent!==undefined&&depth>=e.recent):null,
 ]);
}
