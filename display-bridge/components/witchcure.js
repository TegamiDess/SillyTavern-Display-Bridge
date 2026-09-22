import { resolveWitchcureImage } from '../integrations/witchcure-assets.js';
import { resolveImage } from '../integrations/assets.js';

// Adapt only layout containment/accessibility. The imported class names,
// palette, frame decoration and content remain those of the source templates.
const ADAPTATIONS = `
:host { all: initial; display: block; width: 100%; margin: 12px 0; contain: layout paint; container-type: inline-size; color-scheme: dark; }
:host([hidden]) { display: none; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
.regex-witch-roster-wrapper, .assessment-report-wrapper { margin: 0 auto; }
.regex-witch-roster-content, .assessment-content { max-height: none; }
.regex-witch-roster-grid, .assessment-grid { grid-template-columns: repeat(5,minmax(0,1fr)); gap: 10px; padding: 16px; }
.regex-witch-detail-page, .assessment-detail-page { position: relative; inset: auto; width: 100%; height: auto; max-height: 75vh; padding: 8px; grid-column: 1 / -1; }
.regex-witch-detail-container, .assessment-detail-container { grid-template-columns: minmax(100px, 30%) minmax(0,1fr); gap: 10px; padding: 12px; }
.regex-witch-detail-text, .assessment-detail-text { overflow-wrap: anywhere; }
[data-db-detail-open] > label { display: none; }
[data-db-detail-open] { display: block !important; padding: 8px; }
label[for] { cursor: pointer; }
label[role=button]:focus-visible, button:focus-visible { outline: 3px solid #eed285; outline-offset: -3px; }
button[data-db-switch] { font-family: inherit; z-index: 2; max-width: 44%; white-space: normal; }
.regex-witch-roster-arrow, .assessment-arrow { display: none; }
.db-missing { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 12px; text-align: center; overflow-wrap: anywhere; background: linear-gradient(135deg,#392d49,#212230); color: #d6c9e1; font: 12px/1.4 system-ui,sans-serif; }
.db-image-frame { position: relative; min-height: 60px; }
.regex-witch-name, .assessment-name, .regex-witch-detail-name, .assessment-detail-name { z-index: 1; }
@container (max-width: 500px) {
 .regex-witch-roster-grid, .assessment-grid { grid-template-columns: repeat(3,minmax(0,1fr)); grid-auto-rows: 145px; gap: 8px; padding: 10px; }
 .regex-witch-detail-container, .assessment-detail-container { display: block; }
 .regex-witch-detail-image-container, .assessment-detail-image-container { height: 240px; max-width: 200px; margin: 0 auto 12px; }
 .regex-witch-roster-toggle + label, .assessment-toggle + label { padding: 10px 8px 42px !important; }
 button[data-db-switch] { top: auto !important; bottom: 7px; right: 50% !important; transform: translateX(50%) !important; max-width: 95%; }
}
@container (max-width: 290px) { .regex-witch-roster-grid, .assessment-grid { grid-template-columns: repeat(2,minmax(0,1fr)); } }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

export function createWitchcure(data, { avatar, resolver = resolveImage, witchcure, getWitchMode = () => null, setWitchMode = () => {} } = {}) {
    const host = document.createElement('span'); host.className = 'display-bridge-widget';
    host.dataset.adapter = 'witchcure';
    const shadow = host.attachShadow({ mode: 'open' });
    let mode, images = [], mounted;
    host.hidden = data.suppressed;

    function bindControls() {
        const switcher = shadow.querySelector('[data-db-switch]');
        switcher.addEventListener('click', event => {
            event.preventDefault(); event.stopPropagation();
            if (!host.isConnected || setWitchMode(mode === 'roster' ? 'report' : 'roster') === false) return;
            draw(mode === 'roster' ? 'report' : 'roster');
            shadow.querySelector('[data-db-switch]').focus();
        });
        const main = shadow.querySelector('.regex-witch-roster-toggle, .assessment-toggle');
        main.checked = false; // Open initially, matching the supplied screenshot.
        const grid = shadow.querySelector('.regex-witch-roster-grid, .assessment-grid');
        const content = shadow.querySelector('.regex-witch-roster-content, .assessment-content');
        const details = [...shadow.querySelectorAll('.regex-witch-detail-toggle, .assessment-detail-toggle')];
        function sync(event) {
            if (event?.target.checked && details.includes(event.target)) {
                details.forEach(input => { if (input !== event.target) input.checked = false; });
            }
            const selected = details.find(input => input.checked);
            grid.toggleAttribute('data-db-detail-open', !!selected);
            content.inert = main.checked;
            content.setAttribute('aria-hidden', String(main.checked));
            for (const label of shadow.querySelectorAll('label[for]')) {
                const input = shadow.getElementById(label.htmlFor);
                const isMain = input === main;
                label.setAttribute('aria-expanded', String(isMain ? !input.checked : input.checked));
            }
            for (const page of shadow.querySelectorAll('.regex-witch-detail-page, .assessment-detail-page')) {
                const number = /(?:witch-detail-|subject-)(\d+)-page/.exec(page.className)?.[1];
                const input = details.find(x => x.id.endsWith('-' + number));
                page.inert = !input?.checked;
                page.tabIndex = -1;
                page.setAttribute('role', 'region');
                page.setAttribute('aria-label', page.querySelector('.regex-witch-detail-name, .assessment-detail-name')?.textContent ?? 'Details');
                page.setAttribute('aria-hidden', String(!input?.checked));
            }
            if (selected && event) {
                const page = [...shadow.querySelectorAll('.regex-witch-detail-page, .assessment-detail-page')].find(x => x.getAttribute('aria-hidden') === 'false');
                if (page) { page.scrollTop = 0; page.focus({ preventScroll: true }); }
            } else if (event && details.includes(event.target)) {
                grid.querySelector(`label[for="${CSS.escape(event.target.id)}"]`)?.focus();
            }
        }
        for (const label of shadow.querySelectorAll('label[for]')) {
            label.tabIndex = 0; label.setAttribute('role', 'button');
            label.addEventListener('keydown', event => {
                if (event.target !== label) return;
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); label.click(); }
            });
        }
        shadow.addEventListener('change', sync);
        // Listener belongs to this draw's wrapper, which is replaced on mode change.
        mounted.addEventListener('keydown', event => {
            if (event.key !== 'Escape') return;
            const selected = details.find(input => input.checked);
            if (!selected) return;
            selected.checked = false; sync();
            grid.querySelector(`label[for="${CSS.escape(selected.id)}"]`)?.focus();
        });
        sync();
        // Register cleanup to avoid retaining previous draw's checkbox nodes.
        mounted.dbCleanup = () => shadow.removeEventListener('change', sync);
    }

    function draw(nextMode) {
        mounted?.dbCleanup?.();
        mode = nextMode;
        const style = document.createElement('style'); style.textContent = witchcure.css + '\n' + ADAPTATIONS;
        const template = document.createElement('template'); template.innerHTML = witchcure[mode];
        shadow.replaceChildren(style, template.content.cloneNode(true));
        mounted = shadow.children[1];
        images = [...shadow.querySelectorAll('img[data-db-asset]')].map(img => {
            const placeholder = document.createElement('span'); placeholder.className = 'db-missing';
            placeholder.textContent = img.alt || img.dataset.dbAsset;
            img.parentElement.classList.add('db-image-frame'); img.after(placeholder); img.hidden = true;
            const record = { img, placeholder, status: 'missing', url: null };
            img.addEventListener('load', () => { img.hidden = false; placeholder.hidden = true; record.status = 'resolved'; window.dispatchEvent(new CustomEvent('display-bridge:image-status')); });
            img.addEventListener('error', () => { img.hidden = true; placeholder.hidden = false; record.status = 'load-failed'; window.dispatchEvent(new CustomEvent('display-bridge:image-status')); });
            return record;
        });
        bindControls(); refreshImages();
    }
    function refreshImages() {
        if (data.suppressed) return;
        for (const record of images) {
            const result = resolveWitchcureImage(avatar, record.img.dataset.dbAsset, resolver);
            if (result.status === 'resolved') {
                if (record.url !== result.url) {
                    record.url = result.url; record.status = 'resolved';
                    record.img.hidden = true; record.placeholder.hidden = false;
                    record.img.src = result.url;
                }
            } else {
                record.status = result.status; record.url = null;
                record.img.removeAttribute('src'); record.img.hidden = true; record.placeholder.hidden = false;
            }
        }
    }
    function refresh() {
        if (data.suppressed) return;
        const next = getWitchMode() ?? data.initialMode;
        if (mode !== next) draw(next); else refreshImages();
    }
    refresh();
    return { host, refresh, imageIssues: () => images.filter(x=>x.status!=='resolved').map(x=>({reference:x.img.dataset.dbAsset,status:x.status})), imageStatus: () => images.some(x => x.status !== 'resolved') ? 'missing' : 'resolved', missingImages: () => images.filter(x => x.status !== 'resolved').length };
}
