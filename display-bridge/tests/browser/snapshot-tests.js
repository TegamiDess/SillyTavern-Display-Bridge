import {cloneSnapshotMessage,prepareSnapshot} from '/extension/integrations/snapshot.js';
import {createImageViewer} from '/extension/components/image-viewer.js';
import {DEFAULT_PRESET,parsePortraitDialogue} from '/extension/adapters/portrait-dialogue.js';
import {createPortraitDialogue} from '/extension/components/portrait-dialogue.js';

export async function runSnapshotTests({test,assert,setup,bridge}) {
    const root = () => document.querySelector('#chat .mes_text');
    const message = () => root().closest('.mes');
    function container(clone) {const box=document.createElement('div');box.style.width=message().getBoundingClientRect().width+'px';box.append(clone);document.body.append(box);return box;}
    await test('Snapshot omits collapsed reasoning but preserves summaries and open details', async () => {
        setup('',{stream:false});
        root().innerHTML='<details><summary>Reasoning</summary><div><code>hidden_asset_name</code><img src="/user/files/snapshot-missing.png"><span class="display-bridge-widget">hidden widget</span></div><summary>hidden second summary</summary></details><details open><summary>Open reasoning</summary><code>Visible reasoning</code><details><summary>Nested summary</summary>hidden nested text</details></details><details>hidden without summary</details><p>Visible dialogue</p>';
        const original=message().innerHTML,copy=cloneSnapshotMessage(message()),box=container(copy);
        try{
            const report=await prepareSnapshot(box);
            assert(!copy.textContent.includes('hidden'),'Collapsed contents leaked into capture');
            assert(copy.textContent.includes('Reasoning')&&copy.textContent.includes('Nested summary'),'Visible summaries were lost');
            assert(copy.textContent.includes('Visible reasoning')&&copy.textContent.includes('Visible dialogue'),'Visible text was lost');
            assert(report.images===0,'Hidden images were prepared');
            assert(message().innerHTML===original,'Live reasoning changed');
        }finally{box.remove();}
    });
    await test('Snapshot omits collapsed details inside flattened shadow widgets before anonymization', async () => {
        setup('',{stream:false});const host=document.createElement('span');host.className='display-bridge-widget';root().append(host);
        const shadow=host.attachShadow({mode:'open'});shadow.innerHTML='<details><summary>Alex summary</summary><code>hidden shadow text</code></details><details open><summary>Open</summary><p>Alex visible text</p><details><summary>Nested</summary>hidden nested text</details></details>';
        const original=shadow.innerHTML,copy=cloneSnapshotMessage(message());copy.innerHTML=copy.innerHTML.replaceAll('Alex','Anon');
        assert(!copy.textContent.includes('hidden'),'Flattening exposed closed shadow details');
        assert(copy.textContent.includes('Anon summary')&&copy.textContent.includes('Anon visible text')&&copy.textContent.includes('Nested'));
        assert(shadow.innerHTML===original,'Live shadow contents changed');
    });
    await test('Snapshot API flattens current panel state before anonymization without touching live chat', async () => {
        setup('',{stream:false});
        assert(bridge().api.snapshot.apiVersion===1);
        const config={...structuredClone(DEFAULT_PRESET),format:{kind:'tagged',entries:[{kind:'dialogue',tag:'guide',speaker:'Alex',portrait:'guide',quoted:true}]}};
        const data=parsePortraitDialogue('<guide>"Ohayou!" (Good morning, Alex!)</guide>',config).blocks[0];
        const widget=createPortraitDialogue(data,{resolver:()=>({status:'resolved',url:'/user/files/chosen-coat.png'})});
        const paragraph=document.createElement('p');paragraph.append(widget.host);root().append(paragraph);
        const shadow=widget.host.shadowRoot;await shadow.querySelector('img').decode();
        shadow.querySelector('.speech').style.background='color-mix(in srgb, rgb(10, 100, 200) 78%, transparent)';
        const before=shadow.innerHTML,clone=cloneSnapshotMessage(message());
        const copied=clone.querySelector('.display-bridge-widget');
        assert(!copied.shadowRoot&&copied.querySelector('.speech'),'Shadow contents were lost');
        assert(copied.querySelector('img').src.endsWith('/chosen-coat.png'),'Chosen appearance was lost');
        assert(copied.querySelector('.speech').style.backgroundColor.startsWith('rgba('),'Legacy renderer received color() syntax');
        clone.querySelector('.mes_text').innerHTML=clone.querySelector('.mes_text').innerHTML.replaceAll('Alex','Anon');
        const box=container(clone);
        try {
            const report=await prepareSnapshot(box);
            assert(report.images===1&&clone.querySelector('img').src.startsWith('data:image/png;'));
            assert(clone.textContent.includes('Good morning, Anon!'),'Flattening bypassed anonymization');
            assert(clone.querySelector('.display-bridge-widget .speech'),'Anonymization reparented panel contents out of the host');
            assert(Math.abs(clone.getBoundingClientRect().height-message().getBoundingClientRect().height)<2,'Reparsed snapshot gained blank space');
            assert(getComputedStyle(clone.querySelector('.bilingual>[aria-hidden="true"]')).visibility==='hidden');
            assert(shadow.innerHTML===before,'Capture changed live panel HTML/state');
            assert(!clone.querySelector('style,script'),'Shadow styles leaked into the capture document');
        } finally {box.remove();}
    });
    await test('Snapshot preserves compact and independently expanded images outside #chat', async () => {
        setup('',{stream:false});
        for(let i=0;i<2;i++){const img=document.createElement('img');img.src='/user/files/snapshot-'+i+'.png';root().append(img);}
        const viewer=createImageViewer({enabled:()=>true,scope:()=> 'snapshot'});viewer.refresh();
        const buttons=[...root().querySelectorAll('button')];buttons[1].click();
        await Promise.all([...root().querySelectorAll('img')].map(i=>i.decode()));
        const widths=buttons.map(b=>b.getBoundingClientRect().width),original=message().innerHTML;
        const copy=cloneSnapshotMessage(message()),box=container(copy);
        try {await prepareSnapshot(box);const copies=[...copy.querySelectorAll('.db-image-thumbnail')];
            assert(copies[0].getAttribute('aria-expanded')==='false'&&copies[1].getAttribute('aria-expanded')==='true');
            assert(copies.every((b,i)=>Math.abs(b.getBoundingClientRect().width-widths[i])<1),'Capture lost thumbnail sizing');
            assert(copy.querySelectorAll('img[src^="data:image/png;"]').length===2);
            assert(message().innerHTML===original&&!copy.querySelector('.db-image-viewer'));
        } finally {box.remove();viewer.stop();}
    });
    await test('Snapshot eagerly loads lazy local assets and reports failures with a bounded wait', async () => {
        setup('',{stream:false});const box=document.createElement('div');box.style.cssText='position:absolute;top:20000px';
        const image=document.createElement('img');image.loading='lazy';image.src='/user/files/slow-hover.png?snapshot';box.append(image);document.body.append(box);
        try {const report=await prepareSnapshot(box,{timeoutMs:3000});assert(report.images===1&&image.src.startsWith('data:image/png;'));}
        finally {box.remove();}
        const failure=document.createElement('div'),bad=document.createElement('img');bad.src='/user/files/snapshot-missing.png';failure.append(bad);document.body.append(failure);
        try {let error;try{await prepareSnapshot(failure,{timeoutMs:100});}catch(e){error=e;}assert(error?.message.includes('1 local image'),'Missing images silently produced a blank snapshot');}
        finally {failure.remove();}
        let refused=false;try{await prepareSnapshot(document.getElementById('chat'));}catch{refused=true;}assert(refused,'Live chat must not be rewritten');
    });
    await test('Snapshot flattens nested widgets, preserves scroll state and ignores hidden missing portraits', async () => {
        setup('',{stream:false});const host=document.createElement('span');host.className='display-bridge-widget';root().append(host);
        const shadow=host.attachShadow({mode:'open'});shadow.innerHTML='<style>:host{display:block}.scroll{height:40px;overflow:auto}.content{height:150px}</style><div class="scroll"><div class="content">Visible text</div></div>';
        const nested=document.createElement('span');nested.className='display-bridge-widget';shadow.append(nested);nested.attachShadow({mode:'open'}).innerHTML='<span id="chat">Nested portrait</span><img hidden src="/user/files/snapshot-missing.png">';
        const select=document.createElement('select');select.innerHTML='<option>Uniform</option><option>Casual</option>';select.selectedIndex=1;shadow.append(select);
        shadow.querySelector('.scroll').scrollTop=50;
        const copy=cloneSnapshotMessage(message());copy.innerHTML=copy.innerHTML.replaceAll('Nested','Anonymized');const box=container(copy);
        try{await prepareSnapshot(box);assert(copy.textContent.includes('Anonymized portrait'));assert(!copy.querySelector('#chat'),'Shadow-local ID escaped into capture');assert(copy.querySelector('select').selectedIndex===1,'Appearance label lost during anonymization');assert(copy.querySelector('.scroll').scrollTop===50);assert(!copy.querySelector('img').hasAttribute('src'));assert(shadow.querySelector('.scroll').scrollTop===50);}
        finally{box.remove();}
    });
}
