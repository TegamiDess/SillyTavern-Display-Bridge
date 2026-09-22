import { resolveImage } from '../integrations/assets.js';

const CSS = `
:host { all: initial; display: block; width: 100%; margin: 16px 0; color-scheme: dark; }
* { box-sizing: border-box; }
.panel { width: 100%; max-width: 400px; margin: auto; overflow: hidden; border: 1px solid #3c414c; border-radius: 12px; background: #101216; color: #eef1f7; font: 14px/1.5 system-ui, sans-serif; box-shadow: 0 6px 22px #0003; }
.bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 14px; }
.live { font-size: 11px; font-weight: 750; letter-spacing: .13em; color: #ff7079; }
.time { font-size: 12px; color: #c1c6d2; overflow-wrap: anywhere; text-align: right; }
.stage { position: relative; min-height: 280px; aspect-ratio: 4 / 5; background: radial-gradient(ellipse at 50% 25%, #30394b, #161a24 70%); overflow: hidden; }
img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
[hidden] { display: none !important; }
.placeholder { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 24px; text-align: center; color: #c8d0e2; }
.placeholder strong { font-size: 18px; }
.placeholder small { color: #a7b2c9; overflow-wrap: anywhere; max-width: 100%; }
.highlight { position: absolute; top: 16px; left: 5%; width: 90%; margin: 0; color: #ff7c85; font-size: 22px; font-weight: 750; text-align: center; text-shadow: 0 2px 5px #000; overflow-wrap: anywhere; white-space: pre-wrap; }
.chat { position: absolute; inset: 0; background: #171b24f5; padding: 14px; overflow: auto; visibility: hidden; opacity: 0; transition: opacity .15s; }
.stage.peek .chat, .panel.open .chat { visibility: visible; opacity: 1; }
.stage.peek .highlight, .panel.open .highlight { visibility: hidden; }
h3 { font: 650 13px/1.5 system-ui, sans-serif; margin: 0 0 16px; color: #d4d9e4; }
.message { margin: 0 0 12px; overflow-wrap: anywhere; white-space: pre-wrap; }
.author { color: #9ccfeb; font-weight: 600; }
.author::after { content: ': '; color: #8c95a8; }
.empty { color: #a7b2c9; }
.hint { color: #a7b2c9; font-size: 11px; }
button { appearance: none; font: 600 12px/1.4 system-ui, sans-serif; border: 1px solid #505b72; border-radius: 6px; padding: 7px 10px; color: #eef1f7; background: #262e3d; cursor: pointer; }
button:hover { background: #354259; }
button:focus-visible, .chat:focus-visible { outline: 2px solid #a9ccff; outline-offset: -3px; }
@media (prefers-reduced-motion: reduce) { .chat { transition: none; } }
`;

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

// Parse only the source format's p/span/br grammar in an inert template. Never
// mount these nodes. Reject other markup rather than discard meaningful content.
export function parseChatMarkup(markup) {
    const template = document.createElement('template');
    template.innerHTML = markup;
    const allowed = new Set(['P', 'SPAN', 'BR']);
    for (const node of template.content.querySelectorAll('*')) {
        if (!allowed.has(node.tagName) || node.attributes.length) throw new Error('Chat supports only plain p, span and br elements without attributes.');
    }
    const textOf = node => [...node.childNodes].map(child => child.nodeType === 3 ? child.textContent : child.nodeName === 'BR' ? '\n' : textOf(child)).join('');
    const messages = [];
    for (const child of template.content.childNodes) {
        if (child.nodeType === 3) {
            if (child.textContent.trim()) messages.push({ author: '', text: child.textContent.trim() });
        } else if (child.nodeType === 1 && child.tagName === 'P') {
            const spans = [...child.children];
            const nonWhitespace = [...child.childNodes].some(x => x.nodeType === 3 && x.textContent.trim());
            if (spans.length === 2 && spans.every(x => x.tagName === 'SPAN') && !nonWhitespace) {
                messages.push({ author: textOf(spans[0]), text: textOf(spans[1]) });
            } else messages.push({ author: '', text: textOf(child) });
        } else if (child.nodeType === 1) throw new Error('Chat rows must use p elements.');
    }
    return messages;
}

