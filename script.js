/* ── state ── */
let D = { groups: [] };
let pwd = null;
let isUnlocked = false;
let authCallback = null;
let swapMode = false, swapSrc = null;
let selMode = false, selected = new Set();
let confirmCb = null;
let addLinkThenSec = false;
let secEmoji = '📁', secColor = '#c9a84c';
let selectedGroupId = null;
let currentSecId = null;
let editingLinkId = null;
let openGroupId = null;
let ignoreNextPop = false; 
let isFirstRender = true; 

const EMOJIS = ['📁','🤖','🎨','🎬','🎵','📸','💻','🌐','🔗','📝','🎮','📊','🛒','💡','🔧','⭐','🚀','📱','🎯','💎'];
const COLORS = ['#c9a84c','#f87171','#60a5fa','#34d399','#a78bfa','#f472b6','#fb923c','#2dd4bf','#facc15','#94a3b8'];

/* ── crypto ── */
async function hashString(str) {
  const buffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ── auth wrapper ── */
function checkAuth(callback) {
  if (!pwd || isUnlocked) {
    callback();
    return;
  }
  authCallback = callback;
  document.getElementById('auth-input').value = '';
  openModal('auth-modal');
  setTimeout(() => document.getElementById('auth-input').focus(), 50);
}

async function submitAuth() {
  const v = document.getElementById('auth-input').value;
  const hash = await hashString(v);
  if (hash === pwd) {
    isUnlocked = true;
    closeModal('auth-modal');
    if (authCallback) {
      authCallback();
      authCallback = null;
    }
  } else {
    toast('الكلمة غير صحيحة ❌', 'error-bare');
    document.getElementById('auth-input').value = '';
  }
}

function cancelAuth() {
  closeModal('auth-modal');
  authCallback = null;
}

function reqEditLink() {
  // استخدام التايمر لمنع تصادم النوافذ وحل مشكلة عدم الاستجابة
  closeModal('link-ctx-modal');
  setTimeout(() => checkAuth(ctxEditLink), 50);
}

function reqDeleteLink() {
  closeModal('link-ctx-modal');
  setTimeout(() => checkAuth(ctxDeleteLink), 50);
}

/* ── init ── */
window.onload = () => {
  pwd = localStorage.getItem('vlt_pw') || null;
  updatePwdUI();
  loadAndRender();
};

function loadAndRender() {
  const s = localStorage.getItem('vlt_data');
  if (s) {
    try { D = JSON.parse(s); } catch(e){}
  } else {
    D.groups.push({id:uid(), name:'أدوات الذكاء الاصطناعي', emoji:'🤖', color:'#c9a84c', links:[
      {id:uid(), name:'Claude', url:'https://claude.ai'},
      {id:uid(), name:'ChatGPT', url:'https://chat.openai.com'},
    ]});
    save();
  }
  render();
  isFirstRender = false; 
}

function save() { localStorage.setItem('vlt_data', JSON.stringify(D)); }
function uid()  { return Math.random().toString(36).slice(2,11); }

function getFav(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  } catch {
    return '';
  }
}

function getDomain(url) {
  try { return new URL(url).hostname.replace('www.',''); } catch { return url; }
}

/* ── render ── */
function render() {
  const c = document.getElementById('groups-container');
  c.innerHTML = '';
  D.groups.forEach((g,gi) => {
    const div = document.createElement('div');
    div.className = 'group-wrap';
    
    if (isFirstRender) {
      div.style.animationDelay = gi * 0.07 + 's';
    } else {
      div.style.animation = 'none'; 
    }
    
    div.dataset.gid = g.id;

    const isGroupSrc = (swapSrc && swapSrc.type === 'group' && swapSrc.gid === g.id) ? 'swap-src' : '';
    const groupSwapBtn = swapMode ? `<button class="group-edit-btn" style="margin-left:6px; color:var(--gold2); background:rgba(201,168,76,0.15);" onclick="event.stopPropagation(); handleGroupSwap('${g.id}')">⇄</button>` : '';

    div.innerHTML = `
      <div class="group-head ${isGroupSrc}" onclick="openGroupView('${g.id}')">
        <div class="group-emoji" style="background:${g.color}18;border-color:${g.color}30;">${g.emoji}</div>
        <div class="group-name">${g.name}</div>
        <div class="group-count">${g.links.length}</div>
        ${groupSwapBtn}
        <button class="group-edit-btn" onclick="event.stopPropagation(); checkAuth(() => openSecCtx('${g.id}'))">⋯</button>
      </div>`;
    c.appendChild(div);
  });

  if (openGroupId) {
    renderGroupViewLinks(openGroupId);
  }
}

