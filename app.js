'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => (typeof n === 'number' && isFinite(n)) ? '$' + n.toFixed(2) : '—';

/* ---------- storage (this device's browser only) ---------- */
const store = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); }catch{ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch{ return false; } },
};
/* AI services. Every user brings their own key; calls go straight from the browser to the provider. */
const PROVIDERS = {
  gemini:     { label:'Google Gemini', kind:'gemini', model:'gemini-flash-latest', keyUrl:'https://aistudio.google.com/apikey', free:true,
                note:{ zh:'免费额度，需要能访问 Google', en:'Free tier; needs access to Google' } },
  openrouter: { label:'OpenRouter', kind:'openai', base:'https://openrouter.ai/api/v1', model:'openrouter/free', keyUrl:'https://openrouter.ai/keys', free:true,
                note:{ zh:'有免费模型（openrouter/free 会自动挑一个支持图片的免费模型）', en:'Free models available (openrouter/free picks a free image-capable one)' } },
  zhipu:      { label:'智谱 GLM (Zhipu)', kind:'openai', base:'https://open.bigmodel.cn/api/paas/v4', model:'glm-4v-flash', keyUrl:'https://open.bigmodel.cn/usercenter/apikeys', free:true, rawB64:true,
                note:{ zh:'GLM-4V-Flash 免费，国内可直接使用', en:'GLM-4V-Flash is free; works in mainland China' } },
  qwen:       { label:'阿里云百炼 Qwen (Alibaba)', kind:'openai', base:'https://dashscope.aliyuncs.com/compatible-mode/v1', model:'qwen-vl-plus', keyUrl:'https://bailian.console.aliyun.com/',
                note:{ zh:'新用户有免费额度，之后按量付费', en:'Free credit for new users, then pay as you go' } },
  openai:     { label:'OpenAI', kind:'openai', base:'https://api.openai.com/v1', model:'gpt-5-mini', keyUrl:'https://platform.openai.com/api-keys',
                note:{ zh:'付费，按量计费', en:'Paid, pay as you go' } },
  anthropic:  { label:'Anthropic Claude', kind:'anthropic', model:'claude-haiku-4-5', keyUrl:'https://console.anthropic.com/settings/keys',
                note:{ zh:'付费，按量计费', en:'Paid, pay as you go' } },
  custom:     { label:'Other (OpenAI-compatible)', kind:'openai', base:'', model:'', keyUrl:'',
                note:{ zh:'任何兼容 OpenAI 接口、支持图片的服务，自己填接口地址和模型名', en:'Any OpenAI-compatible service with image input; enter its base URL and model' } },
};
const ai = (() => {
  const s = store.get('rp.ai', null) || { provider:'gemini', keys:{}, models:{}, base:'' };
  const oldKey = store.get('rp.apiKey', ''); // migrate the Gemini-only version
  if(oldKey && !s.keys.gemini){ s.keys.gemini = oldKey; const m = store.get('rp.model', ''); if(m) s.models.gemini = m; }
  return s;
})();
let receipts = store.get('rp.receipts', []);
let mode = store.get('rp.mode', 'exact'), multiOnly = store.get('rp.multi', false), tab = store.get('rp.tab', 'compare');
let lang = store.get('rp.lang', /^zh/i.test(navigator.language || '') ? 'zh' : 'en');
let query = '', editing = null, confirmDel = null;
const prov = () => PROVIDERS[ai.provider] || PROVIDERS.gemini;
const apiKey = () => ai.keys[ai.provider] || '';
const model = () => ai.models[ai.provider] || prov().model;
const baseUrl = () => (ai.provider === 'custom' ? ai.base : prov().base || '').replace(/\/+$/, '');
const newId = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- text ---------- */
const T = {
  zh: {
    appName:'小票比价', settings:'设置', langBtn:'EN',
    setupTitle:'第一步：选一个 AI 服务，填入你自己的密钥',
    setupIntro:'这几个有免费额度，任选一个申请密钥：', setupThen:'然后点右上角"设置"，选服务、粘贴密钥、保存。',
    keyLocal:'密钥只保存在这台设备的浏览器里，不会上传到别的地方。每个人用自己的密钥，额度各算各的。',
    homeTip:'建议在 Safari 点「分享」→「添加到主屏幕」，以后从主屏幕图标打开。否则如果 7 天没打开这个网站，Safari 可能会自动清除你的小票数据。',
    gotIt:'知道了',
    backupTip:n => `有 ${n} 张小票还没备份。数据只存在这台设备上，建议导出一份存到云盘。`,
    exportBackup:'导出备份', importBackup:'导入备份',
    backupHint:'数据只存在这台设备的浏览器里。换手机或清除浏览器数据前，先导出备份。iPhone 上可以直接存到 iCloud 云盘。',
    takePhoto:'拍小票', choosePhotos:'从相册选',
    scanHint:'可以连续拍，也可以一次选多张。照片排队自动识别，识别期间请保持这个页面开着。',
    tabCompare:'比价', tabReceipts:'小票', search:'搜商品，如 yogurt / 酸奶',
    modeExact:'同款', modeCat:'同类', multiOnly:'只看多家店',
    compareHint:'规格都知道时按单价比（每 oz / fl oz / 个）；缺规格时按包装价比，只能当参考。价格都是税前的最新一次记录。',
    sourceLink:'开源代码 · GitHub',
    stats:(r,s,i) => `${r} 张小票 · ${s} 家店 · ${i} 件商品`, noReceipts:'还没有小票',
    emptyCompare:'还没有小票。拍一张试试。', emptyMulti:'还没有在两家以上店买过的商品。多扫几张不同店的小票就会出现。', noMatch:'没有匹配的商品。',
    chipUnit:'按单价', chipPkg:'规格未知 · 仅供参考', chipOne:'只有 1 家店', each:'个',
    guessed:'店名是推测的', noAddr:'地址未知', noDate:'日期未知', nItems:n => `${n} 件`, qty:n => `${n} 件`, member:'会员价',
    withTax:'含税 ', noTax:'无税', showItems:'查看商品', nameOk:'店名没错', rename:'改店名', del:'删除', delConfirm:'确认删除？',
    save:'保存', cancel:'取消', storeName:'店名', unknownStore:'未知店',
    providerLabel:'AI 服务', apiKeyLabel:'API 密钥', keyHint:u => `在 <a href="${u}" target="_blank" rel="noopener">这里</a>申请。密钥只保存在这台设备上。`,
    baseLabel:'接口地址（OpenAI 兼容）', modelLabel:'模型', modelHint:'已填好推荐的模型。如果提示模型不存在，换成服务商后台列出的、支持图片的模型名。',
    privacyNote:'注意：小票照片会发给你选的 AI 服务商。免费服务的内容可能被服务商用来改进模型。拍照时可以把卡号那部分挡住。',
    eCredit:'账户余额或额度不足，到服务商后台充值或换一个服务。', eCors:'连不上这个服务：可能网络不通，或者它不允许网页直接调用。换一个服务试试。',
    saveFail:'保存失败：浏览器存储已满或被禁用。先导出备份。',
    imported:n => `导入了 ${n} 张小票`, importFail:'导入失败：这不是小票比价导出的备份文件。',
    queued:'排队中', working:'识别中…', paused:'已暂停：',
    eNet:'网络连不上，检查网络后点重试。', eKey:'API 密钥无效，到"设置"里重新填。', eForbid:'API 密钥没有权限，到"设置"里检查。',
    eModel:m => `找不到模型 ${m}（服务商可能已经下线了这个版本），到"设置"里换一个模型名，比如 Gemini 可以填 gemini-flash-latest。`, eQuota:'免费额度暂时用完了（每分钟或每天有上限），过一会儿再点重试。',
    eHttp:c => `识别失败（${c}），点重试。`, eBlocked:'这张图片被拒绝识别，换一张试试。', eEmpty:'没有返回结果，点重试。',
    eFormat:'识别结果格式不对，点重试。', eImage:'这张图片打不开，换一张试试。', eNoItems:'没读到商品，照片可能太糊或不是小票。', eOther:'识别失败，点重试。',
    retry:'重试', retryNow:'立即重试', remove:'移除', backupName:'小票比价备份', retryAll:n => `全部重试（${n} 张）`,
    autoRetry:(n, max) => `遇到临时错误（服务繁忙或额度紧张），正在自动重试（第 ${n}/${max} 次）…`,
  },
  en: {
    appName:'Receipt Price', settings:'Settings', langBtn:'中文',
    setupTitle:'Step 1: pick an AI service and add your own key',
    setupIntro:'These have free tiers. Get a key from any one:', setupThen:'Then tap Settings (top right), choose the service, paste the key and save.',
    keyLocal:'Your key stays in this browser on this device and is never sent anywhere else. Everyone uses their own key and their own free quota.',
    homeTip:'Tip: in Safari, tap Share → Add to Home Screen and open the app from that icon. Otherwise Safari may clear your receipts if you don\'t open this site for 7 days.',
    gotIt:'Got it',
    backupTip:n => `${n} receipts aren't backed up. Your data only lives on this device, so save a backup to your cloud drive.`,
    exportBackup:'Export backup', importBackup:'Import backup',
    backupHint:'Your data lives only in this browser. Export a backup before switching phones or clearing browser data. On iPhone you can save it straight to iCloud Drive.',
    takePhoto:'Take photo', choosePhotos:'Choose photos',
    scanHint:'Snap one after another or pick several at once. Photos are read in a queue; keep this page open while they process.',
    tabCompare:'Compare', tabReceipts:'Receipts', search:'Search items, e.g. yogurt',
    modeExact:'Same product', modeCat:'Same type', multiOnly:'Only items from 2+ stores',
    compareHint:'When every size is known, items are ranked by unit price (per oz / fl oz / each). Otherwise by package price, so treat those as rough. All prices are before tax and use the latest record.',
    sourceLink:'Open source · GitHub',
    stats:(r,s,i) => `${r} receipts · ${s} stores · ${i} items`, noReceipts:'No receipts yet',
    emptyCompare:'No receipts yet. Snap one to start.', emptyMulti:'No item bought at 2+ stores yet. Scan receipts from different stores to see comparisons.', noMatch:'No matching items.',
    chipUnit:'By unit price', chipPkg:'Size unknown · rough', chipOne:'1 store only', each:'ea',
    guessed:'Store name guessed', noAddr:'Unknown address', noDate:'Unknown date', nItems:n => `${n} items`, qty:n => `qty ${n}`, member:'member price',
    withTax:'incl. tax ', noTax:'no tax', showItems:'Show items', nameOk:'Name is right', rename:'Rename store', del:'Delete', delConfirm:'Delete for good?',
    save:'Save', cancel:'Cancel', storeName:'Store name', unknownStore:'Unknown store',
    providerLabel:'AI service', apiKeyLabel:'API key', keyHint:u => `Get one <a href="${u}" target="_blank" rel="noopener">here</a>. Stored on this device only.`,
    baseLabel:'Base URL (OpenAI-compatible)', modelLabel:'Model', modelHint:'A suggested model is filled in. If you see "model not found", use an image-capable model name from your provider\'s dashboard.',
    privacyNote:'Note: receipt photos are sent to the AI service you pick. Free tiers may use your content to improve their models. You can cover your card number when taking the photo.',
    eCredit:'Out of credit or quota. Top up with the provider or pick another service.', eCors:'Can\'t reach this service: the network may be blocked, or it doesn\'t allow calls from web pages. Try another service.',
    saveFail:'Could not save: browser storage is full or blocked. Export a backup first.',
    imported:n => `Imported ${n} receipts`, importFail:'Import failed: this isn\'t a Receipt Price backup file.',
    queued:'Queued', working:'Reading…', paused:'Paused: ',
    eNet:'Can\'t reach the network. Check your connection and tap Retry.', eKey:'Invalid API key. Update it in Settings.', eForbid:'This API key isn\'t allowed. Check it in Settings.',
    eModel:m => `Model ${m} not found (the provider may have retired this version). Change the model name in Settings — for Gemini try gemini-flash-latest.`, eQuota:'Free quota used up for now (there are per-minute and per-day limits). Wait a bit and tap Retry.',
    eHttp:c => `Reading failed (${c}). Tap Retry.`, eBlocked:'This image was refused. Try another photo.', eEmpty:'No result came back. Tap Retry.',
    eFormat:'The result was malformed. Tap Retry.', eImage:'Can\'t open this image. Try another one.', eNoItems:'No items found. The photo may be blurry or not a receipt.', eOther:'Reading failed. Tap Retry.',
    retry:'Retry', retryNow:'Retry now', remove:'Remove', backupName:'receipt-price-backup', retryAll:n => `Retry all (${n})`,
    autoRetry:(n, max) => `Temporary hiccup (busy service or rate limit) — auto-retrying (${n}/${max})…`,
  },
};
const t = (k, ...a) => { const v = T[lang][k]; return typeof v === 'function' ? v(...a) : v; };
function applyText(){
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-t]').forEach(el => el.textContent = t(el.dataset.t));
  document.querySelectorAll('[data-t-html]').forEach(el => el.innerHTML = t(el.dataset.tHtml));
  $('#langBtn').textContent = t('langBtn');
  $('#search').placeholder = t('search');
  if(typeof renderSetupOpts === 'function') renderSetupOpts();
}

