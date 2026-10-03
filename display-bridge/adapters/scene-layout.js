// Explicit, portable layout choices. No imported CSS or card-name detection.
export function validateSceneLayout(layout,format) {
    const fail=message=>{throw Error('Scene layout: '+message);};
    if(!layout||typeof layout!=='object'||Array.isArray(layout)||Object.keys(layout).some(k=>!['version','aspectRatio','maxWidth','metadataPosition'].includes(k)))fail('unknown fields');
    if(format?.kind!=='scene-fragments'||format.details?.layers)fail('requires non-layered scene fragments');
    if(layout.version!==1)fail('unsupported version');
    const ratio=layout.aspectRatio;
    if(!Array.isArray(ratio)||ratio.length!==2||ratio.some(n=>!Number.isFinite(n)||n<1||n>100)||ratio[0]/ratio[1]<.5||ratio[0]/ratio[1]>4)fail('aspect ratio must be between 1:2 and 4:1');
    if(!Number.isInteger(layout.maxWidth)||layout.maxWidth<320||layout.maxWidth>2400)fail('maximum width must be 320–2400 pixels');
    if(!['top','below'].includes(layout.metadataPosition))fail('metadata position must be top or below');
}