function openGroupView(gid) {
  if (swapMode && swapSrc && swapSrc.type === 'group') {
     toast('⚠ عم ترتب مجموعات، اختار زر التبديل', 'error-bare');
     return;
  }
  openGroupId = gid;
  const g = D.groups.find(x => x.id === gid);
  if(!g) return;
  document.getElementById('gv-title').innerHTML = `<span style="margin-left:8px; font-size:24px;">${g.emoji}</span> ${g.name}`;
  renderGroupViewLinks(gid);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      openModal('group-view-modal');
    });
  });
}

function renderGroupViewLinks(gid) {
  const g = D.groups.find(x => x.id === gid);
  if(!g) return;
  const container = document.getElementById('gv-links');
  
  if (g.links.length === 0) {
     container.innerHTML = `<div class="empty-group"><div class="e-icon">🔗</div>لا يوجد روابط هنا</div>`;
     return;
  }

  container.innerHTML = g.links.map(l => {
      const isSel = selected.has(l.id) ? 'selected' : '';
      const isSrc = (swapSrc && swapSrc.type === 'link' && swapSrc.lid === l.id) ? 'swap-src' : '';
      const fav   = getFav(l.url);
      const init  = (l.name||'?')[0].toUpperCase();
      return `
        <div class="link-card ${isSel} ${isSrc}"
             data-gid="${g.id}" data-lid="${l.id}" data-url="${l.url}"
             onmousedown="handleTouchStart(event, this)"
             onmouseup="handleTouchEnd()"
             onmouseleave="handleTouchEnd()"
             ontouchstart="handleTouchStart(event, this)"
             ontouchend="handleTouchEnd()"
             ontouchmove="handleTouchMove()"
             oncontextmenu="handleContextMenu(event, this)"
             onclick="cardClick(event,this)">
          <div class="link-icon-wrap">
            <img src="${fav}" alt="${init}" loading="lazy"
                 onerror="if(!this.dataset.fb){this.dataset.fb='1'; this.src='https://icons.duckduckgo.com/ip3/'+new URL('${l.url}').hostname+'.ico';}else{this.parentNode.innerHTML='<span style=font-size:22px;font-weight:900;color:#333>${init}</span>'}">
          </div>
          <div class="sel-badge">✓</div>
          <div class="link-label">${l.name || getDomain(l.url)}</div>
        </div>`;
    }).join('');
}

function handleGroupSwap(gid) {
  if (!swapSrc) {
    swapSrc = { type: 'group', gid: gid };
    render();
    toast('انقر على المكان الجديد للتبديل', 'info');
  } else {
    if (swapSrc.type === 'link') {
      toast('⚠ عم ترتب روابط، اختر رابط تاني', 'error-bare');
      return;
    }
    if (swapSrc.type === 'group' && swapSrc.gid !== gid) {
      const idx1 = D.groups.findIndex(gx => gx.id === swapSrc.gid);
      const idx2 = D.groups.findIndex(gx => gx.id === gid);
      if(idx1 > -1 && idx2 > -1) {
        // استخدام خوارزمية الإزاحة بدل التبديل المباشر
        const srcGroup = D.groups.splice(idx1, 1)[0];
        D.groups.splice(idx2, 0, srcGroup);
        save();
        toast('تم الترتيب ✅', 'success');
      }
    }
    swapSrc = null; 
    render();
  }
}

