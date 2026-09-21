'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => (typeof n === 'number' && isFinite(n)) ? '$' + n.toFixed(2) : '—';

/* ---------- storage (this phone's browser only) ---------- */
const store = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); }catch{ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch{ return false; } },
};
const KEY_RECEIPTS = 'rp.receipts', KEY_API = 'rp.apiKey', KEY_MODEL = 'rp.model';
const DEFAULT_MODEL = 'gemini-2.5-flash';

let receipts = store.get(KEY_RECEIPTS, []);
let mode = store.get('rp.mode', 'exact'), multiOnly = store.get('rp.multi', false), tab = store.get('rp.tab', 'compare');
let query = '', editing = null, confirmDel = null;

function saveReceipts(){
  if(!store.set(KEY_RECEIPTS, receipts)) $('#stats').textContent = '保存失败：浏览器存储已满或被禁用。先导出备份。';
  render();
}
const newId = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const apiKey = () => store.get(KEY_API, '');
const model = () => store.get(KEY_MODEL, '') || DEFAULT_MODEL;

/* ---------- units ---------- */
const UNITS = { 'oz':['mass',28.3495], 'lb':['mass',453.592], 'g':['mass',1], 'kg':['mass',1000],
  'fl oz':['vol',29.5735], 'floz':['vol',29.5735], 'ml':['vol',1], 'l':['vol',1000], 'ct':['count',1] };
const PER = { mass:['oz',28.3495], vol:['fl oz',29.5735], count:['个',1] };
function norm(size){
  if(!size || !(Number(size.value) > 0)) return null;
  const u = UNITS[String(size.unit || '').toLowerCase().trim()];
  return u ? { dim:u[0], base:Number(size.value) * u[1] } : null;
}
function sizeText(size){
  if(!size || !(Number(size.value) > 0)) return '';
  return size.unit === 'ct' ? size.value + ' 个' : size.value + ' ' + size.unit;
}
function perText(price, n){
  if(!n) return '';
  const [label, f] = PER[n.dim];
  const v = price / n.base * f;
  return '$' + (v < 0.1 ? v.toFixed(3) : v.toFixed(2)) + '/' + label;
}
const pkgPrice = it => (typeof it.unitPrice === 'number') ? it.unitPrice : (Number(it.lineTotal) || 0) / (Number(it.qty) || 1);

/* ---------- compare ---------- */
function buildGroups(){
  const groups = new Map();
  for(const r of receipts){
    for(const it of (r.items || [])){
      let key, title, zh;
      if(mode === 'exact'){
        key = it.upc ? 'upc:' + it.upc : 'k:' + String(it.productKey || it.name || it.raw || '').toLowerCase();
        title = it.name || it.raw; zh = it.nameZh;
      } else {
        key = 'c:' + String(it.category || it.name || '').toLowerCase();
        title = it.category || it.name; zh = it.categoryZh || it.nameZh;
      }
      if(key.endsWith(':')) continue;
      if(!groups.has(key)) groups.set(key, { key, title, zh, entries:[] });
      groups.get(key).entries.push({ r, it, storeKey:(r.store || '未知店') + '|' + (r.branch || ''), when:(r.date || '') + '|' + (r.createdAt || '') });
    }
  }
  const out = [];
  for(const g of groups.values()){
    const byStore = new Map();
    for(const e of g.entries){
      const cur = byStore.get(e.storeKey);
      if(!cur || e.when > cur.when) byStore.set(e.storeKey, e);
    }
    const offers = [...byStore.values()].map(e => ({ ...e, price:pkgPrice(e.it), n:norm(e.it.size) }));
    const allSized = offers.length > 0 && offers.every(o => o.n) && new Set(offers.map(o => o.n.dim)).size === 1;
    offers.forEach(o => o.per = allSized ? o.price / o.n.base : null);
    offers.sort((a, b) => allSized ? a.per - b.per : a.price - b.price);
    out.push({ ...g, offers, basis: offers.length < 2 ? 'one' : allSized ? 'unit' : 'pkg' });
  }
  out.sort((a, b) => (b.offers.length > 1) - (a.offers.length > 1) || String(a.zh || a.title).localeCompare(String(b.zh || b.title), 'zh'));
  return out;
}
const storeLabel = r => esc(r.store || '未知店') + (r.branch ? ' · ' + esc(String(r.branch).split(',')[0]) : '');

