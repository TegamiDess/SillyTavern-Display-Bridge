import {compilePortraits} from '/extension/adapters/witchcure-portraits.js';
import {createPortrait} from '/extension/components/witchcure-portrait.js';

export async function runAuditTests({test,assert,setup,wait,characters}) {
    await test('JSON and PNG imports still isolate assets and preserve the PNG avatar fallback',async()=>{
        const png=new Uint8Array(await(await fetch('/user/files/picture.png')).arrayBuffer());
        for(const format of ['json','png']) {
            setup('',{stream:false});const start=characters.length,avatar='audit-'+format+'.png';
            const card={spec:'chara_card_v3',spec_version:'3.0',data:{name:'Neutral audit '+format,first_mes:'Hello.',assets:[],extensions:{}}};
            let drops=0;const imported={name:card.data.name,avatar,data:{extensions:{regex_scripts:[]}}};
            window.fixtureImport={drop:async files=>{
                const zip=await JSZip.loadAsync(await files[0].arrayBuffer()),isolated=JSON.parse(await zip.file('card.json').async('string'));
                assert(files[0].name==='isolated-import.charx');
                if(format==='png'){assert(isolated.data.assets[0].type==='icon');assert(zip.file('v3-import-avatar.png'),'Original PNG avatar was lost');}
                else assert(!isolated.data.assets.length);
                drops++;characters.push(imported);
            },fetch:async(url,options)=>{
                const body=JSON.parse(options?.body??'{}'),response=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
                if(url==='/api/files/sanitize-filename')return response({fileName:body.fileName});
                if(url==='/api/images/folders')return response([]);
                if(url==='/api/characters/get')return response(imported);
                if(String(url).startsWith('/api/'))throw Error('Unexpected API '+url);
                return globalThis.fetch(url,options);
            }};
            try {
                let bytes=new TextEncoder().encode(JSON.stringify(card));
                if(format==='png'){
                    const payload=new TextEncoder().encode('ccv3\0'+btoa(String.fromCharCode(...bytes)));
                    const chunk=new Uint8Array(payload.length+12);new DataView(chunk.buffer).setUint32(0,payload.length);chunk.set(new TextEncoder().encode('tEXt'),4);chunk.set(payload,8);
                    // Valid PNG CRC over the type and payload, before IEND.
                    let crc=0xffffffff;for(const byte of chunk.subarray(4,-4)){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}new DataView(chunk.buffer).setUint32(chunk.length-4,(crc^0xffffffff)>>>0);
                    bytes=new Uint8Array(png.length+chunk.length);bytes.set(png.subarray(0,-12));bytes.set(chunk,png.length-12);bytes.set(png.subarray(-12),bytes.length-12);
                }
                await window.v3sprites.import(new File([bytes],'audit.'+format));assert(drops===1,'Import did not reach native handoff');
            }finally{delete window.fixtureImport;characters.splice(start);}
        }
    });
    await test('Imported portrait CSS cannot paint or intercept clicks outside its widget',async()=>{
        setup('',{stream:false});
        const source={portraits:[{name:'Neutral',template:'<div class="audit-container"><div class="audit-image-wrapper"><img class="audit-image" src="{{raw::$1}}"><div class="audit-emoji">*</div></div></div>'}],styles:'<style>.audit-image-wrapper{position:fixed;left:0;top:0;width:2000px;height:2000px;z-index:999999;background:red}</style>'};
        const compiled=compilePortraits(source,window.cssTools);
        const widget=createPortrait({type:'witchcure-portrait',name:'Neutral'},{witchcure:{portraits:compiled.portraits,portraitCSS:compiled.css},resolver:()=>({status:'missing'})});
        widget.host.style.cssText='width:200px;height:100px;margin:0';
        const next=document.createElement('button');next.textContent='Unrelated chat control';next.style.cssText='display:block;height:40px;width:200px';
        document.querySelector('.mes_text').append(widget.host,next);widget.host.scrollIntoView({block:'center'});await wait();
        const box=next.getBoundingClientRect(),hit=document.elementFromPoint(box.left+20,box.top+20);
        assert(hit===next,'Imported portrait overlay intercepts an unrelated chat control');
    });
}