/* ── long press ── */
let pressTimer;
let isDragging = false;

function handleTouchStart(e, el) {
  isDragging = false;
  pressTimer = setTimeout(() => {
    if (!isDragging) {
      try { window.getSelection().removeAllRanges(); } catch(err) {}
      showLinkMenu(el);
    }
  }, 500);
}
function handleTouchMove() {
  isDragging = true;
  clearTimeout(pressTimer);
}
function handleTouchEnd() {
  clearTimeout(pressTimer);
}
function handleContextMenu(e, el) {
  e.preventDefault();
  try { window.getSelection().removeAllRanges(); } catch(err) {}
  showLinkMenu(el);
}

function showLinkMenu(el) {
  const lid = el.dataset.lid;
  const gid = el.dataset.gid;
  const url = el.dataset.url;
  const g = D.groups.find(x => x.id === gid);
  const l = g.links.find(x => x.id === lid);

  document.getElementById('link-ctx-name').textContent = l.name;
  document.getElementById('link-ctx-modal').dataset.lid = lid;
  document.getElementById('link-ctx-modal').dataset.gid = gid;
  document.getElementById('link-ctx-modal').dataset.url = url;

  openModal('link-ctx-modal');
}

function ctxOpenLink() {
  const url = document.getElementById('link-ctx-modal').dataset.url;
  window.open(url, '_blank');
  closeModal('link-ctx-modal');
}

function ctxCopyLink() {
  const url = document.getElementById('link-ctx-modal').dataset.url;
  navigator.clipboard.writeText(url);
  toast('تم النسخ ✅', 'success');
  closeModal('link-ctx-modal');
}

function ctxEditLink() {
  const lid = document.getElementById('link-ctx-modal').dataset.lid;
  const gid = document.getElementById('link-ctx-modal').dataset.gid;
  const g = D.groups.find(x => x.id === gid);
  const l = g.links.find(x => x.id === lid);

  editingLinkId = lid;
  selectedGroupId = gid;

  document.getElementById('inp-url').value = l.url;
  document.getElementById('inp-name').value = l.name;
  previewURL(l.url);
  renderGroupChips();

  document.getElementById('link-modal-title').textContent = '✏️ تعديل رابط';
  openModal('link-modal');
}

function ctxDeleteLink() {
  const lid = document.getElementById('link-ctx-modal').dataset.lid;
  const gid = document.getElementById('link-ctx-modal').dataset.gid;

  confirm2('🗑', 'حذف الرابط', 'هل تريد فعلاً حذف هذا الرابط؟', 'danger', () => {
    const g = D.groups.find(x => x.id === gid);
    g.links = g.links.filter(x => x.id !== lid);
    save(); render(); toast('تم الحذف ✅', 'success');
  });
}

/* ── card click ── */
function cardClick(e, el) {
  e.stopPropagation();
  if (isDragging) return;

  const gid = el.dataset.gid, lid = el.dataset.lid, url = el.dataset.url;
  if (selMode) {
    const isAdding = !selected.has(lid);
    if (isAdding) {
       selected.add(lid);
       document.querySelectorAll(`.link-card[data-lid="${lid}"]`).forEach(c => c.classList.add('selected'));
    } else {
       selected.delete(lid);
       document.querySelectorAll(`.link-card[data-lid="${lid}"]`).forEach(c => c.classList.remove('selected'));
    }
    updateSelCount();
    return;
  }
  if (swapMode) {
    if (!swapSrc) { 
      swapSrc = {type: 'link', gid, lid}; 
      render(); 
      toast('انقر على المكان الجديد للتبديل', 'info'); 
    } else {
      if (swapSrc.type === 'group') {
        toast('⚠ عم ترتب مجموعات، اختار زر التبديل', 'error-bare');
        return;
      }
      if (swapSrc.type === 'link' && swapSrc.lid !== lid) {
        const g1 = D.groups.find(gx=>gx.id===swapSrc.gid);
        const g2 = D.groups.find(gx=>gx.id===gid);
        const i1 = g1.links.findIndex(lx=>lx.id===swapSrc.lid);
        const i2 = g2.links.findIndex(lx=>lx.id===lid);
        if(i1 > -1 && i2 > -1){ 
          // خوارزمية الإزاحة للروابط كمان
          const srcLink = g1.links.splice(i1, 1)[0];
          g2.links.splice(i2, 0, srcLink);
          save(); 
          toast('تم الترتيب ✅', 'success');
        }
      }
      swapSrc = null; 
      render();
    }
    return;
  }
  window.open(url,'_blank');
}

