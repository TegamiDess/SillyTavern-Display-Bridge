const IMAGE = /\.(?:png|jpe?g|gif|webp|apng|avif|bmp|jfif)$/i;

export function acceptedImageURL(value) {
    if (typeof value !== 'string' || !/^\/(?:user\/images\/|user\/files\/|characters\/)/.test(value)) return null;
    if (/[\\?#\u0000-\u0020\u007f]/.test(value) || !IMAGE.test(value)) return null;
    try {
        const segments = value.slice(1).split('/').map(decodeURIComponent);
        if (segments.some(x => !x || x === '.' || x === '..' || /[\\/\u0000-\u001f\u007f]/.test(x))) return null;
        return value;
    } catch { return null; }
}

export function resolveImage(avatar, reference, provider = globalThis.v3sprites?.api) {
    if (!provider) return { status: 'provider-unavailable' };
    if (provider.apiVersion !== 1 || typeof provider.resolveImage !== 'function') return { status: 'incompatible-provider' };
    try {
        const result = provider.resolveImage({ avatar, reference });
        if (result?.status !== 'resolved') return { status: result?.status === 'not-enrolled' ? 'not-enrolled' : 'missing' };
        const url = acceptedImageURL(result.url);
        return url ? { status: 'resolved', url } : { status: 'invalid-url' };
    } catch { return { status: 'provider-error' }; }
}

export function resolveAudio(avatar,reference,provider=globalThis.v3sprites?.api){
    if(!provider)return {status:'provider-unavailable'};
    if(provider.audioApiVersion!==1||typeof provider.resolveAudio!=='function')return {status:'incompatible-provider'};
    try{const r=provider.resolveAudio({avatar,reference});if(r?.status!=='resolved')return {status:r?.status==='not-enrolled'?'not-enrolled':'missing'};
        if(typeof r.url!=='string'||!/^\/user\/(?:files|images)\/[^?#\\]+\.(mp3|wav|ogg)$/i.test(r.url)||/[\u0000-\u0020\u007f]/.test(r.url))return {status:'invalid-url'};
        if(r.url.slice(1).split('/').map(decodeURIComponent).some(x=>!x||x==='.'||x==='..'||/[\\/\u0000-\u001f\u007f]/.test(x)))return {status:'invalid-url'};
        return {status:'resolved',url:r.url};
    }catch{return {status:'provider-error'};}
}
