// Capture-only helpers. No observers, timers or DOM work until Snapshot calls us.
// Flatten only our presentation trees; never run imported templates or actions.
const OWNED = '.display-bridge-widget,button.db-image-thumbnail';
const OMIT = new Set(['STYLE', 'SCRIPT', 'LINK', 'IFRAME', 'OBJECT', 'EMBED']);
const PHRASING = new Set(['SPAN','A','B','BR','CODE','EM','I','IMG','INPUT','LABEL','SELECT','OPTION','OPTGROUP','BUTTON','SMALL','STRONG','TEXTAREA']);

function visibleChildren(node) {
    if (node.tagName === 'DETAILS' && !node.hasAttribute('open')) {
        // Old html2canvas paints collapsed reasoning at invalid positions.
        // Keep the visible summary, but never give the renderer hidden contents.
        const summary = [...node.children].find(child => child.tagName === 'SUMMARY');
        return summary ? [summary] : [];
    }
    return node.shadowRoot?.childNodes ?? node.childNodes;
}

function styleCopier(document) {
    const colors = new Map();
    let context;
    function legacyColors(value) {
        return value.replace(/(?:color|oklab|oklch|lab|lch)\([^()]*\)/gi, token => {
            if (!colors.has(token)) {
                context ??= document.createElement('canvas').getContext('2d', {willReadFrequently:true});
                context.canvas.width = context.canvas.height = 1;
                context.clearRect(0, 0, 1, 1);
                context.fillStyle = token;
                context.fillRect(0, 0, 1, 1);
                const [r,g,b,a] = context.getImageData(0, 0, 1, 1).data;
                colors.set(token, `rgba(${r}, ${g}, ${b}, ${a / 255})`);
            }
            return colors.get(token);
        });
    }
    return (source, target, pseudo) => {
        const computed = document.defaultView.getComputedStyle(source, pseudo);
        for (const key of computed) {
            if (key.startsWith('--') || key === 'content') continue;
            target.style.setProperty(key, legacyColors(computed.getPropertyValue(key)), 'important');
        }
        // Freeze the captured appearance; controls in the copy have no actions.
        target.style.setProperty('animation', 'none', 'important');
        target.style.setProperty('transition', 'none', 'important');
        target.style.setProperty('pointer-events', 'none', 'important');
        return computed;
    };
}

/** Synchronous replacement for el.cloneNode(true), before Snapshot anonymizes it. */
export function cloneSnapshotMessage(source) {
    if (!(source instanceof Element) || !source.isConnected) throw Error('Snapshot needs a connected message element.');
    const document = source.ownerDocument, copyStyle = styleCopier(document);
    function flatten(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return node.cloneNode(true);
        if (OMIT.has(node.tagName)) return document.createTextNode('');
        // ST may put a widget inside <p>. Snapshot's anonymizer serializes and
        // reparses it: block tags would close that paragraph, split our host and
        // duplicate its reserved height. Use legal phrasing tags, retaining the
        // computed display/grid/table styling instead of the source tag name.
        const clone = PHRASING.has(node.tagName) ? node.cloneNode(false) : document.createElement('span');
        if (!PHRASING.has(node.tagName)) for (const attr of node.attributes) clone.setAttribute(attr.name, attr.value);
        for (const attr of [...clone.attributes]) {
            if (/^on/i.test(attr.name) || ['autofocus','srcdoc'].includes(attr.name)) clone.removeAttribute(attr.name);
        }
        copyStyle(node, clone);
        // Shadow-local IDs (including a stream's #chat) must not become global.
        clone.removeAttribute('id');
        clone.removeAttribute('tabindex');
        if (node instanceof HTMLImageElement && node.currentSrc) {
            clone.removeAttribute('srcset'); clone.removeAttribute('sizes'); clone.src = node.currentSrc;
        }
        if (node instanceof HTMLInputElement) {clone.setAttribute('value', node.value);clone.toggleAttribute('checked', node.checked);}
        const children = visibleChildren(node);
        for (const child of children) clone.append(flatten(child));
        if (node instanceof HTMLSelectElement) {
            [...clone.options].forEach((option, i) => option.toggleAttribute('selected', node.options[i].selected));
            clone.selectedIndex = node.selectedIndex;
        }
        // Reviewed widgets only have simple textual generated content (e.g. ': ').
        for (const pseudo of ['::before','::after']) {
            const content = document.defaultView.getComputedStyle(node, pseudo).content;
            if (!/^".*"$/.test(content) || content === '""') continue;
            const span = document.createElement('span');
            copyStyle(node, span, pseudo); span.textContent = content.slice(1, -1);
            if (pseudo === '::before') clone.prepend(span); else clone.append(span);
        }
        if (node.scrollTop) clone.dataset.dbSnapshotScrollTop = String(node.scrollTop);
        if (node.scrollLeft) clone.dataset.dbSnapshotScrollLeft = String(node.scrollLeft);
        return clone;
    }
    const clone = source.cloneNode(true);
    const originals = [...source.querySelectorAll(OWNED)].filter(node => !node.parentElement?.closest(OWNED));
    const copies = [...clone.querySelectorAll(OWNED)].filter(node => !node.parentElement?.closest(OWNED));
    originals.forEach((node, i) => copies[i].replaceWith(flatten(node)));
    // Do this after pairing owned nodes so removing a collapsed subtree cannot
    // shift the source/copy indices. Only the disposable capture copy is pruned.
    for (const details of clone.querySelectorAll('details:not([open])')) {
        details.replaceChildren(...visibleChildren(details));
    }
    return clone;
}