export function createMediaPanel(data, { avatar, resolver = resolveImage } = {}) {
    const messages = data.messages ?? parseChatMarkup(data.chat);
    const host = el('span');
    host.className = 'display-bridge-widget';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.append(el('style', '', CSS));
    const panel = el('article', 'panel');
    panel.setAttribute('aria-label', 'Stream panel');
    const top = el('div', 'bar');
    top.append(el('span', 'live', '● LIVE'), el('span', 'time', data.timestamp));
    const stage = el('div', 'stage');
    const img = el('img');
    img.alt = data.image;
    img.hidden = true;
    const placeholder = el('div', 'placeholder');
    const status = el('strong', '', 'Image unavailable');
    placeholder.append(status, el('small', '', data.image));
    const highlight = el('p', 'highlight', data.highlight);
    highlight.hidden = !data.highlight;
    const chat = el('section', 'chat');
    chat.id = 'chat';
    chat.tabIndex = -1;
    chat.setAttribute('aria-label', 'Live chat');
    chat.setAttribute('aria-hidden', 'true');
    chat.append(el('h3', '', `Live chat · ${messages.length}`));
    for (const item of messages) {
        const row = el('p', 'message');
        if (item.author) row.append(el('span', 'author', item.author));
        row.append(el('span', '', item.text));
        chat.append(row);
    }
    if (!messages.length) chat.append(el('p', 'empty', 'No chat messages yet.'));
    stage.append(img, placeholder, highlight, chat);
    const bottom = el('div', 'bar');
    const button = el('button', '', 'Show chat');
    button.type = 'button';
    button.setAttribute('aria-controls', 'chat');
    button.setAttribute('aria-expanded', 'false');
    let open = false, peek = false;
    function updateControls() {
        panel.classList.toggle('open', open);
        stage.classList.toggle('peek', peek);
        const visible = open || peek;
        chat.tabIndex = visible ? 0 : -1;
        chat.setAttribute('aria-hidden', String(!visible));
        button.setAttribute('aria-expanded', String(visible));
        button.textContent = open ? 'Hide chat' : 'Show chat';
    }
    button.addEventListener('click', () => { open = !open; peek = false; updateControls(); });
    stage.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') { peek = true; updateControls(); } });
    stage.addEventListener('pointerleave', () => { peek = false; updateControls(); });
    panel.addEventListener('keydown', event => { if (event.key === 'Escape') { open = false; peek = false; updateControls(); button.focus(); } });
    bottom.append(el('span', 'hint', 'Hover over image or open chat'), button);
    panel.append(top, stage, bottom);
    shadow.append(panel);
    let currentURL = null;
    let imageStatus = 'missing';
    const labels = {
        'provider-unavailable': 'Image provider not connected', 'incompatible-provider': 'Image provider needs an update',
        'not-enrolled': 'Enable this character’s images', missing: 'Image not found',
        'invalid-url': 'Image address unavailable', 'provider-error': 'Image lookup unavailable',
    };
    function refresh() {
        const result = resolver(avatar, data.image);
        if (result.status === 'resolved') {
            if (currentURL !== result.url) {
                currentURL = result.url; imageStatus = result.status;
                img.hidden = true; placeholder.hidden = false;
                status.textContent = 'Loading image…';
                img.src = result.url;
            }
        } else {
            currentURL = null; imageStatus = result.status;
            img.removeAttribute('src'); img.hidden = true; placeholder.hidden = false;
            status.textContent = labels[result.status] ?? 'Image unavailable';
        }
    }
    img.addEventListener('load', () => { img.hidden = false; placeholder.hidden = true; imageStatus = 'resolved'; window.dispatchEvent(new CustomEvent('display-bridge:image-status')); });
    img.addEventListener('error', () => { imageStatus = 'load-failed'; img.hidden = true; placeholder.hidden = false; status.textContent = 'Image could not be loaded'; window.dispatchEvent(new CustomEvent('display-bridge:image-status')); });
    refresh();
    return { host, refresh, imageIssues: () => imageStatus==='resolved'?[]:[{reference:data.image,status:imageStatus}], imageStatus: () => imageStatus };
}