/* ---------- units ---------- */
const UNITS = { 'oz':['mass',28.3495], 'lb':['mass',453.592], 'g':['mass',1], 'kg':['mass',1000],
  'fl oz':['vol',29.5735], 'floz':['vol',29.5735], 'ml':['vol',1], 'l':['vol',1000], 'ct':['count',1] };
function norm(size){
  if(!size || !(Number(size.value) > 0)) return null;
  const u = UNITS[String(size.unit || '').toLowerCase().trim()];
  return u ? { dim:u[0], base:Number(size.value) * u[1] } : null;
}
function sizeText(size){
  if(!size || !(Number(size.value) > 0)) return '';
  return size.unit === 'ct' ? size.value + ' ' + t('each') : size.value + ' ' + size.unit;
}
function perText(price, n){
  if(!n) return '';
  const [label, f] = { mass:['oz',28.3495], vol:['fl oz',29.5735], count:[t('each'),1] }[n.dim];
  const v = price / n.base * f;
  return '$' + (v < 0.1 ? v.toFixed(3) : v.toFixed(2)) + '/' + label;
}
const pkgPrice = it => (typeof it.unitPrice === 'number') ? it.unitPrice : (Number(it.lineTotal) || 0) / (Number(it.qty) || 1);
const itemName = it => lang === 'zh' ? (it.nameZh || it.name || it.raw) : (it.name || it.raw);

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
      groups.get(key).entries.push({ r, it, storeKey:(r.store || '?') + '|' + (r.branch || ''), when:(r.date || '') + '|' + (r.createdAt || '') });
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
  const label = g => String(lang === 'zh' ? (g.zh || g.title) : g.title);
  out.sort((a, b) => (b.offers.length > 1) - (a.offers.length > 1) || label(a).localeCompare(label(b), lang));
  return out;
}
const storeLabel = r => esc(r.store || t('unknownStore')) + (r.branch ? ' · ' + esc(String(r.branch).split(',')[0]) : '');