/* ── modes ── */
function toggleSwapMode() {
  swapMode = !swapMode; swapSrc=null;
  if(selMode){
      selMode=false;
      selected.clear();
      document.querySelectorAll('.link-card').forEach(c => c.classList.remove('selected'));
      document.getElementById('btn-select').classList.remove('active-select');
      document.getElementById('action-bar').classList.remove('show');
      document.getElementById('select-banner').classList.remove('show');
  }
  document.getElementById('btn-swap').classList.toggle('active-swap',swapMode);
  document.getElementById('swap-banner').classList.toggle('show',swapMode);
  document.getElementById('fab-row').classList.toggle('hidden',swapMode);
  if(swapMode){ toast('وضع الترتيب مفعل'); }
  render();
}
function toggleSelectMode() {
  selMode = !selMode;
  if(!selMode) {
      selected.clear();
      document.querySelectorAll('.link-card').forEach(c => c.classList.remove('selected'));
  } else {
      selected.clear();
  }
  if(swapMode){ swapMode=false; swapSrc=null; document.getElementById('btn-swap').classList.remove('active-swap'); document.getElementById('swap-banner').classList.remove('show'); }
  document.getElementById('btn-select').classList.toggle('active-select',selMode);
  document.getElementById('select-banner').classList.toggle('show',selMode);
  document.getElementById('action-bar').classList.toggle('show',selMode);
  document.getElementById('fab-row').classList.toggle('hidden',selMode);
  updateSelCount();
}
function cancelSelect() { 
  if(selMode) toggleSelectMode(); 
}
function selectAll() {
  D.groups.forEach(g=>{ g.links.forEach(l=>selected.add(l.id)); });
  updateSelCount();
  document.querySelectorAll('.link-card').forEach(c => c.classList.add('selected'));
}
function updateSelCount() { document.getElementById('sel-count').textContent=selected.size+' محدد'; }

/* ── link actions ── */
function deleteSelected() {
  if(!selected.size){ toast('⚠ لم تحدد شيئاً'); return; }
  confirm2('🗑','حذف الروابط المحددة',`هل تريد حذف ${selected.size} رابط؟`,'danger',()=>{
    D.groups.forEach(g=>{ g.links=g.links.filter(l=>!selected.has(l.id)); });
    selected.clear();
    save(); cancelSelect(); render(); toast('تم الحذف ✅', 'success');
  });
}
function openMoveModal() {
  if(!selected.size){ toast('⚠ حدد روابط أولاً'); return; }
  const ml=document.getElementById('move-list'); ml.innerHTML='';
  D.groups.forEach(g=>{
    const d=document.createElement('div'); d.className='mgroup-item';
    d.innerHTML=`<span class="mg-e">${g.emoji}</span>${g.name}<span class="mg-count">${g.links.length}</span>`;
    d.onclick=()=>{ moveToGroup(g.id); closeModal('move-modal'); };
    ml.appendChild(d);
  });
  openModal('move-modal');
}
function moveToGroup(tid) {
  const tg=D.groups.find(g=>g.id===tid); let moved=[];
  D.groups.forEach(g=>{ moved.push(...g.links.filter(l=>selected.has(l.id))); g.links=g.links.filter(l=>!selected.has(l.id)); });
  tg.links.push(...moved);
  selected.clear();
  save(); cancelSelect(); render(); toast('تم النقل ✅', 'success');
}