function renderCompare(){
  const el = $('#compareList');
  if(!receipts.length){ el.innerHTML = '<div class="empty">还没有小票。拍一张试试。</div>'; return; }
  const q = query.trim().toLowerCase();
  let gs = buildGroups();
  if(multiOnly) gs = gs.filter(g => g.offers.length > 1);
  if(q) gs = gs.filter(g => (String(g.title) + ' ' + (g.zh || '')).toLowerCase().includes(q));
  if(!gs.length){ el.innerHTML = '<div class="empty">' + (multiOnly ? '还没有在两家以上店买过的商品。多扫几张不同店的小票就会出现。' : '没有匹配的商品。') + '</div>'; return; }
  const chip = { unit:'<span class="chip unit">按单价</span>', pkg:'<span class="chip pkg">规格未知 · 仅供参考</span>', one:'<span class="chip one">只有 1 家店</span>' };
  el.innerHTML = gs.map(g => {
    const b = g.offers[0], sz = sizeText(b.it.size);
    const others = g.offers.slice(1).map(o =>
      `<li><span>${storeLabel(o.r)}${sizeText(o.it.size) ? ' · ' + esc(sizeText(o.it.size)) : ''}</span><span class="mono">${money(o.price)}${o.n ? ' · ' + perText(o.price, o.n) : ''}</span></li>`).join('');
    return `<div class="row">
      <div class="row-head"><div class="pname">${esc(g.zh || g.title)}${g.zh ? `<small>${esc(g.title)}</small>` : ''}</div>${chip[g.basis]}</div>
      <div class="best"><span class="hl">${storeLabel(b.r)}</span><span class="price">${money(b.price)}</span>${sz ? `<span class="per">${esc(sz)}</span>` : ''}${b.n ? `<span class="per">${perText(b.price, b.n)}</span>` : ''}</div>
      ${others ? `<ul class="others">${others}</ul>` : ''}
    </div>`;
  }).join('');
}

/* ---------- receipts ---------- */
function renderReceipts(){
  const el = $('#receiptList');
  if(!receipts.length){ el.innerHTML = '<div class="list"><div class="empty">还没有小票。</div></div>'; return; }
  const list = [...receipts].sort((a, b) => String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || '')));
  el.innerHTML = list.map(r => {
    const rows = (r.items || []).map(it => `<tr><td>${esc(it.nameZh || it.name)}<div class="sz">${esc(it.name || it.raw)}${sizeText(it.size) ? ' · ' + esc(sizeText(it.size)) : ''}${Number(it.qty) > 1 ? ' · ' + it.qty + ' 件' : ''}${it.memberPrice ? ' · 会员价' : ''}</div></td><td class="mono">${money(Number(it.lineTotal))}</td></tr>`).join('');
    const isEdit = editing === r.id;
    return `<article class="card">
      <div class="rcpt-head">
        <div>
          <div class="rcpt-store">${esc(r.store || '未知店')}${r.storeGuessed ? '<span class="chip guess">店名是推测的</span>' : ''}</div>
          <div class="meta">${esc(r.branch || '地址未知')} · ${esc(r.date || '日期未知')} · ${(r.items || []).length} 件</div>
        </div>
        <div class="total"><div class="price">${money(Number(r.total))}</div><div class="meta">${typeof r.tax === 'number' && r.tax > 0 ? '含税 ' + money(r.tax) : '无税'}</div></div>
      </div>
      ${isEdit ? `<div class="edit"><input id="storeEdit" value="${esc(r.store || '')}" aria-label="店名"><button data-act="save" data-id="${esc(r.id)}">保存</button><button data-act="cancel">取消</button></div>` : ''}
      <details><summary>查看商品</summary><table class="items">${rows}</table></details>
      <div class="rcpt-acts">
        ${r.storeGuessed && !isEdit ? `<button data-act="confirm" data-id="${esc(r.id)}">店名没错</button>` : ''}
        ${!isEdit ? `<button data-act="edit" data-id="${esc(r.id)}">改店名</button>` : ''}
        <button class="danger" data-act="del" data-id="${esc(r.id)}">${confirmDel === r.id ? '确认删除？' : '删除'}</button>
      </div>
    </article>`;
  }).join('');
}
$('#receiptList').addEventListener('click', e => {
  const b = e.target.closest('button[data-act]'); if(!b) return;
  const id = b.dataset.id, act = b.dataset.act, r = receipts.find(x => x.id === id);
  if(act === 'edit'){ editing = id; confirmDel = null; renderReceipts(); $('#storeEdit')?.focus(); }
  else if(act === 'cancel'){ editing = null; renderReceipts(); }
  else if(act === 'save' && r){ const v = $('#storeEdit').value.trim(); if(!v) return; editing = null; r.store = v; r.storeGuessed = false; saveReceipts(); }
  else if(act === 'confirm' && r){ r.storeGuessed = false; saveReceipts(); }
  else if(act === 'del'){
    if(confirmDel !== id){ confirmDel = id; renderReceipts(); return; }
    confirmDel = null; receipts = receipts.filter(x => x.id !== id); saveReceipts();
  }
});