function renderCompare(){
  const el = $('#compareList');
  if(!receipts.length){ el.innerHTML = `<div class="empty">${t('emptyCompare')}</div>`; return; }
  const q = query.trim().toLowerCase();
  let gs = buildGroups();
  if(multiOnly) gs = gs.filter(g => g.offers.length > 1);
  if(q) gs = gs.filter(g => (String(g.title) + ' ' + (g.zh || '')).toLowerCase().includes(q));
  if(!gs.length){ el.innerHTML = `<div class="empty">${t(multiOnly ? 'emptyMulti' : 'noMatch')}</div>`; return; }
  const chip = { unit:`<span class="chip unit">${t('chipUnit')}</span>`, pkg:`<span class="chip pkg">${t('chipPkg')}</span>`, one:`<span class="chip one">${t('chipOne')}</span>` };
  el.innerHTML = gs.map(g => {
    const b = g.offers[0], sz = sizeText(b.it.size);
    const main = lang === 'zh' ? (g.zh || g.title) : g.title, sub = lang === 'zh' && g.zh ? g.title : '';
    const others = g.offers.slice(1).map(o =>
      `<li><span>${storeLabel(o.r)}${sizeText(o.it.size) ? ' · ' + esc(sizeText(o.it.size)) : ''}</span><span class="mono">${money(o.price)}${o.n ? ' · ' + perText(o.price, o.n) : ''}</span></li>`).join('');
    return `<div class="row">
      <div class="row-head"><div class="pname">${esc(main)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>${chip[g.basis]}</div>
      <div class="best"><span class="hl">${storeLabel(b.r)}</span><span class="price">${money(b.price)}</span>${sz ? `<span class="per">${esc(sz)}</span>` : ''}${b.n ? `<span class="per">${perText(b.price, b.n)}</span>` : ''}</div>
      ${others ? `<ul class="others">${others}</ul>` : ''}
    </div>`;
  }).join('');
}