/* ── add / edit link ── */
function openAddLink() {
  editingLinkId=null;
  document.getElementById('inp-url').value='';
  document.getElementById('inp-name').value='';
  document.getElementById('url-prev').style.display='none';
  selectedGroupId = D.groups[0]?.id || null;
  renderGroupChips();
  document.getElementById('link-modal-title').textContent='➕ إضافة رابط';
  openModal('link-modal');
}
function renderGroupChips() {
  const c=document.getElementById('group-chips-list'); c.innerHTML='';
  D.groups.forEach(g=>{
    const d=document.createElement('div');
    d.className='gchip'+(g.id===selectedGroupId?' sel':'');
    d.innerHTML=`<span class="ge">${g.emoji}</span><span class="gchip-name">${g.name}</span>`;
    d.onclick=()=>{
      selectedGroupId=g.id;
      document.querySelectorAll('.gchip').forEach(x=>x.classList.remove('sel'));
      d.classList.add('sel');
    };
    c.appendChild(d);
  });
}
function previewURL(val) {
  const prev=document.getElementById('url-prev');
  if(!val){ prev.style.display='none'; return; }
  try {
    const url=new URL(val.startsWith('http')?val:'https://'+val);
    const dom=url.hostname.replace('www.','');
    document.getElementById('uprev-img').src=getFav(val);
    document.getElementById('uprev-domain').textContent=dom;
    document.getElementById('uprev-full').textContent=url.href;
    prev.style.display='flex';
    if(!document.getElementById('inp-name').value) document.getElementById('inp-name').value=dom.split('.')[0];
  } catch { prev.style.display='none'; }
}
function saveLink() {
  let url=document.getElementById('inp-url').value.trim();
  const name=document.getElementById('inp-name').value.trim();
  if(!url){ toast('⚠ أدخل رابطاً'); return; }
  if(!url.startsWith('http')) url='https://'+url;
  if(!selectedGroupId){ toast('⚠ اختر قسماً'); return; }
  
  if (editingLinkId) {
    let oldG = null;
    let linkObj = null;
    D.groups.forEach(gx => {
      const lx = gx.links.find(x => x.id === editingLinkId);
      if (lx) { oldG = gx; linkObj = lx; }
    });
    if (oldG && oldG.id !== selectedGroupId) {
      oldG.links = oldG.links.filter(x => x.id !== editingLinkId);
      const newG = D.groups.find(x => x.id === selectedGroupId);
      linkObj.name = name || getDomain(url);
      linkObj.url = url;
      newG.links.push(linkObj);
    } else if (linkObj) {
      linkObj.name = name || getDomain(url);
      linkObj.url = url;
    }
  } else {
    const g=D.groups.find(x=>x.id===selectedGroupId);
    g.links.push({id:uid(), name:name||getDomain(url), url});
  }
  
  save(); closeModal('link-modal'); render(); toast('تم الحفظ ✅', 'success');
}

