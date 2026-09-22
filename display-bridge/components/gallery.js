import { GALLERY_CSS } from './gallery-style.js';
import { checkboxActions } from './controls.js';

function element(tag, className, text) {
    const node = document.createElement(tag); node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}
export function createGallery(data, { stateFor } = {}) {
    const host = element('span','display-bridge-widget'); host.dataset.adapter = 'gallery';
    const shadow = host.attachShadow({mode:'open'});
    const style = document.createElement('style'); style.textContent = GALLERY_CSS + `
    :host{all:initial;display:block;width:100%;margin:12px 0;contain:layout paint;container-type:inline-size;font:12px/1.5 'Malgun Gothic',system-ui;color:#333;color-scheme:light}
    *{box-sizing:border-box}[hidden]{display:none!important}.gallery-container{max-width:100%}.post-title-label{display:block;overflow-wrap:anywhere;cursor:pointer}.post-title-label:focus-visible{outline:2px solid #3b4890}.post-full-content,.comment-text{white-space:pre-wrap;overflow-wrap:anywhere}.post-content-wrapper{display:block}.post-list-container{overflow-x:auto}.post-list-header,.post-row{min-width:480px}.col-title{min-width:100px}.post-cell{overflow-wrap:anywhere}.comment-author-wrapper{overflow-wrap:anywhere}
    .post-row{align-items:flex-start}.post-row .col-title{flex:1 1 0;min-width:0}.post-row .col-title,.post-row .col-writer{white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere}.post-title-label{white-space:normal}
    @container(max-width:480px){.col-view,.col-date{display:none}.post-list-header,.post-row{min-width:0}.col-num{width:40px;flex-basis:40px}.col-writer{width:80px;flex-basis:80px}.col-recommend{width:36px;flex-basis:36px}.gallery-container{padding:10px}.comment-item{flex-wrap:wrap}}
    `;
    const panel = element('section','gallery-container');
    const header = element('div','gallery-header'); header.append(element('h1','',data.name)); panel.append(header);
    const list = element('div','post-list-container'), head = element('div','post-list-header');
    const columns = ['num','title','writer','date','view','recommend'];
    ['번호','제목','글쓴이','작성일','조회','추천'].forEach((text,i) => head.append(element('div',`header-item col-${columns[i]}`,text)));
    list.append(head);
    const pages = [];
    data.posts.forEach((post,index) => {
        const id = `post-${index}`, item = element('div','post-item');
        const input = document.createElement('input'); input.type='checkbox'; input.id=id; input.className='post-toggle';
        const row = element('div','post-row');
        const title = element('label','post-title-label',`${post.title}${post.comments.length ? ` [${post.comments.length}]` : ''}`); title.htmlFor=id;
        [post.number??'-',title,post.author??'-',post.date??'-',post.views??'-',post.recommend??'-'].forEach((value,i) => {
            const cell = element('div',`post-cell col-${columns[i]}`); cell.append(value); row.append(cell);
        });
        const content = element('div','post-content-wrapper'); content.id=`content-${index}`; title.setAttribute('aria-controls',content.id);
        content.append(element('div','post-full-content',post.content));
        if (post.comments.length) {
            const comments = element('section','comments-section'); comments.append(element('h4','',`댓글 ${post.comments.length}`));
            const ul = element('ul','comment-list');
            for (const comment of post.comments) {
                const li = element('li','comment-item'), author = element('div','comment-author-wrapper');
                author.append(element('span','comment-author',comment.author));
                if (comment.type) author.append(element('span',comment.type === 'F' ? 'icon-fixed':'icon-half',comment.type === 'F'?'고':'반'));
                li.append(author,element('div','comment-content-wrapper',comment.text)); ul.append(li);
            }
            comments.append(ul); content.append(comments);
        }
        pages.push({id,content}); item.append(input,row,content); list.append(item);
    });
    if (!data.posts.length) list.append(element('p','','표시할 게시글 없음'));
    panel.append(list); shadow.append(style,panel);
    const controls = data.posts.length ? checkboxActions(shadow,{namespace:'streamer-gallery',stateFor,onSync(values){pages.forEach(({id,content}) => {content.hidden=!values[id];content.inert=!values[id];});}}) : null;
    shadow.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || !controls) return;
        const open = pages.find(({id}) => controls.state.read()[id]);
        if (open) { controls.state.dispatch(open.id); controls.sync(); shadow.querySelector(`label[for="${open.id}"]`).focus(); }
    });
    return { host, refresh: () => controls?.sync(), missingImages: () => 0 };
}