/* ---------- receipts ---------- */
function renderReceipts(){
  const el = $('#receiptList');
  if(!receipts.length){ el.innerHTML = `<div class="list"><div class="empty">${t('noReceipts')}</div></div>`; return; }
  const list = [...receipts].sort((a, b) => String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || '')));
  el.innerHTML = list.map(r => {
    const rows = (r.items || []).map(it => {
      const extra = [lang === 'zh' ? (it.name || it.raw) : (it.raw || ''), sizeText(it.size), Number(it.qty) > 1 ? t('qty', it.qty) : '', it.memberPrice ? t('member') : ''].filter(Boolean).join(' · ');
      return `<tr><td>${esc(itemName(it))}<div class="sz">${esc(extra)}</div></td><td class="mono">${money(Number(it.lineTotal))}</td></tr>`;
    }).join('');
    const isEdit = editing === r.id;
    return `<article class="card">
      <div class="rcpt-head">
        <div>
          <div class="rcpt-store">${esc(r.store || t('unknownStore'))}${r.storeGuessed ? `<span class="chip guess">${t('guessed')}</span>` : ''}</div>
          <div class="meta">${esc(r.branch || t('noAddr'))} · ${esc(r.date || t('noDate'))} · ${t('nItems', (r.items || []).length)}</div>
        </div>
        <div class="total"><div class="price">${money(Number(r.total))}</div><div class="meta">${typeof r.tax === 'number' && r.tax > 0 ? t('withTax') + money(r.tax) : t('noTax')}</div></div>
      </div>
      ${isEdit ? `<div class="edit"><input id="storeEdit" value="${esc(r.store || '')}" aria-label="${t('storeName')}"><button data-act="save" data-id="${esc(r.id)}">${t('save')}</button><button data-act="cancel">${t('cancel')}</button></div>` : ''}
      <details><summary>${t('showItems')}</summary><table class="items">${rows}</table></details>
      <div class="rcpt-acts">
        ${r.storeGuessed && !isEdit ? `<button data-act="confirm" data-id="${esc(r.id)}">${t('nameOk')}</button>` : ''}
        ${!isEdit ? `<button data-act="edit" data-id="${esc(r.id)}">${t('rename')}</button>` : ''}
        <button class="danger" data-act="del" data-id="${esc(r.id)}">${confirmDel === r.id ? t('delConfirm') : t('del')}</button>
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

/* ---------- keeping data safe ---------- */
function saveReceipts(){
  if(!store.set('rp.receipts', receipts)) $('#stats').textContent = t('saveFail');
  else navigator.storage?.persist?.().catch(() => {});
  render();
}
const unbacked = () => { const at = store.get('rp.backupAt', ''); return receipts.filter(r => !at || String(r.createdAt || '') > at).length; };
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function renderTips(){
  $('#homeTip').hidden = !(isIOS && !isStandalone && !store.get('rp.hideHomeTip', false));
  const n = unbacked();
  $('#backupTip').hidden = n < 3;
  if(n >= 3) $('#backupTipText').textContent = t('backupTip', n);
}
$('#homeTipClose').onclick = () => { store.set('rp.hideHomeTip', true); renderTips(); };

async function exportBackup(){
  const name = t('backupName') + '-' + new Date().toISOString().slice(0, 10) + '.json';
  const json = JSON.stringify({ app:'receipt-price', version:1, exportedAt:new Date().toISOString(), receipts }, null, 2);
  const file = new File([json], name, { type:'application/json' });
  if(navigator.canShare?.({ files:[file] })){
    try{ await navigator.share({ files:[file], title:name }); store.set('rp.backupAt', new Date().toISOString()); renderTips(); return; }
    catch(e){ if(e?.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  store.set('rp.backupAt', new Date().toISOString()); renderTips();
}
$('#exportBtn').onclick = exportBackup;
$('#backupTipBtn').onclick = exportBackup;
$('#importInput').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if(!f) return;
  try{
    const data = JSON.parse(await f.text());
    const incoming = Array.isArray(data) ? data : data.receipts;
    if(!Array.isArray(incoming)) throw 0;
    const have = new Set(receipts.map(r => r.id));
    let added = 0;
    for(const r of incoming){
      if(!r || !Array.isArray(r.items) || (r.id && have.has(r.id))) continue;
      if(!r.id) r.id = newId();
      receipts.push(r); have.add(r.id); added++;
    }
    saveReceipts();
    $('#stats').textContent = t('imported', added);
  }catch{ $('#stats').textContent = t('importFail'); }
};

/* ---------- page ---------- */
function render(){
  const stores = new Set(receipts.map(r => r.store || '?'));
  const items = receipts.reduce((n, r) => n + (r.items || []).length, 0);
  $('#stats').textContent = receipts.length ? t('stats', receipts.length, stores.size, items) : t('noReceipts');
  const hasKey = !!apiKey();
  $('#setup').hidden = hasKey;
  $('#camBtn').classList.toggle('disabled', !hasKey);
  $('#galBtn').classList.toggle('disabled', !hasKey);
  renderTips(); renderCompare(); renderReceipts(); renderQueue();
}
function setTab(v){
  tab = v; store.set('rp.tab', v);
  $('#tabCompare').setAttribute('aria-selected', v === 'compare');
  $('#tabReceipts').setAttribute('aria-selected', v === 'receipts');
  $('#viewCompare').hidden = v !== 'compare';
  $('#viewReceipts').hidden = v !== 'receipts';
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
$('#langBtn').onclick = () => { lang = lang === 'zh' ? 'en' : 'zh'; store.set('rp.lang', lang); applyText(); render(); };

const dlg = $('#settings');
let draft = null; // edits in the dialog, kept per service until Save
function fillProviderFields(){
  const id = $('#provider').value, p = PROVIDERS[id];
  $('#providerNote').textContent = p.note[lang];
  $('#keyHint').innerHTML = p.keyUrl ? t('keyHint', p.keyUrl) : '';
  $('#apiKey').value = draft.keys[id] || '';
  $('#model').value = draft.models[id] || p.model;
  $('#model').placeholder = p.model || 'model-name';
  $('#baseWrap').hidden = id !== 'custom';
  $('#baseUrl').value = draft.base || '';
}
function keepDraft(){
  const id = draft.provider;
  draft.keys[id] = $('#apiKey').value.trim();
  const m = $('#model').value.trim();
  if(m && m !== PROVIDERS[id].model) draft.models[id] = m; else delete draft.models[id];
  if(id === 'custom') draft.base = $('#baseUrl').value.trim();
}
$('#provider').innerHTML = Object.entries(PROVIDERS).map(([id, p]) => `<option value="${id}">${esc(p.label)}</option>`).join('');
$('#provider').onchange = () => { keepDraft(); draft.provider = $('#provider').value; fillProviderFields(); };
$('#openSettings').onclick = () => {
  draft = JSON.parse(JSON.stringify(ai));
  $('#provider').value = draft.provider;
  fillProviderFields(); dlg.showModal();
};
dlg.addEventListener('close', () => {
  if(dlg.returnValue !== 'save' || !draft) return;
  keepDraft();
  Object.assign(ai, draft); store.set('rp.ai', ai);
  // earlier failures may have been caused by the old settings
  jobs.forEach(j => { if(j.status === 'error' && j.err?.fatal){ j.status = 'queued'; j.err = null; j.pausedBy = false; } });
  render(); pump();
});
function renderSetupOpts(){
  $('#setupOpts').innerHTML = Object.values(PROVIDERS).filter(p => p.free).map(p =>
    `<li><a href="${p.keyUrl}" target="_blank" rel="noopener"><b>${esc(p.label)}</b></a> <span>${esc(p.note[lang])}</span></li>`).join('');
}

/* ---------- scanning ---------- */
const PROMPT = `The image is a shopping receipt. Read it carefully and reply with ONE JSON object only:
{
 "store": "store name. If the receipt doesn't print it, infer it from the address, store number and item style (e.g. Trader Joe's) and set storeGuessed to true",
 "storeGuessed": false,
 "branch": "store address like \\"2073 Broadway, New York, NY 10023\\", or null",
 "date": "YYYY-MM-DD, or null if not visible",
 "subtotal": number or null, "tax": number or null, "total": number or null,
 "items": [{
   "raw": "the line exactly as printed",
   "name": "full English product name, expanding truncated words",
   "nameZh": "short Chinese name",
   "brand": "brand or null",
   "category": "generic category in lowercase English for cross-brand comparison, e.g. greek yogurt / disinfecting wipes / frozen spinach",
   "categoryZh": "category in Chinese",
   "productKey": "exact product id: brand + product + flavor/variant, lowercase, hyphen-joined, WITHOUT size, e.g. lysol-dual-action-disinfecting-wipes",
   "upc": "barcode digits or null",
   "qty": 1,
   "lineTotal": amount paid for this line after line discounts, before tax,
   "unitPrice": price of one unit,
   "regularPrice": original price if discounted, else null,
   "memberPrice": true/false,
   "size": ONLY if the receipt clearly prints it: {"value": number, "unit": "oz|lb|g|kg|fl oz|ml|l|ct"}, else null. Counts like "80S", "75SH", "4S" use ct. For items sold by weight (e.g. 1.32 lb @ 2.99/lb) use the weight. Never guess.,
   "taxable": true/false
 }]
}
Rules: never output card numbers, auth codes, member IDs or any payment details. Lines like "RETURN VALUE", subtotal, tax and change are not items. All prices are before tax. If the image is not a receipt, return {"items": []}.`;

async function toJpegBase64(file){
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return c.toDataURL('image/jpeg', 0.85).split(',')[1];
}

class ScanError extends Error { constructor(key, arg, fatal, retryable){ super(key); this.key = key; this.arg = arg; this.fatal = fatal; this.retryable = retryable; } }
function buildRequest(b64){
  const p = prov(), key = apiKey(), m = model();
  if(p.kind === 'gemini') return {
    url:`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`,
    headers:{ 'Content-Type':'application/json', 'x-goog-api-key':key },
    body:{ contents:[{ parts:[ { inline_data:{ mime_type:'image/jpeg', data:b64 } }, { text:PROMPT } ] }],
           generationConfig:{ responseMimeType:'application/json', temperature:0 } },
    read:j => (j?.candidates?.[0]?.content?.parts || []).map(x => x.text || '').join(''),
    blocked:j => !!j?.promptFeedback?.blockReason,
  };
  if(p.kind === 'anthropic') return {
    url:'https://api.anthropic.com/v1/messages',
    headers:{ 'Content-Type':'application/json', 'x-api-key':key, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
    body:{ model:m, max_tokens:8000, messages:[{ role:'user', content:[
      { type:'image', source:{ type:'base64', media_type:'image/jpeg', data:b64 } }, { type:'text', text:PROMPT } ] }] },
    read:j => (j?.content || []).map(x => x.text || '').join(''),
    blocked:j => j?.stop_reason === 'refusal',
  };
  const headers = { 'Content-Type':'application/json', 'Authorization':'Bearer ' + key };
  if(ai.provider === 'openrouter') headers['X-Title'] = 'Receipt Price';
  return {
    url:baseUrl() + '/chat/completions', headers,
    body:{ model:m, messages:[{ role:'user', content:[
      { type:'text', text:PROMPT },
      { type:'image_url', image_url:{ url:p.rawB64 ? b64 : 'data:image/jpeg;base64,' + b64 } } ] }] },
    read:j => { const c = j?.choices?.[0]?.message?.content; return Array.isArray(c) ? c.map(x => x.text || '').join('') : (c || ''); },
    blocked:j => j?.choices?.[0]?.finish_reason === 'content_filter',
  };
}
async function askAI(b64){
  if(ai.provider === 'custom' && !/^https:\/\//.test(baseUrl())) throw new ScanError('eCors', null, true);
  const req = buildRequest(b64);
  let res;
  try{ res = await fetch(req.url, { method:'POST', headers:req.headers, body:JSON.stringify(req.body) }); }
  catch{ throw new ScanError(navigator.onLine === false ? 'eNet' : 'eCors', null, false, navigator.onLine === false); }
  let body = null; try{ body = await res.json(); }catch{}
  if(!res.ok){
    const msg = JSON.stringify(body?.error ?? body ?? '').toLowerCase();
    if(res.status === 401 || (res.status === 400 && /api.?key|invalid.*key|authentication/.test(msg))) throw new ScanError('eKey', null, true);
    if(res.status === 402 || /insufficient|balance|credit|余额/.test(msg)) throw new ScanError('eCredit', null, true);
    if(res.status === 403) throw new ScanError('eForbid', null, true);
    if(res.status === 404 || /model.*(not.?found|not.?exist|does not exist)|模型不存在/.test(msg)) throw new ScanError('eModel', model(), true);
    if(res.status === 429 || res.status === 529) throw new ScanError('eQuota', null, false, true);
    // 5xx = the provider's own servers are struggling (overloaded/down) — worth an automatic retry
    throw new ScanError('eHttp', res.status, false, res.status >= 500);
  }
  const text = req.read(body);
  if(!text) throw new ScanError(req.blocked(body) ? 'eBlocked' : 'eEmpty');
  try{ return JSON.parse(text); }
  catch{
    const a = text.indexOf('{'), b = text.lastIndexOf('}');
    if(a > -1 && b > a){ try{ return JSON.parse(text.slice(a, b + 1)); }catch{} }
    throw new ScanError('eFormat');
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
  return { id:newId(), store:str(p.store) || null, storeGuessed:!!p.storeGuessed, branch:str(p.branch),
    date:/^\d{4}-\d{2}-\d{2}$/.test(p.date || '') ? p.date : null,
    subtotal:num(p.subtotal), tax:num(p.tax), total:num(p.total), items, createdAt:new Date().toISOString() };
}

const jobs = []; let running = 0, jobSeq = 0; const MAX_RUN = 2, MAX_AUTO_RETRIES = 5;
// Free-tier services rate-limit per minute; a burst of uploads trips that, not a real problem.
// Back off with jitter so retries spread out instead of re-hitting the limit together.
const backoffMs = attempt => Math.min(30000, 1500 * 2 ** (attempt - 1)) + Math.random() * 1000;
function addFiles(files){
  if(!apiKey()){ $('#openSettings').click(); return; }
  for(const f of files) jobs.push({ id:++jobSeq, file:f, url:URL.createObjectURL(f), status:'queued', autoAttempts:0 });
  renderQueue(); pump();
}
$('#camInput').onchange = e => { addFiles([...e.target.files]); e.target.value = ''; };
$('#galInput').onchange = e => { addFiles([...e.target.files]); e.target.value = ''; };

async function run(job){
  job.status = 'working'; job.err = null; renderQueue();
  try{
    let b64;
    try{ b64 = await toJpegBase64(job.file); }catch{ throw new ScanError('eImage'); }
    const rec = clean(await askAI(b64) || {});
    if(!rec.items.length) throw new ScanError('eNoItems');
    receipts.push(rec); saveReceipts();
    job.status = 'done'; job.rec = rec; job.err = null;
  }catch(e){
    const err = e instanceof ScanError ? e : new ScanError('eOther');
    if(err.retryable && !err.fatal && job.autoAttempts < MAX_AUTO_RETRIES){
      job.autoAttempts++; job.status = 'waiting'; job.err = err;
      job.timer = setTimeout(() => { if(job.status === 'waiting'){ job.status = 'queued'; job.err = null; renderQueue(); pump(); } }, backoffMs(job.autoAttempts));
    } else {
      job.status = 'error'; job.err = err;
      if(err.fatal) jobs.forEach(j => { if(j.status === 'queued' || j.status === 'waiting'){ clearTimeout(j.timer); j.status = 'error'; j.err = err; j.pausedBy = true; } });
    }
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
function jobText(j){
  if(j.status === 'queued') return t('queued');
  if(j.status === 'working') return '<span class="spin"></span>' + t('working');
  if(j.status === 'done') return '✓ ' + esc(`${j.rec.store || t('unknownStore')} · ${t('nItems', j.rec.items.length)} · ${money(j.rec.total)}`);
  if(j.status === 'waiting') return '<span class="spin"></span>' + esc(t('autoRetry', j.autoAttempts, MAX_AUTO_RETRIES));
  return esc((j.pausedBy ? t('paused') : '') + t(j.err.key, j.err.arg));
}
function retryJob(j){ clearTimeout(j.timer); j.status = 'queued'; j.err = null; j.pausedBy = false; }
function renderQueue(){
  $('#queue').innerHTML = jobs.map(j => `<li class="job">
    <img src="${j.url}" alt="">
    <div class="st ${j.status === 'error' ? 'err' : j.status === 'done' ? 'done' : j.status === 'waiting' ? 'wait' : ''}">${jobText(j)}</div>
    <div class="acts">${j.status === 'error' ? `<button data-retry="${j.id}">${t('retry')}</button>` : j.status === 'waiting' ? `<button data-retry="${j.id}">${t('retryNow')}</button>` : ''}${j.status === 'done' || j.status === 'error' || j.status === 'waiting' ? `<button data-rm="${j.id}">${t('remove')}</button>` : ''}</div>
  </li>`).join('');
  const errCount = jobs.filter(j => j.status === 'error').length;
  $('#retryAll').hidden = errCount < 2;
  if(errCount >= 2) $('#retryAll').textContent = t('retryAll', errCount);
}
$('#retryAll').onclick = () => { jobs.forEach(j => { if(j.status === 'error') retryJob(j); }); renderQueue(); pump(); };
$('#queue').addEventListener('click', e => {
  const r = e.target.closest('[data-retry]'), m = e.target.closest('[data-rm]');
  if(r){ const j = jobs.find(j => j.id == r.dataset.retry); if(j){ retryJob(j); renderQueue(); pump(); } }
  if(m){ const i = jobs.findIndex(j => j.id == m.dataset.rm); if(i > -1){ clearTimeout(jobs[i].timer); URL.revokeObjectURL(jobs[i].url); jobs.splice(i, 1); renderQueue(); } }
});
window.addEventListener('beforeunload', e => { if(jobs.some(j => j.status === 'queued' || j.status === 'working' || j.status === 'waiting')){ e.preventDefault(); e.returnValue = ''; } });

/* ---------- boot ---------- */
applyText(); setTab(tab); setMode(mode); render();