function render(){
  const stores = new Set(receipts.map(r => r.store || '未知店'));
  const items = receipts.reduce((n, r) => n + (r.items || []).length, 0);
  $('#stats').textContent = receipts.length ? `${receipts.length} 张小票 · ${stores.size} 家店 · ${items} 件商品` : '还没有小票';
  const hasKey = !!apiKey();
  $('#setup').hidden = hasKey;
  $('#camBtn').classList.toggle('disabled', !hasKey);
  $('#galBtn').classList.toggle('disabled', !hasKey);
  renderCompare(); renderReceipts();
}

/* ---------- tabs & controls ---------- */
function setTab(t){
  tab = t; store.set('rp.tab', t);
  $('#tabCompare').setAttribute('aria-selected', t === 'compare');
  $('#tabReceipts').setAttribute('aria-selected', t === 'receipts');
  $('#viewCompare').hidden = t !== 'compare';
  $('#viewReceipts').hidden = t !== 'receipts';
}
function setMode(m){
  mode = m; store.set('rp.mode', m);
  $('#modeExact').setAttribute('aria-pressed', m === 'exact');
  $('#modeCat').setAttribute('aria-pressed', m === 'cat');
  renderCompare();
}
$('#tabCompare').onclick = () => setTab('compare');
$('#tabReceipts').onclick = () => setTab('receipts');
$('#modeExact').onclick = () => setMode('exact');
$('#modeCat').onclick = () => setMode('cat');
$('#multiOnly').checked = multiOnly;
$('#multiOnly').onchange = e => { multiOnly = e.target.checked; store.set('rp.multi', multiOnly); renderCompare(); };
$('#search').oninput = e => { query = e.target.value; renderCompare(); };

/* ---------- settings ---------- */
const dlg = $('#settings');
$('#openSettings').onclick = () => { $('#apiKey').value = apiKey(); $('#model').value = model(); dlg.showModal(); };
dlg.addEventListener('close', () => {
  if(dlg.returnValue !== 'save') return;
  store.set(KEY_API, $('#apiKey').value.trim());
  store.set(KEY_MODEL, $('#model').value.trim() || DEFAULT_MODEL);
  render(); pump();
});