/* ── add / edit section ── */
function openAddSection(fromLink=false) {
  addLinkThenSec=fromLink;
  secEmoji='📁'; secColor='#c9a84c';
  document.getElementById('inp-sec-name').value='';
  document.getElementById('sec-modal-title').textContent='📁 قسم جديد';
  document.getElementById('sec-save-btn').textContent='إنشاء القسم';
  document.getElementById('sec-save-btn').onclick=saveSection;
  renderEmojiPicker(); renderColorPicker();
  if(fromLink) closeModal('link-modal');
  openModal('section-modal');
}
function editSection(gid) {
  closeModal('sec-ctx-modal');
  setTimeout(() => {
      const g=D.groups.find(x=>x.id===gid); if(!g) return;
      secEmoji=g.emoji; secColor=g.color;
      document.getElementById('inp-sec-name').value=g.name;
      document.getElementById('sec-modal-title').textContent='✏️ تعديل القسم';
      document.getElementById('sec-save-btn').textContent='حفظ التعديلات';
      document.getElementById('sec-save-btn').onclick=()=>updateSection(gid);
      renderEmojiPicker(); renderColorPicker();
      openModal('section-modal');
  }, 50);
}
function updateSection(gid) {
  const g=D.groups.find(x=>x.id===gid);
  const n=document.getElementById('inp-sec-name').value.trim();
  if(!n){ toast('⚠ أدخل الاسم'); return; }
  g.name=n; g.emoji=secEmoji; g.color=secColor;
  save(); closeModal('section-modal'); render(); toast('تم التحديث ✅', 'success');
}
function renderEmojiPicker() {
  const ep=document.getElementById('emoji-picker'); ep.innerHTML='';
  EMOJIS.forEach(e=>{
    const b=document.createElement('button'); b.className='epick'+(e===secEmoji?' sel':'');
    b.textContent=e; b.onclick=()=>{secEmoji=e;document.querySelectorAll('.epick').forEach(x=>x.classList.remove('sel'));b.classList.add('sel');};
    ep.appendChild(b);
  });
}
function renderColorPicker() {
  const cp=document.getElementById('color-picker'); cp.innerHTML='';
  COLORS.forEach(c=>{
    const d=document.createElement('div'); d.className='cpick'+(c===secColor?' sel':'');
    d.style.background=c;
    d.onclick=()=>{secColor=c;document.querySelectorAll('.cpick').forEach(x=>x.classList.remove('sel'));d.classList.add('sel');};
    cp.appendChild(d);
  });
}
function saveSection() {
  const n=document.getElementById('inp-sec-name').value.trim();
  if(!n){ toast('⚠ أدخل اسم القسم'); return; }
  const g={id:uid(), name:n, emoji:secEmoji, color:secColor, links:[]};
  D.groups.push(g);
  save(); closeModal('section-modal'); render(); toast('تم إنشاء القسم ✅', 'success');
  if(addLinkThenSec){ selectedGroupId=g.id; renderGroupChips(); openModal('link-modal'); }
}

/* section ctx */
function openSecCtx(gid) {
  currentSecId=gid;
  const g=D.groups.find(x=>x.id===gid);
  document.getElementById('sec-ctx-name').textContent=`${g.emoji} ${g.name}`;
  openModal('sec-ctx-modal');
}
function askDeleteSection(gid) {
  closeModal('sec-ctx-modal');
  setTimeout(() => {
      const g=D.groups.find(x=>x.id===gid);
      confirm2('🗑','حذف القسم',`هل تريد حذف "${g.name}"؟\nالروابط لن تُحذف.`,'danger',()=>{
        D.groups=D.groups.filter(x=>x.id!==gid);
        if(openGroupId === gid) closeModal('group-view-modal');
        save(); render(); toast('تم الحذف ✅', 'success');
      });
  }, 50);
}

/* ── password ── */
function updatePwdUI() {
  document.getElementById('dd-pass-label').textContent = pwd ? 'تغيير / إزالة كلمة المرور' : 'تعيين كلمة مرور';
}
function openPassModal() {
  closeDD();
  document.getElementById('inp-old-pass').value='';
  document.getElementById('inp-new-pass').value='';
  document.getElementById('inp-conf-pass').value='';
  document.getElementById('pass-old-wrap').style.display = pwd ? 'block' : 'none';
  document.getElementById('pass-rm-wrap').style.display  = pwd ? 'block' : 'none';
  document.getElementById('pass-modal-title').textContent = pwd ? '🔒 تغيير كلمة المرور' : '🔑 تعيين كلمة مرور';
  openModal('pass-modal');
}
async function savePassword() {
  const oldV=document.getElementById('inp-old-pass').value;
  const newV=document.getElementById('inp-new-pass').value;
  const cfV=document.getElementById('inp-conf-pass').value;
  
  if(pwd){
    const oldHash = await hashString(oldV);
    if(oldHash !== pwd){ toast('⚠ كلمة المرور الحالية خاطئة'); return; }
  }
  
  if(newV.length<4){ toast('⚠ كلمة المرور قصيرة جداً'); return; }
  if(newV!==cfV){ toast('⚠ كلمتا المرور غير متطابقتتان'); return; }
  
  pwd = await hashString(newV);
  localStorage.setItem('vlt_pw',pwd);
  isUnlocked = true;
  closeModal('pass-modal'); updatePwdUI(); toast('تم التعيين ✅', 'success');
}
async function removePassword() {
  const oldV=document.getElementById('inp-old-pass').value;
  const oldHash = await hashString(oldV);
  if(oldHash !== pwd){ toast('⚠ كلمة المرور الحالية خاطئة'); return; }
  pwd=null; localStorage.removeItem('vlt_pw');
  isUnlocked = false;
  closeModal('pass-modal'); updatePwdUI(); toast('تم الإزالة ✅', 'success');
}

