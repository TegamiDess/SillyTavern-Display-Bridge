import { resolveImage } from './assets.js';

// Exact mismatches verified against the user's original Witchcure export.
// Kept in this adapter; no global fuzzy matching or provider-map mutation.
const aliases = new Map([
    ['마녀 선택 안함','선택 안함'], ['조수 선택 안함','선택 안함'],
    ['탐험 상태 아님 아이콘','탐험 상태 아님'],
    ['별빛 평원 아이콘','별빛 평야 아이콘'],
    ['부유 섬 아이콘','부유섬 군락 아이콘'],
    ['부유 섬 군락 아이콘','부유섬 군락 아이콘'],
    ['부유 섬 묘사','부유 섬 군락 묘사'],
    ['비비안 루나비오','비비안 루나비오.'],
]);
export function resolveWitchcureImage(avatar, reference, resolver = resolveImage) {
    const direct = resolver(avatar,reference);
    return direct.status === 'resolved' || !aliases.has(reference) ? direct : resolver(avatar,aliases.get(reference));
}
