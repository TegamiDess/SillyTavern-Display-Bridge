import { resolveImage } from '../integrations/assets.js';
import { validateImageMappings } from '../adapters/portrait-mappings.js';

// A small reusable row editor. Asset names are suggestions, not inferred rules.
export function createImageMappingEditor({avatar,initial={},suggestions=[],title='Image mappings',resolver=resolveImage,referenceLabels,knownReferences=[]}) {
    const host=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=title;host.append(legend);
    const list=document.createElement('datalist');list.id='db-assets-'+crypto.randomUUID();
    for(const name of [...new Set(suggestions)].slice(0,2000)){const o=document.createElement('option');o.value=name;list.append(o);}host.append(list);
    const rows=document.createElement('div');host.append(rows);
    const button=(label,fn)=>{const b=document.createElement('button');b.type='button';b.className='menu_button';b.textContent=label;b.addEventListener('click',fn);return b;};
    function add(from='',to='',fixed=false) {
        const row=document.createElement('div');row.className='db-mapping-row';
        const input=(label,value)=>{const wrap=document.createElement('label');wrap.textContent=label;const n=document.createElement('input');n.className='text_pole';n.value=value;n.maxLength=256;n.setAttribute('aria-label',label);n.setAttribute('list',list.id);wrap.append(n);row.append(wrap);return n;};
        const base=input('Source image name',from),target=input('Use image',to),status=document.createElement('p');status.className='db-mapping-status';status.setAttribute('aria-live','polite');
        if(fixed){
            const identity=document.createElement('strong');identity.className='db-portrait-identity';identity.textContent=referenceLabels?.[from]??from;row.prepend(identity);
            const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Original image reference';details.append(summary,base.parentElement);row.insertBefore(details,target.parentElement);base.readOnly=true;
            target.placeholder='Use usual image';
        }
        const preview=document.createElement('img');preview.alt='Mapped image preview';preview.hidden=true;preview.className='db-mapping-image';
        preview.addEventListener('error',()=>{preview.hidden=true;status.textContent='Image URL resolved, but the file could not load.';});
        const clear=()=>{status.textContent='Not checked';preview.hidden=true;preview.removeAttribute('src');};base.addEventListener('input',clear);target.addEventListener('input',clear);
        row.append(button('Check image',()=>{if(fixed&&!target.value){clear();status.textContent='Uses the usual image mapping.';return;}const r=resolver(avatar,target.value);status.textContent=r.status==='resolved'?'Local image found':`Unresolved: ${r.status}`;preview.hidden=r.status!=='resolved';if(r.status==='resolved')preview.src=r.url;else preview.removeAttribute('src');}),button(fixed?'Use usual image':'Remove mapping',()=>{if(fixed){target.value='';clear();}else row.remove();}),status,preview);
        row.mapping={base,target,status,fixed};rows.append(row);
    }
    for(const from of [...new Set(knownReferences)].slice(0,200))add(from,initial[from]??'',true);
    for(const [from,to] of Object.entries(initial))if(!knownReferences.includes(from))add(from,to);
    host.append(button('Add image mapping',()=>{if(rows.childElementCount>=200)return;add();}));
    function read() {
        const result=Object.create(null);
        for(const row of rows.children){const {base,target,fixed}=row.mapping;if((fixed&&!target.value)||(!base.value&&!target.value))continue;if(!base.value.trim()||!target.value.trim())throw Error('Each mapping needs both an original image reference and a replacement image.');if(Object.hasOwn(result,base.value))throw Error('Duplicate source image name: '+base.value);result[base.value]=target.value;}
        validateImageMappings(result);return {...result};
    }
    function unresolved() {
        read();const missing=[];
        for(const row of rows.children){const {base,target,status,fixed}=row.mapping;if((fixed&&!target.value)||(!base.value&&!target.value))continue;const r=resolver(avatar,target.value);status.textContent=r.status==='resolved'?'Local image found':`Unresolved: ${r.status}`;if(r.status!=='resolved')missing.push(target.value);}
        return missing;
    }
    function refreshLabels(){for(const row of rows.children){const name=row.querySelector('.db-portrait-identity');if(name)name.textContent=referenceLabels?.[row.mapping.base.value]??row.mapping.base.value;}}
    return {host,read,unresolved,refreshLabels};
}
