// Optional presentation for ordinary provider images. Custom card panels,
// links and explicitly owned containers retain their own interactions.
export function createImageViewer({enabled,scope}) {
    let chat=null,observer=null,scheduled=0,overlay=null,picture=null;
    let active=null,currentScope=null,hoverTimer=0,stopped=false;
    const wrapped=new Map(),sources=new WeakMap(),listeners=new Map();
    function localSource(image){
        try{const url=new URL(image.getAttribute('src'),document.baseURI);return url.origin===location.origin&&/^\/(?:user\/images\/|user\/files\/|characters\/)/.test(url.pathname)?url.href:null;}catch{return null;}
    }
    function eligible(image,button=null){
        if(!(image instanceof HTMLImageElement)||!localSource(image))return false;
        const owner=image.closest('a,button,figure,details,.display-bridge-widget,[data-db-image-behavior="card"]');
        return !owner||(owner===button&&!button.parentElement?.closest('a,button,figure,details,.display-bridge-widget,[data-db-image-behavior="card"]'));
    }
    function buildOverlay(){
        if(overlay)return;
        overlay=document.createElement('div');overlay.className='db-image-viewer';overlay.hidden=true;overlay.setAttribute('aria-hidden','true');
        const shadow=overlay.attachShadow({mode:'open'}),style=document.createElement('style');
        style.textContent=':host{position:fixed;z-index:2147483000;inset:0;display:grid;place-items:center;pointer-events:none;background:transparent}:host([hidden]){display:none}img{display:block;object-fit:contain;max-width:85vw;max-height:85vh;border:0;border-radius:0;background:transparent;padding:0;margin:0}';
        picture=document.createElement('img');picture.alt='';picture.addEventListener('error',hide);shadow.append(style,picture);document.body.append(overlay);
    }
    function hide(){clearTimeout(hoverTimer);hoverTimer=0;active=null;if(overlay){overlay.hidden=true;picture.removeAttribute('src');}}
    function expanded(button){return button.getAttribute('aria-expanded')==='true';}
    function setExpanded(button,value){
        button.setAttribute('aria-expanded',String(value));button.classList.toggle('db-image-expanded',value);
        button.setAttribute('aria-label',`${value?'Collapse':'Expand'} image: ${wrapped.get(button)?.alt||'Image'}`);
        button.title=value?'Click to collapse':'Hover to preview; click to expand in chat';
    }
    function show(button){
        if(!enabled()||!button.isConnected||expanded(button))return;
        const image=wrapped.get(button),url=image&&localSource(image);
        if(!url)return;
        buildOverlay();clearTimeout(hoverTimer);active=button;picture.src=url;overlay.hidden=false;
    }
    function queue(){if(!scheduled&&!stopped)scheduled=requestAnimationFrame(()=>{scheduled=0;refresh();});}
    function unwrap(button){if(active===button)hide();listeners.get(button)?.abort();listeners.delete(button);if(button.parentNode)button.replaceWith(...button.childNodes);wrapped.delete(button);}
    function refresh(){
        if(stopped)return;
        const current=document.getElementById('chat'),nextScope=scope(),changed=currentScope!==nextScope;currentScope=nextScope;
        if(chat!==current){observer?.disconnect();hide();chat=current;observer=chat?new MutationObserver(queue):null;}
        observer?.disconnect();
        try{
            for(const [button,image] of wrapped){
                if(!enabled()||!chat?.contains(button)||image.parentNode!==button||!eligible(image,button)){unwrap(button);continue;}
                if(changed||sources.get(image)!==image.getAttribute('src')){setExpanded(button,false);if(active===button)hide();sources.set(image,image.getAttribute('src'));}
            }
            if(active&&!active.isConnected)hide();
            // Native redraws/other extensions may copy our HTML without copying
            // event listeners. Remove orphan shells, then bind the current nodes.
            if(enabled())for(const button of chat?.querySelectorAll('.mes_text button.db-image-thumbnail')??[])if(!wrapped.has(button))unwrap(button);
            if(enabled())for(const image of chat?.querySelectorAll('.mes_text img')??[]){
                if(!eligible(image))continue;
                const button=document.createElement('button');button.type='button';button.className='db-image-thumbnail';
                image.replaceWith(button);button.append(image);wrapped.set(button,image);sources.set(image,image.getAttribute('src'));setExpanded(button,false);
                const controller=new AbortController();listeners.set(button,controller);const options={signal:controller.signal};
                button.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch'&&!expanded(button)){clearTimeout(hoverTimer);hoverTimer=setTimeout(()=>show(button),180);}},options);
                button.addEventListener('pointerleave',()=>{clearTimeout(hoverTimer);if(active===button)hide();},options);
                button.addEventListener('focus',()=>show(button),options);button.addEventListener('blur',()=>{if(active===button)hide();},options);
                button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();hide();setExpanded(button,!expanded(button));},options);
                button.addEventListener('keydown',e=>{if(e.key==='Escape'&&expanded(button)){e.preventDefault();e.stopPropagation();hide();setExpanded(button,false);}},options);
            }
        }finally{if(chat&&enabled())observer?.observe(chat,{childList:true,subtree:true,attributes:true,attributeFilter:['src','class','data-db-image-behavior']});}
    }
    function keydown(e){if(active&&e.key==='Escape'){e.preventDefault();hide();}}
    document.addEventListener('keydown',keydown,true);document.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);
    return {refresh,close:hide,stop(){stopped=true;cancelAnimationFrame(scheduled);observer?.disconnect();hide();for(const button of wrapped.keys())unwrap(button);overlay?.remove();document.removeEventListener('keydown',keydown,true);document.removeEventListener('scroll',hide,true);window.removeEventListener('resize',hide);}};
}
