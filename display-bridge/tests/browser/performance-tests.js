import {createPresetEditor} from '/extension/components/preset-editor.js';
import {DEFAULT_PRESET,validatePortraitPreset} from '/extension/adapters/portrait-dialogue.js';

export async function runPerformanceTests({test,assert,setup,wait,bridge}) {
    const click=(host,label)=>[...host.querySelectorAll('button')].find(b=>b.textContent===label).click();
    await test('Large asset editor shares suggestions and preserves unopened, edited and removed outfits',async()=>{
        setup('',{stream:false});
        const old=window.v3sprites;
        const names=Array.from({length:1111},(_,i)=>'asset-'+i);
        let resolutions=0,staged;
        window.v3sprites={api:{apiVersion:1,listImages:()=>({status:'available',images:names.map(name=>({name}))}),resolveImage:({reference})=>{resolutions++;return names.includes(reference)?{status:'resolved',url:'/user/files/picture.png'}:{status:'missing'};}}};
        try {
            const variants=Array.from({length:6},(_,i)=>({id:'outfit-'+i,label:'Outfit '+i,images:Object.fromEntries(Array.from({length:4},(_,j)=>['asset-'+j,'asset-'+(4+i*4+j)]))}));
            const source=validatePortraitPreset({...DEFAULT_PRESET,variants});
            const editor=createPresetEditor({avatar:'test-a.png',source,sample:'[Scene|speaker:Alex|text:Welcome|image:asset-0]',review:value=>staged=value,close(){}});
            document.getElementById('extensions_settings2').append(editor);
            assert(resolutions===0,'Opening setup resolved or loaded images');
            assert(editor.querySelectorAll('datalist').length===1&&editor.querySelectorAll('datalist option').length===1111,'Asset suggestions were duplicated');
            assert(editor.querySelectorAll('.db-appearance-option .db-mapping-row').length===0,'Closed outfits created mapping controls');
            click(editor,'Review preset for this character');
            assert(JSON.stringify(staged.variants)===JSON.stringify(source.variants),'Unopened outfits were lost on review');
            assert(editor.querySelectorAll('.db-appearance-option .db-mapping-row').length===0,'Validation constructed closed editors');
            const rows=editor.querySelectorAll('.db-appearance-option');
            const label=editor.querySelector('[aria-label="Character label for asset-0"]');label.value='Renamed guide';label.dispatchEvent(new Event('input'));
            rows[1].open=true;await wait();
            assert(rows[1].querySelectorAll('.db-mapping-row').length===4);
            assert(rows[1].querySelector('.db-portrait-identity').textContent==='Renamed guide');
            const input=rows[1].querySelector('[aria-label="Use image"]');input.value='asset-99';input.dispatchEvent(new Event('input'));
            rows[1].open=false;await wait();
            click(rows[2],'Remove appearance option');click(editor,'Copy form draft to JSON');
            const draft=JSON.parse(editor.querySelector('[aria-label="Draft preset JSON"]').value);
            assert(draft.variants.length===5&&!draft.variants.some(v=>v.id==='outfit-2'));
            assert(draft.variants[1].images['asset-0']==='asset-99','Collapsing lost edited mappings');
            assert(draft.variants[4].images['asset-3']===variants[5].images['asset-3']);
            rows[1].open=true;await wait();assert(rows[1].querySelectorAll('.db-mapping-row').length===4,'Reopening duplicated controls');
            assert(editor.querySelectorAll('datalist option').length===1111);
            click(editor,'Add appearance option');const added=editor.querySelector('.db-appearance-option:last-child');
            assert(added.open&&added.querySelectorAll('.db-mapping-row').length===4,'New outfit was not immediately editable');
            added.querySelector('[aria-label="Option label"]').value='New outfit';
            const target=added.querySelector('[aria-label="Use image"]');target.value='missing';
            added.open=false;await wait();staged=null;click(editor,'Review preset for this character');
            assert(staged===null&&editor.querySelector('.db-editor-status').textContent.includes('Resolve'),'Collapsed invalid mapping bypassed validation');
            editor.remove();
        } finally {window.v3sprites=old;}
    });
    await test('Closed settings skip compatibility scans; opening, reopening and explicit reports remain fresh',async()=>{
        setup('',{stream:false});await wait();
        const old=window.v3sprites;let scans=0;
        window.v3sprites={api:{apiVersion:1,compatibilityApiVersion:1,getCompatibility:()=>{scans++;return {status:'test-'+scans};},resolveImage:()=>({status:'missing'})}};
        try {
            const panel=document.getElementById('display-bridge-settings');
            assert(!panel.open);bridge().render();bridge().render();assert(scans===0,'Closed settings scanned provider');
            panel.open=true;await wait();assert(scans>0&&panel.textContent.includes('test-'+scans),'Opening did not show a fresh report');
            panel.open=false;await wait();const before=scans;bridge().render();assert(scans===before);
            const explicit=bridge().compatibility();assert(scans===before+1&&explicit.provider.status==='test-'+scans,'Explicit report used stale data');
            panel.open=true;await wait();assert(scans>before+1&&panel.textContent.includes('test-'+scans));
        } finally {window.v3sprites=old;}
    });
}
