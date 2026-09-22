import { compileWitchcure } from '/extension/adapters/witchcure.js';
import { makePlan, renderPlan } from '/extension/core/pipeline.js';
export const GALLERY = 'DC[GN:Streamer gallery|PID:A|PNUM:801|PT:Drawing stream|PA:Alex|PDATE:20:05|PVIEWS:152|PRECOM:5|PCONT:Welcome to the drawing stream.|C:F:River|Great colours!|C:S:Jun|Hello!|PID:B|PNUM:802|PT:Next topic?|PA:Sam|PDATE:20:08|PVIEWS:230|PRECOM:8|PCONT:Any ideas?|C:Kai|Landscapes]';
export const MAP = '<MAP>탐험 상태 아님|0|0|현재 진행 중인 탐험이 없습니다</MAP>';
export const STATUS = '[마녀 선택 안함|0|0|0|0|트리거 없음|교착 없음|조수 선택 안함|0|0|조수 없음|시너지 없음|2023-10-27|06:45 AM|기숙사 로비|목표 없음|0]';
export async function runAdditionalTests({test,assert,setup,native,wait,ctx,characters,bridge}) {
    const source = await (await fetch('./witchcure-fixture.json')).json();
    const card = {data:{extensions:{risuai:{backgroundHTML:source.styles,customScripts:[
        {type:'editdisplay',in:String.raw`\[명부\]`,out:source.roster},
        {type:'editdisplay',in:String.raw`\[평가 보고서\]`,out:source.report},
        {type:'editdisplay',in:'map',out:source.map}, {type:'editdisplay',in:'status',out:source.status},
    ]}}}};
    const host = type => document.querySelector(`[data-adapter="${type}"]`);
    function start(text) {
        setup(text,{stream:false}); characters[0].data.extensions.risuai=card.data.extensions.risuai;
        bridge().setEnabled('test-a.png',true); bridge().setWitchcureEnabled('test-a.png',true); bridge().setGalleryEnabled('test-a.png',true);
    }
    await test('Gallery renders every post and comment type; actions preserve source and survive refresh',()=>{
        start(GALLERY); const saved=JSON.stringify(ctx.chat),shadow=host('gallery').shadowRoot;
        assert(shadow.querySelectorAll('.post-item').length===2);assert(shadow.querySelectorAll('.icon-fixed').length===1);assert(shadow.querySelectorAll('.icon-half').length===1);
        const title=shadow.querySelector('label'); title.click();assert(!shadow.querySelector('.post-content-wrapper').hidden);
        bridge().render();assert(!shadow.querySelector('.post-content-wrapper').hidden);
        title.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(shadow.querySelector('.post-content-wrapper').hidden);
        assert(JSON.stringify(ctx.chat)===saved);
        bridge().setGalleryEnabled('test-a.png',false);assert(!host('gallery'));assert(document.querySelector('.mes_text').textContent.includes('DC['));
    });
    await test('Repeated galleries isolate controls; stale controls cannot mutate another chat',()=>{
        start(GALLERY+'\n'+GALLERY);const widgets=[...document.querySelectorAll('[data-adapter=gallery]')];
        const old=widgets[0].shadowRoot.querySelector('label');old.click();
        assert(!widgets[0].shadowRoot.querySelector('.post-content-wrapper').hidden);assert(widgets[1].shadowRoot.querySelector('.post-content-wrapper').hidden);
        ctx.chatId='another-chat';bridge().render();assert(host('gallery').shadowRoot.querySelector('.post-content-wrapper').hidden);
        old.click();assert(host('gallery').shadowRoot.querySelector('.post-content-wrapper').hidden);
        delete ctx.chatId;bridge().render();assert(!host('gallery').shadowRoot.querySelector('.post-content-wrapper').hidden);
    });
    await test('Witchcure status binds all fields and numeric bars; status moves above prose',()=>{
        start('Before.\n'+STATUS.replace('|0|0|0|0|','|3|7|2|5|').replace('|목표 없음|0]','|A goal|25]')+'\nAfter.');
        const widget=host('witchcure-status');assert(widget,bridge().diagnostics().witchcure);
        assert(document.querySelector('.mes_text').firstElementChild===widget);
        const shadow=widget.shadowRoot;assert(shadow.querySelector('.goal-progress-fill').style.width==='25%');assert(shadow.querySelector('.trust-fill').style.width==='70%');
        assert(shadow.querySelector('.session-info').textContent.includes('2023-10-27'));
        assert(!shadow.textContent.includes('$17'));assert(!document.querySelector('.mes_text').textContent.includes('@@move_top'));
    });
    await test('Witchcure inactive map opens all nine regions, returns and closes with Escape',()=>{
        start(MAP);const widget=host('witchcure-map');assert(widget,bridge().diagnostics().witchcure);
        const shadow=widget.shadowRoot;assert(shadow.querySelector('.location-title').textContent==='탐험 상태 아님');
        assert(shadow.querySelector('.map-popup').hidden);shadow.querySelector('label[for=map-popup-toggle]').click();assert(!shadow.querySelector('.map-popup').hidden);
        assert(getComputedStyle(shadow.querySelector('.map-popup')).display!=='none');
        for(let i=1;i<=9;i++) {
            shadow.querySelector(`label[for=region-${i}-toggle]`).click();
            const page=shadow.querySelector(`.region-detail-popup-${i}`);assert(!page.hidden);assert(getComputedStyle(page).display!=='none');
            page.querySelector('.region-detail-close').click();assert(page.hidden);
        }
        shadow.querySelector('.map-popup-close').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(shadow.querySelector('.map-popup').hidden);
        assert(ctx.chat[0].mes===MAP);
    });
    await test('Auxiliary recency uses six-message status and two-message map windows',async()=>{
        start(STATUS+'\n'+MAP);
        for(let i=1;i<=2;i++)native('Reply '+i,{id:i});await wait();
        assert(host('witchcure-map').hidden);assert(!host('witchcure-status').hidden);
        for(let i=3;i<=6;i++)native('Reply '+i,{id:i});await wait();assert(host('witchcure-status').hidden);
        bridge().setEnabled('test-a.png',false);assert(!host('witchcure-map'));assert(document.querySelector('.mes_text').textContent.includes('마녀 선택 안함'));
    });
    await test('Gallery edits reset widget state and mixed adapters restore without message writes',async()=>{
        start(GALLERY+'\n'+STATUS+'\n'+MAP+'\n[명부]');const saved=JSON.stringify(ctx.chat);
        host('gallery').shadowRoot.querySelector('label').click();
        bridge().setWitchcureEnabled('test-a.png',false);assert(host('gallery'));assert(!host('witchcure-map'));assert(JSON.stringify(ctx.chat)===saved);
        native(GALLERY.replace('Drawing stream','Edited stream'));await wait();assert(host('gallery').shadowRoot.querySelector('.post-content-wrapper').hidden);
        bridge().setEnabled('test-a.png',false);assert(!host('gallery'));
    });
    await test('Captured markup remains text; imported event handlers and resource CSS fail safely',()=>{
        const compiled=compileWitchcure(source,window.cssTools);
        const malicious=STATUS.replace('목표 없음','<img src=x onerror=alert(1)>');
        const plan=makePlan(malicious,{witchcure:compiled,stream:false});assert(plan.items.length===1);
        const result=renderPlan(plan,plan.source,{witchcure:compiled});const shadow=result.widgets[0].host.shadowRoot;
        assert(shadow.querySelector('.goal-value').textContent.includes('<img'));assert(!shadow.querySelector('.goal-value img'));
        for(const bad of [{...source,map:source.map.replace('class="map-buttons-container"','class="map-buttons-container" onclick="bad()"')},{...source,styles:source.styles+'<style>.map-content{background:url(https://invalid.test)}</style>'}]) {
            let rejected=false;try{compileWitchcure(bad,window.cssTools);}catch{rejected=true;}assert(rejected);
        }
    });
    await test('Risu visibility wrappers leave no stray braces or exposed map checkboxes',()=>{
        start(STATUS+'\n'+MAP);
        for(const type of ['witchcure-status','witchcure-map']) {
            const shadow=host(type).shadowRoot;
            assert(![...shadow.childNodes].some(node=>node.nodeType===3 && node.textContent.trim()), 'Stray text outside template root');
        }
        for(const input of host('witchcure-map').shadowRoot.querySelectorAll('input'))assert(getComputedStyle(input).display==='none');
    });
    const exaggerated = '[None|11|999|15.5|1000|None|None|None|25|-3|None|None|2023-10-27|06:45 AM|Lobby|A goal|150]';
    const longTitle = 'Summary of the current drawing broadcast — a long clickable title that should wrap naturally and remain fully readable';
    const longGallery = GALLERY.replace('Drawing stream',longTitle).replace('PA:Alex','PA:궁예충과아주긴작성자이름(58.123)');
    await test('Exaggerated status scores remain visible while bar widths stay within 0–100%',()=>{
        start(exaggerated);const saved=JSON.stringify(ctx.chat),shadow=host('witchcure-status')?.shadowRoot;
        assert(shadow, 'Out-of-range scores rejected the whole panel');
        for(const [selector,width] of [['.mental-state-fill','100%'],['.trust-fill','100%'],['.risk-fill','100%'],['.self-acceptance-fill','100%'],['.assistant-mental-fill','100%'],['.assistant-coop-fill','0%'],['.goal-progress-fill','100%']])assert(shadow.querySelector(selector).style.width===width,selector);
        assert(shadow.querySelector('.trust .metric-value').textContent.includes('999/10'));
        assert(shadow.querySelector('.goal-progress-value').textContent==='150%');
        assert(JSON.stringify(ctx.chat)===saved);
        bridge().setEnabled('test-a.png',false);assert(document.querySelector('.mes_text').textContent.includes('999'));
    });
    await test('Long gallery titles and authors wrap without clipping at narrow and wide widths',()=>{
        start(longGallery);const widget=host('gallery'),shadow=widget.shadowRoot;
        const title=shadow.querySelector('.post-title-label'),author=shadow.querySelector('.post-row .col-writer'),row=shadow.querySelector('.post-row');
        for(const width of [280,320,700]) {
            widget.style.width=width+'px';
            assert(getComputedStyle(title).whiteSpace==='normal');
            assert(title.scrollWidth<=title.clientWidth+1,'Title overflows at '+width);
            assert(author.scrollWidth<=author.clientWidth+1,'Author overflows at '+width);
            assert(title.getBoundingClientRect().height>parseFloat(getComputedStyle(title).lineHeight),'Title did not wrap');
            assert(row.getBoundingClientRect().height>=title.getBoundingClientRect().height,'Row clips title');
        }
        assert(title.textContent.includes(longTitle));title.click();assert(!shadow.querySelector('.post-content-wrapper').hidden);
    });
    const controls = document.createElement('div'); controls.id = 'inspection-controls';
    for (const [label, text] of [['Show gallery fixture',GALLERY],['Show status fixture',STATUS],['Show map fixture',MAP],['Show long title',longGallery],['Show extreme scores',exaggerated]]) {
        const button = document.createElement('button'); button.textContent = label; button.addEventListener('click',()=>start(text)); controls.append(button);
    }
    const width = document.createElement('button'); width.textContent = 'Toggle phone width';
    width.addEventListener('click',()=>{const chat=document.getElementById('chat');chat.style.width=chat.style.width==='320px'?'':'320px';chat.style.maxWidth='100%';});controls.append(width);
    document.getElementById('chat').before(controls);
    delete characters[0].data.extensions.risuai;
}