function localImage(image) {
    try {
        const url = new URL(image.currentSrc || image.getAttribute('src'), image.ownerDocument.baseURI);
        return url.origin === location.origin && /^\/(?:user\/images\/|user\/files\/|characters\/)/.test(url.pathname);
    } catch { return false; }
}

/** Run on the attached, anonymized capture container BEFORE grid measurements. */
export async function prepareSnapshot(container, {timeoutMs = 10000} = {}) {
    if (!(container instanceof Element) || !container.isConnected || container.closest('#chat') || container.querySelector('#chat')) {
        throw Error('Snapshot preparation requires a separate capture copy, outside #chat.');
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw Error('Invalid snapshot timeout.');
    for (const node of container.querySelectorAll('[data-db-snapshot-scroll-top],[data-db-snapshot-scroll-left]')) {
        node.scrollTop = Number(node.dataset.dbSnapshotScrollTop) || 0;
        node.scrollLeft = Number(node.dataset.dbSnapshotScrollLeft) || 0;
        delete node.dataset.dbSnapshotScrollTop;delete node.dataset.dbSnapshotScrollLeft;
    }
    const images = [...container.querySelectorAll('img')].filter(image => {
        if (!localImage(image)) return false;
        for (let node = image; node && node !== container; node = node.parentElement) {
            const style = getComputedStyle(node);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                image.removeAttribute('src');image.removeAttribute('srcset');return false;
            }
        }
        return true;
    });
    const deadline = Date.now() + timeoutMs, embedded = new Map();
    function ready(image) {
        return new Promise(resolve => {
            let timer;
            const done = () => {clearTimeout(timer);image.removeEventListener('load', done);image.removeEventListener('error', done);resolve(image.complete && image.naturalWidth > 0);};
            image.addEventListener('load', done);image.addEventListener('error', done);
            image.loading = 'eager';
            if (image.complete) done(); else timer = setTimeout(done, Math.max(0, deadline - Date.now()));
        });
    }
    const loaded = await Promise.all(images.map(ready));
    let failed = 0;
    for (let i = 0; i < images.length; i++) {
        const image = images[i];
        if (!loaded[i]) {failed++; continue;}
        const key = image.currentSrc || image.src;
        try {
            if (!embedded.has(key)) {
                const canvas = container.ownerDocument.createElement('canvas');
                canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
                canvas.getContext('2d').drawImage(image, 0, 0);
                const data = canvas.toDataURL('image/png');
                if (!data.startsWith('data:image/png;')) throw Error('Image is too large to capture.');
                embedded.set(key, data);
                canvas.width = canvas.height = 0;
            }
            image.removeAttribute('srcset');image.removeAttribute('sizes');image.src = embedded.get(key);
        } catch { failed++; }
    }
    // Do not silently produce white rectangles on slow/failed local asset loads.
    if (failed) throw Error(`Snapshot could not prepare ${failed} local image(s). Wait for images to load or fix missing assets, then retry.`);
    await Promise.all(images.map(image => image.decode()));
    return {images:images.length, uniqueImages:embedded.size};
}

export const snapshot = Object.freeze({apiVersion:1, cloneMessage:cloneSnapshotMessage, prepare:prepareSnapshot});