/* ---------- backup ---------- */
$('#exportBtn').onclick = () => {
  const blob = new Blob([JSON.stringify({ app:'receipt-price', version:1, exportedAt:new Date().toISOString(), receipts }, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '小票比价备份-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
};
$('#importInput').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if(!f) return;
  try{
    const data = JSON.parse(await f.text());
    const incoming = Array.isArray(data) ? data : data.receipts;
    if(!Array.isArray(incoming)) throw 0;
    const have = new Set(receipts.map(r => r.id));
    let added = 0;
    for(const r of incoming){ if(r && Array.isArray(r.items)){ if(!r.id || have.has(r.id)) { if(have.has(r.id)) continue; r.id = newId(); } receipts.push(r); added++; } }
    saveReceipts();
    $('#stats').textContent = `导入了 ${added} 张小票`;
  }catch{ $('#stats').textContent = '导入失败：这不是小票比价导出的备份文件。'; }
};

/* ---------- scanning queue ---------- */
const PROMPT = `图片是一张购物小票。仔细读取，只回复一个 JSON 对象：
{
 "store": "店名。小票上没印店名时，根据地址、门店号、商品风格推断（例如 Trader Joe's），并把 storeGuessed 设为 true",
 "storeGuessed": false,
 "branch": "门店地址，如 \\"2073 Broadway, New York, NY 10023\\"，没有则 null",
 "date": "YYYY-MM-DD，看不到则 null",
 "subtotal": 数字或 null, "tax": 数字或 null, "total": 数字或 null,
 "items": [{
   "raw": "小票上的原文",
   "name": "完整英文商品名，补全被截断的词",
   "nameZh": "简短中文名",
   "brand": "品牌或 null",
   "category": "通用品类，英文小写，用于跨品牌比较，如 greek yogurt / disinfecting wipes / frozen spinach",
   "categoryZh": "品类中文名",
   "productKey": "精确商品标识：品牌+商品+口味/变体，小写，用短横线连接，不含规格，如 lysol-dual-action-disinfecting-wipes",
   "upc": "条码数字或 null",
   "qty": 1,
   "lineTotal": 这一行实付金额（扣掉该行折扣，税前）,
   "unitPrice": 单件价格,
   "regularPrice": 有折扣时的原价，否则 null,
   "memberPrice": 是否会员价 true/false,
   "size": 只有小票上明确印了规格才填 {"value": 数字, "unit": "oz|lb|g|kg|fl oz|ml|l|ct"}，否则 null。"80S"、"75SH"、"4S" 这类表示数量，用 ct。按重量计价（如 1.32 lb @ 2.99/lb）填重量。不要猜。,
   "taxable": true/false
 }]
}
规则：不要输出卡号、授权码、会员号或任何支付信息。"RETURN VALUE"、小计、税、找零等行不是商品。价格一律税前。如果图片不是小票，返回 {"items": []}。`;

async function toJpegBase64(file){
  const bmp = await createImageBitmap(file);
  const max = 2000, s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return c.toDataURL('image/jpeg', 0.85).split(',')[1];
}

class ScanError extends Error { constructor(msg, fatal){ super(msg); this.fatal = fatal; } }
async function askGemini(b64){
  let res;
  try{
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model())}:generateContent`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'x-goog-api-key':apiKey() },
      body:JSON.stringify({
        contents:[{ parts:[ { inline_data:{ mime_type:'image/jpeg', data:b64 } }, { text:PROMPT } ] }],
        generationConfig:{ responseMimeType:'application/json', temperature:0 },
      }),
    });
  }catch{ throw new ScanError('网络连不上 Gemini，检查网络后点重试。'); }
  let body = null; try{ body = await res.json(); }catch{}
  if(!res.ok){
    const m = body?.error?.message || '';
    if(res.status === 400 && /API key/i.test(m)) throw new ScanError('API 密钥无效，到"设置"里重新填。', true);
    if(res.status === 403) throw new ScanError('API 密钥没有权限，到"设置"里检查。', true);
    if(res.status === 404) throw new ScanError(`找不到模型 ${model()}，到"设置"里换一个模型名。`, true);
    if(res.status === 429) throw new ScanError('免费额度暂时用完了（每分钟或每天有上限），过一会儿再点重试。');
    throw new ScanError('识别失败（' + res.status + '），点重试。');
  }
  const text = (body?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
  if(!text) throw new ScanError(body?.promptFeedback?.blockReason ? '这张图片被拒绝识别，换一张试试。' : '没有返回结果，点重试。');
  try{ return JSON.parse(text); }
  catch{
    const a = text.indexOf('{'), b = text.lastIndexOf('}');
    if(a > -1 && b > a){ try{ return JSON.parse(text.slice(a, b + 1)); }catch{} }
    throw new ScanError('识别结果格式不对，点重试。');
  }
}

function clean(p){
  const num = v => (typeof v === 'number' && isFinite(v)) ? v : (v != null && v !== '' && !isNaN(parseFloat(v)) ? parseFloat(v) : null);
  const str = v => (v == null || v === '') ? null : String(v).slice(0, 200);
  const unitOk = u => ['oz','lb','g','kg','fl oz','ml','l','ct'].includes(u);
  const items = (Array.isArray(p.items) ? p.items : []).map(it => {
    const u = String(it.size?.unit || '').toLowerCase().trim();
    const s = it.size && num(it.size.value) > 0 && unitOk(u) ? { value:num(it.size.value), unit:u } : null;
    const qty = num(it.qty) || 1, line = num(it.lineTotal);
    return { raw:str(it.raw), name:str(it.name) || str(it.raw), nameZh:str(it.nameZh), brand:str(it.brand),
      category:str(it.category)?.toLowerCase() ?? null, categoryZh:str(it.categoryZh),
      productKey:str(it.productKey)?.toLowerCase() ?? null, upc:(str(it.upc) || '').replace(/\D/g, '') || null,
      qty, lineTotal:line, unitPrice:num(it.unitPrice) ?? (line != null ? line / qty : null),
      regularPrice:num(it.regularPrice), memberPrice:!!it.memberPrice, size:s, taxable:!!it.taxable };
  }).filter(it => it.name && it.lineTotal != null);
  return { id:newId(), store:str(p.store) || '未知店', storeGuessed:!!p.storeGuessed, branch:str(p.branch),
    date:/^\d{4}-\d{2}-\d{2}$/.test(p.date || '') ? p.date : null,
    subtotal:num(p.subtotal), tax:num(p.tax), total:num(p.total), items, createdAt:new Date().toISOString() };
}

const jobs = []; let running = 0, jobSeq = 0; const MAX_RUN = 2;
function addFiles(files){
  if(!apiKey()){ dlg.showModal(); return; }
  for(const f of files) jobs.push({ id:++jobSeq, file:f, url:URL.createObjectURL(f), status:'queued', msg:'' });
  renderQueue(); pump();
}
$('#camInput').onchange = e => { addFiles([...e.target.files]); e.target.value = ''; };
$('#galInput').onchange = e => { addFiles([...e.target.files]); e.target.value = ''; };

async function run(job){
  job.status = 'working'; job.msg = ''; renderQueue();
  try{
    let b64;
    try{ b64 = await toJpegBase64(job.file); }catch{ throw new ScanError('这张图片打不开，换一张试试。'); }
    const rec = clean(await askGemini(b64) || {});
    if(!rec.items.length) throw new ScanError('没读到商品，照片可能太糊或不是小票。');
    receipts.push(rec); saveReceipts();
    job.status = 'done'; job.msg = `${rec.store} · ${rec.items.length} 件 · ${money(rec.total)}`;
  }catch(e){
    job.status = 'error'; job.msg = e instanceof ScanError ? e.message : '识别失败，点重试。';
    if(e.fatal) jobs.forEach(j => { if(j.status === 'queued'){ j.status = 'error'; j.msg = '已暂停：' + e.message; } });
  }
  renderQueue();
}
function pump(){
  if(!apiKey()) return;
  while(running < MAX_RUN){
    const j = jobs.find(j => j.status === 'queued'); if(!j) break;
    running++; run(j).finally(() => { running--; pump(); });
  }
}
function renderQueue(){
  const st = { queued:'排队中', working:'<span class="spin"></span>识别中…', done:'✓ ', error:'' };
  $('#queue').innerHTML = jobs.map(j => `<li class="job">
    <img src="${j.url}" alt="">
    <div class="st ${j.status === 'error' ? 'err' : j.status === 'done' ? 'done' : ''}">${st[j.status]}${esc(j.msg)}</div>
    <div class="acts">${j.status === 'error' ? `<button data-retry="${j.id}">重试</button>` : ''}${j.status === 'done' || j.status === 'error' ? `<button data-rm="${j.id}">移除</button>` : ''}</div>
  </li>`).join('');
}
$('#queue').addEventListener('click', e => {
  const r = e.target.closest('[data-retry]'), m = e.target.closest('[data-rm]');
  if(r){ const j = jobs.find(j => j.id == r.dataset.retry); if(j){ j.status = 'queued'; j.msg = ''; renderQueue(); pump(); } }
  if(m){ const i = jobs.findIndex(j => j.id == m.dataset.rm); if(i > -1){ URL.revokeObjectURL(jobs[i].url); jobs.splice(i, 1); renderQueue(); } }
});
window.addEventListener('beforeunload', e => { if(jobs.some(j => j.status === 'queued' || j.status === 'working')){ e.preventDefault(); e.returnValue = ''; } });

/* ---------- boot ---------- */
setTab(tab); setMode(mode); render();
