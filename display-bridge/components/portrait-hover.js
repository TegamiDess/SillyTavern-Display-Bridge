// Keep the base image as the stable hit surface, including while its alternate
// is visible. Sample a bounded alpha mask once per source, never per movement.
export function bindPortraitHover(button, image) {
    let cachedSource = null, mask = null, point = null;
    function readMask() {
        const source = image.currentSrc || image.src;
        if (cachedSource === source) return mask;
        if (!image.complete || !image.naturalWidth || !image.naturalHeight) return null;
        cachedSource = source;
        mask = null;
        try {
            const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
            const context = canvas.getContext('2d', { willReadFrequently: true });
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
            const pixels = new Uint8Array(canvas.width * canvas.height);
            for (let i = 0; i < pixels.length; i++) pixels[i] = rgba[i * 4 + 3];
            mask = { width: canvas.width, height: canvas.height, pixels };
        } catch { /* Unreadable images retain keyboard preview, not a broad hover target. */ }
        return mask;
    }
    function update() {
        const bounds = image.getBoundingClientRect();
        let hit = false;
        if (point && !image.hidden && bounds.width && bounds.height) {
            const x = (point.x - bounds.left) / bounds.width, y = (point.y - bounds.top) / bounds.height;
            if (x >= 0 && x < 1 && y >= 0 && y < 1) {
                const alpha = readMask();
                if (alpha) hit = alpha.pixels[Math.floor(y * alpha.height) * alpha.width + Math.floor(x * alpha.width)] >= 24;
            }
        }
        button.classList.toggle('portrait-hover', hit);
    }
    function move(event) {
        point = event.pointerType === 'touch' ? null : { x: event.clientX, y: event.clientY };
        update();
    }
    function clear() { point = null; button.classList.remove('portrait-hover'); }
    image.addEventListener('pointerenter', move);
    image.addEventListener('pointermove', move);
    image.addEventListener('pointerleave', clear);
    image.addEventListener('pointercancel', clear);
    image.addEventListener('load', () => { cachedSource = null; mask = null; update(); });
    image.addEventListener('error', clear);
    return { clear };
}