/* ── import / export ── */
function exportData() {
  closeDD();
  const blob=new Blob([JSON.stringify(D,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='vault_backup.json'; a.click(); toast('تم التصدير ✅', 'success');
}
function importData(e) {
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=ev=>{
    try {
      const d=JSON.parse(ev.target.result);
      if(d.groups){ D=d; save(); render(); toast('تم الاستيراد ✅', 'success'); }
      else toast('⚠ ملف غير صالح');
    } catch { toast('⚠ خطأ في القراءة'); }
  };
  r.readAsText(f); e.target.value='';
}
function askClearData() {
  closeDD();
  confirm2('⚠️','حذف جميع البيانات','هذا الإجراء نهائي ولا يمكن التراجع عنه!','danger',()=>{
    D={groups:[]}; save(); render(); toast('تم الحذف ✅', 'success');
  });
}

/* ── modal helpers و قفل الخلفية ── */
function openModal(id) {
  const el = document.getElementById(id);
  if (!el.classList.contains('show')) {
    el.classList.add('show');
    history.pushState({ modalId: id }, null, window.location.href);
    document.body.style.overflow = 'hidden'; // قفل سحب الخلفية
  }
}

function closeModal(id, fromHistory = false) {
  const el = document.getElementById(id);
  if (el.classList.contains('show')) {
    el.classList.remove('show');
    
    if (document.querySelectorAll('.overlay.show').length === 0) {
      document.body.style.overflow = ''; // فك قفل سحب الخلفية
    }

    if (id === 'group-view-modal') {
      openGroupId = null;
      if (swapMode && swapSrc && swapSrc.type === 'link') {
          swapSrc = null;
          render();
      }
    }
    
    if (!fromHistory && history.state && history.state.modalId === id) {
      ignoreNextPop = true; 
      history.back();
    }
  }
}

function overlayClose(e,id) { 
  if(e.target===e.currentTarget) closeModal(id); 
}

window.addEventListener('popstate', (e) => {
  if (ignoreNextPop) {
    ignoreNextPop = false;
    return;
  }
  const activeModals = document.querySelectorAll('.overlay.show');
  if (activeModals.length > 0) {
    const lastModal = activeModals[activeModals.length - 1];
    closeModal(lastModal.id, true);
  }
});

function confirm2(icon,title,msg,type,cb) {
  document.getElementById('conf-icon').textContent=icon;
  document.getElementById('conf-title').textContent=title;
  document.getElementById('conf-msg').textContent=msg;
  const ok=document.getElementById('conf-ok');
  ok.className='cbtn '+(type==='danger'?'cbtn-danger':'cbtn-confirm');
  ok.textContent='تأكيد';
  confirmCb=cb;
  openModal('confirm-modal');
}
function runConfirm() { if(confirmCb){ confirmCb(); confirmCb=null; } closeModal('confirm-modal'); }

/* dropdown */
function handleDDToggle(e) {
  e.stopPropagation();
  checkAuth(() => document.getElementById('ddmenu').classList.toggle('show'));
}
function closeDD() { document.getElementById('ddmenu').classList.remove('show'); }
document.addEventListener('click', e=>{
  if(!e.target.closest('.dropdown')) closeDD();
});

/* toast */
let toastTimer;
function toast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.innerHTML = msg;
  t.className = 'toast';
  if (type === 'error-bare') {
    t.classList.add('toast-bare');
  }
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}