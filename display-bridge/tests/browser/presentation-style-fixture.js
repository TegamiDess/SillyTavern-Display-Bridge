// Neutral technical fixture for the common Afternoon source pattern.
export const styledRule=(tag,speaker,portrait)=>({type:'editdisplay',in:`<${tag}>"(.*?)"</${tag}>`,out:`<div class="${tag}-dialogue-container"><div class="${tag}-character-area"><img class="${tag}-character-image" src="{{raw::${portrait}}}"></div><div class="${tag}-dialogue-box-area"><div class="${tag}-character-fullname">${speaker}</div><div class="${tag}-dialogue-box"><div class="${tag}-dialogue-text">$1</div></div></div></div>`});
export const afternoonStyles=`<style>
.guide-dialogue-container {--primary-color:#4169e1;--bg-color:#f0f8ff;--text-color:#003366;--secondary-color:#e0f6ff}
.curator-dialogue-container {--primary-color:#daa520;--bg-color:#fffef7;--text-color:#8b4513;--secondary-color:#fffaf0}
.guide-dialogue-container,.curator-dialogue-container {width:80%;height:58vh}
.guide-character-image,.curator-character-image {max-height:50vh;max-width:50vw}
.guide-character-fullname,.curator-character-fullname {background:var(--secondary-color);color:var(--text-color);font-size:13px;transform:rotate(-2deg)}
.guide-dialogue-box,.curator-dialogue-box {background:var(--bg-color);border:4px solid var(--primary-color);border-radius:25px;padding:20px 35px}
.guide-dialogue-text,.curator-dialogue-text {font-size:16px;line-height:1.6;color:var(--text-color);font-weight:700}
.guide-dialogue-box::before,.curator-dialogue-box::before {background-image:repeating-linear-gradient(45deg,transparent,transparent 10px,#ffffff22 10px,#ffffff22 20px),repeating-linear-gradient(-45deg,transparent,transparent 10px,#ffffff22 10px,#ffffff22 20px)}
.narration-container{width:75%}
.narration-box {background:linear-gradient(135deg, #faf8f4 0%, #f0ebe0 100%);border:3px solid #b8956f;border-radius:15px;padding:18px 25px}
.narration-text{font-size:15px;line-height:1.6;color:#3d3424;font-weight:500}
@media(max-width:480px){.guide-dialogue-container{width:95%;height:48vh}}
</style>`;
