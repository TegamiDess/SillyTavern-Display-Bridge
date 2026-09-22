import { compileWitchcure } from '/extension/adapters/witchcure.js';
import { SAMPLE } from '/extension/core/bridge.js';

export async function runWitchcureTests({test,assert,setup,native,wait,ctx,characters,extension_settings,bridge}) {
    const source = await (await fetch('./witchcure-fixture.json')).json();
    const card = {data:{extensions:{risuai:{backgroundHTML:source.styles,customScripts:[
        {type:'editdisplay',in:String.raw`\[명부\]`,out:source.roster},
        {type:'editdisplay',in:String.raw`\[평가 보고서\]`,out:source.report},
        {type:'editdisplay',in:'<MAP>(.*?)</MAP>',out:source.map},
        {type:'editdisplay',in:'status',out:source.status},
    ]}}}};
    const root = () => document.querySelector('.mes_text');
    await test('Malformed Witchcure controls fail validation before replacing a saved profile',()=>{
        for(const roster of [source.roster.replace('regex-witch-roster-toggle','broken-toggle'),source.roster.replace('regex-witch-roster-grid','broken-grid')]) {
            let rejected=false;try{compileWitchcure({...source,roster},window.cssTools);}catch{rejected=true;}
            assert(rejected,'Broken controls were reported as compatible');
        }
    });
    const host = () => document.querySelector('[data-adapter=witchcure]');
    const shadow = () => host().shadowRoot;
    function start(text='Before **bold**\n\n[명부]\n\nAfter.') {
        setup(text);
        characters[0].data.extensions.risuai=card.data.extensions.risuai;
        bridge().setEnabled('test-a.png',true);
        bridge().setWitchcureEnabled('test-a.png',true);
    }
    await test('Witchcure imports both source templates and retains their relevant CSS', () => {
        const compiled=compileWitchcure(source,window.cssTools);
        assert(compiled.summary.assets.length===10);
        assert(compiled.summary.retainedRules===100,`Retained ${compiled.summary.retainedRules}`);
        assert(compiled.summary.omittedRules>0);
        assert(!compiled.css.includes('url('));
        assert(!compiled.roster.includes('onclick'));
        assert(!compiled.roster.includes('{{'));
        start(); assert(host()); assert(shadow().querySelectorAll('.regex-witch-frame').length===10);
        assert(getComputedStyle(shadow().querySelector('.regex-witch-roster-toggle + label')).backgroundColor==='rgb(82, 48, 124)');
        assert(root().querySelector('strong').textContent==='bold');
    });
    await test('Witchcure remains opt-in and does not append missing roster markers', () => {
        setup('[명부]'); bridge().setEnabled('test-a.png',true); assert(!host());
        bridge().setWitchcureEnabled('test-a.png',true); assert(host());
        native('An ordinary message.'); bridge().render(); assert(!host());
        assert(ctx.chat[0].mes==='An ordinary message.');
    });
    await test('Stream and Witchcure toggles work independently within the same message', () => {
        const message = setup(SAMPLE + '\n\n[명부]', { stream: false });
        characters[0].data.extensions.risuai = card.data.extensions.risuai;
        const saved = JSON.stringify(message);
        const streamHost = () => document.querySelector('.display-bridge-widget:not([data-adapter=witchcure])');
        bridge().setEnabled('test-a.png', true);
        bridge().setWitchcureEnabled('test-a.png', true);
        assert(host() && !streamHost());
        bridge().setStreamEnabled('test-a.png', true); assert(host() && streamHost());
        bridge().setStreamEnabled('test-a.png', false); assert(host() && !streamHost());
        assert(root().textContent.includes('Assets:'));
        bridge().setStreamEnabled('test-a.png', true);
        bridge().setWitchcureEnabled('test-a.png', false); assert(!host() && streamHost());
        assert(root().textContent.includes('[명부]'));
        bridge().setStreamEnabled('test-a.png', false); assert(!host() && !streamHost());
        assert(JSON.stringify(message) === saved);
    });
    await test('Roster/report switch, repeated switching and stored-source preservation', async () => {
        start(); const saved=JSON.stringify(ctx.chat);
        for(let i=0;i<8;i++) {
            shadow().querySelector('[data-db-switch]').click(); await wait();
            assert(!!shadow().querySelector('.assessment-report-wrapper')===(i%2===0));
        }
        assert(JSON.stringify(ctx.chat)===saved);
        assert(shadow().querySelectorAll('[data-db-switch]').length===1);
    });
    await test('Portrait detail navigation, one open detail, keyboard and Escape', () => {
        start();
        shadow().querySelector('label[for="witch-detail-1"]').click();
        assert(shadow().querySelector('#witch-detail-1').checked);
        assert(shadow().querySelector('.witch-detail-1-page').getAttribute('aria-hidden')==='false');
        assert(shadow().activeElement===shadow().querySelector('.witch-detail-1-page'));
        assert(shadow().querySelector('.witch-detail-1-page').scrollTop===0);
        assert(getComputedStyle(shadow().querySelector('.witch-detail-1-page')).position==='relative');
        shadow().querySelector('label[for="witch-detail-2"]').click();
        assert(!shadow().querySelector('#witch-detail-1').checked);
        shadow().querySelector('.regex-witch-roster-wrapper').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
        assert(!shadow().querySelector('#witch-detail-2').checked);
        const frame=shadow().querySelector('label[for="witch-detail-3"]');
        frame.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
        assert(shadow().querySelector('#witch-detail-3').checked);
    });
    await test('Recent-message visibility updates older unchanged messages and restores native text', async () => {
        start('[명부]'); native('[명부]',{id:1}); await wait();
        assert([...document.querySelectorAll('[data-adapter=witchcure]')].filter(x=>!x.hidden).length===2);
        native('New reply',{id:2}); await wait();
        assert(document.querySelector('.mes[mesid="0"] [data-adapter=witchcure]').hidden);
        assert(!document.querySelector('.mes[mesid="1"] [data-adapter=witchcure]').hidden);
        assert(!root().textContent.includes('[명부]'));
        bridge().setEnabled('test-a.png',false);
        assert(root().textContent.includes('[명부]')); assert(!host());
        assert(ctx.chat[0].mes==='[명부]');
    });
    await test('Direct report marker, shared chat mode, fresh chat and character isolation', async () => {
        start('[평가 보고서]'); assert(shadow().querySelector('.assessment-report-wrapper'));
        shadow().querySelector('[data-db-switch]').click(); await wait();
        assert(shadow().querySelector('.regex-witch-roster-wrapper'));
        native('[평가 보고서]',{id:1}); await wait();
        assert([...document.querySelectorAll('[data-adapter=witchcure]')].every(x=>x.shadowRoot.querySelector('.regex-witch-roster-wrapper')));
        ctx.characterId=1; bridge().render(); assert(!host());
        ctx.characterId=0; bridge().render(); assert(host());
        ctx.chat=[]; document.getElementById('chat').replaceChildren(); native('[평가 보고서]'); bridge().render();
        assert(shadow().querySelector('.assessment-report-wrapper'));
    });
    await test('Unsafe templates, extra macros and CSS resources are rejected before saving', () => {
        for(const candidate of [
            {...source,roster:source.roster.replace('class="regex-witch-roster-wrapper"','class="regex-witch-roster-wrapper" onclick="alert(1)"')},
            {...source,roster:source.roster.replace('마녀 명부','{{unknown::value}}')},
            {...source,styles:source.styles+'<style>.regex-witch-frame{background:url(https://example.invalid/a.png)}</style>'},
            {...source,styles:source.styles+'<style>@import "https://example.invalid/x.css";</style>'},
        ]) { let rejected=false;try{compileWitchcure(candidate,window.cssTools);}catch{rejected=true;}assert(rejected); }
        start(); const saved=JSON.stringify(extension_settings.display_bridge);
        let rejected=false;try{bridge().attachWitchcure('test-a.png',{data:{extensions:{risuai:{}}}});}catch{rejected=true;}
        assert(rejected);assert(JSON.stringify(extension_settings.display_bridge)===saved);
    });
    await test('Missing card source can be attached; stored attachment excludes prompts and triggers', () => {
        setup('[명부]'); delete characters[0].data.extensions.risuai;
        bridge().setEnabled('test-a.png',true);bridge().setWitchcureEnabled('test-a.png',true);
        assert(!host());assert(bridge().diagnostics().witchcure.includes('missing'));
        bridge().attachWitchcure('test-a.png',card);assert(host());
        const attached=extension_settings.display_bridge.profiles['test-a.png'].witchcureSource;
        assert(Object.keys(attached).sort().join(',')==='map,report,roster,status,styles');
    });
    await test('Named chats isolate view state when SillyTavern reuses its chat array', async () => {
        start('[명부]'); ctx.chatId='chat-one'; bridge().render();
        shadow().querySelector('[data-db-switch]').click(); await wait();
        assert(shadow().querySelector('.assessment-report-wrapper'));
        ctx.chatId='chat-two'; bridge().render();
        assert(shadow().querySelector('.regex-witch-roster-wrapper'));
        ctx.chatId='chat-one'; bridge().render();
        assert(shadow().querySelector('.assessment-report-wrapper'));
        delete ctx.chatId;
    });
    delete characters[0].data.extensions.risuai;
}
