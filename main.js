// main.js — Sample Designer (FULL fixed version • June 2025)
// ————————————————————————————————————————————————————————————————
// * ① 空配额 → 视为“不限量”   (need())
// * ② 所有 querySelector 带变量的选择器都经 CSS.escape 处理，
//       解决 "Cannot read properties of null" when value contains space / 中文。
// * ③ child / global 配额收集改用 document.querySelector 而非 $(id)。
// * ④ 保留 $() = getElementById 仅用于 id 选择。
// ————————————————————————————————————————————————————————————————

/* ------------------------------------------------------------------
 * 一些小工具
 * ------------------------------------------------------------------ */
const $   = id => document.getElementById(id);
const gb  = (arr, k) => arr.reduce((m, r) => { const v=(r[k]||'').toString().trim(); (m[v]=m[v]||[]).push(r); return m; }, {});
const shf = a => a.sort(() => Math.random() - 0.5);
const pct = str => parseFloat(str) / 100;
const ok  = v => v !== '' && v != null;
const log = txt => $('log').textContent += txt + '\n';

// CSS.escape() polyfill (仅处理常见字符)
const esc = str => (window.CSS && CSS.escape) ? CSS.escape(str) :
  str.replace(/[^a-zA-Z0-9_-]/g, ch => '\\' + ch);

/* ------------------------------------------------------------------
 * 全局状态
 * ------------------------------------------------------------------ */
let rawData=[], headers=[];
let childCols = [];                   // ← 替代单一 childCol
let childPriority = {};               // { colName: prio }
let childBucketMap = {};              // { colName: {orig:alias} }
let uniqueChild = {};                 // { parent → {col → [values]} }
let parentCol='';
let uniqueParent=[];
let bucketEnabled=false;
/* 让 need() 能拿到本轮“目标样本量” */
let TOTAL_SAMPLE = 0;

const globalConstraints = {};  // { col: {useBucket:bool} }


/* ------------------------------------------------------------------
 * Excel 载入
 * ------------------------------------------------------------------ */
$('file').onchange = async e => {
  const f=e.target.files[0]; if(!f) return;
  rawData = XLSX.utils.sheet_to_json(
    XLSX.read(await f.arrayBuffer(),{type:'array'}).Sheets.Sheet1,
    {defval:''});
  headers = Object.keys(rawData[0]);
  buildColumnSelectors();
  buildConstraintArea();
  $('columnSelectors').classList.remove('hidden');
  log(`📄 载入 ${rawData.length} 行`);
};

/* ------------------------------------------------------------------
 * 选择父/子列 → 构建配额 UI
 * ------------------------------------------------------------------ */
function buildColumnSelectors(){
  const p=$('parentSelect'), c=$('childSelect');
  p.innerHTML=c.innerHTML='<option value="">— 选择 / Select —</option>';
  headers.forEach(h=>{
    p.insertAdjacentHTML('beforeend',`<option value="${h}">${h}</option>`);
    c.insertAdjacentHTML('beforeend',`<option value="${h}">${h}</option>`);
  });

  p.onchange=e=>{
    parentCol=e.target.value; childCol='';
    $('childSelect').value='';
    $('childQuotaContainer').innerHTML='';
    if(!parentCol){$('parentQuotaContainer').innerHTML='';return;}
    const byPar=gb(rawData,parentCol);
    uniqueParent=Object.keys(byPar);
    buildParentQuotaUI(byPar);
  };

  c.onchange = e => {
  childCols = [...e.target.selectedOptions].map(o => o.value);
  $('childQuotaContainer').innerHTML = '';
  if (childCols.length) buildChildQuotaUI();
  $('run').classList.remove('hidden');
};
}

/* ------------------------------------------------------------------
 * 父层配额 UI
 * ------------------------------------------------------------------ */
function buildParentQuotaUI(byPar){
  const box=$('parentQuotaContainer');
  box.innerHTML=`<div class="mb-2 flex items-center gap-3"><h2 class="font-semibold">父层配额 / Parent quotas</h2><label class="flex items-center gap-1 text-sm"><input id="chkBucket" type="checkbox" class="accent-blue-600">启用 Bucket</label></div><table class="w-full text-sm border"><thead class="bg-gray-100"><tr><th class="border px-2 py-1">值 / Value</th><th class="border px-2 py-1">可用</th><th class="border px-2 py-1 bucket-col hidden">Bucket</th><th class="border px-2 py-1">数量 / Count</th><th class="border px-2 py-1">比例 / Ratio</th></tr></thead><tbody id="parentRows"></tbody></table>`;
  const tb=$('parentRows');
  uniqueParent.forEach(v=>{
    tb.insertAdjacentHTML('beforeend',`<tr><td class="border px-2 py-1">${v}</td><td class="border px-2 py-1 text-right text-gray-500">≤ ${byPar[v].length}</td><td class="border px-2 py-1 bucket-col hidden"><input data-pbucket="${v}" value="${v}" class="w-24 border rounded p-1"></td><td class="border px-2 py-1"><input data-pcount="${v}" type="number" class="w-20 border rounded p-1"></td><td class="border px-2 py-1"><input data-pratio="${v}" class="w-24 border rounded p-1" placeholder="50%"></td></tr>`);
  });
  $('chkBucket').onchange=e=>{
    bucketEnabled=e.target.checked;
    document.querySelectorAll('.bucket-col').forEach(td=>td.classList.toggle('hidden',!bucketEnabled));
  };
  $('run').classList.remove('hidden');
}

/* ------------------------------------------------------------------
 * 子层配额 UI
 * ------------------------------------------------------------------ */
function safeId(s) {
  const bytes = new TextEncoder().encode(s);          // Uint8Array
  let bin = '';
  bytes.forEach(b => bin += String.fromCharCode(b));  // 转二进制字符串
  return 'tbl_' + btoa(bin).replace(/=/g, '');
}


function buildChildQuotaUI() {
  const byPar = gb(rawData, parentCol);
  const box   = $('childQuotaContainer');
  box.innerHTML = '<h2 class="font-semibold mb-2">子层配额 / Child quotas</h2>';
  uniqueChild = {};

  // 每一个子列独立生成面板
  childCols.forEach((col, idx) => {
    const cid = safeId('col_' + col);
    // Priority 下拉：默认按选择顺序 1,2,3…
    const prioOpt = childCols.map((_,i)=>`<option value="${i+1}" ${i===idx?'selected':''}>${i+1}</option>`).join('');

    box.insertAdjacentHTML('beforeend', `
      <details open class="mb-4 border rounded">
        <summary class="cursor-pointer py-1 px-2 bg-gray-100 flex justify-between items-center">
          <span>${col}</span>
          <span class="text-sm flex items-center gap-1">
            Priority
            <select data-cprio="${col}" class="border rounded px-1 py-0.5 text-sm">${prioOpt}</select>
            <label class="flex items-center gap-1">
              <input type="checkbox" data-cbucket-toggle="${col}" class="accent-blue-600">
              Bucket
            </label>
          </span>
        </summary>
        <div id="${cid}" class="mt-2"></div>
      </details>`);

    // 为每个父值生成表格
    const wrap = $(cid);
    uniqueParent.forEach(pv => {
      const ch = [...new Set(byPar[pv].map(r => r[col]))];
      (uniqueChild[pv] ||= {})[col] = ch;

      const tid = safeId(`${pv}_${col}`);
      wrap.insertAdjacentHTML('beforeend', `
        <div class="mb-3">
          <h4 class="font-semibold text-sm mb-1">${parentCol}: ${pv}</h4>
          <table class="w-full text-sm border">
            <thead class="bg-gray-50">
              <tr><th class="border px-2 py-1">${col}</th><th class="border px-2 py-1">≤可用</th>
                  <th class="border px-2 py-1">数量</th><th class="border px-2 py-1">比例</th></tr>
            </thead>
            <tbody id="${tid}"></tbody>
          </table>
        </div>`);

      const tb = $(tid);
      ch.forEach(v => {
        tb.insertAdjacentHTML('beforeend', `
          <tr>
            <td class="border px-2 py-1">${v}</td>
            <td class="border px-2 py-1 text-gray-500 text-right">≤ ${byPar[pv].filter(r=>r[col]===v).length}</td>
            <td class="border px-2 py-1"><input data-ccount="${col}::${pv}::${v}" type="number" class="w-20 border rounded p-1"></td>
            <td class="border px-2 py-1"><input data-cratio="${col}::${pv}::${v}"  class="w-24 border rounded p-1"></td>
          </tr>`);
      });
    });

    // 保存 priority
    card = box.lastElementChild;               // 刚加的 <details>
    card.querySelector(`[data-cprio="${col}"]`).onchange = e => {
      childPriority[col] = +e.target.value;
    };

    // Bucket 开关
    card.querySelector(`[data-cbucket-toggle="${col}"]`).onchange = e => {
      const on = e.target.checked;
      // 简化做法：直接提示“列级 Bucket 先留空”；如需真映射再补 UI
      if (on) alert('TODO: 为子列映射 Bucket 的 UI');
    };

    // 默认优先级
    childPriority[col] = idx + 1;
  });
}


/* ------------------------------------------------------------------
 * 并列约束 UI
 * ------------------------------------------------------------------ */
function buildConstraintArea(){
  if($('constraintArea')) return;
  const div=document.createElement('div');
  div.id='constraintArea'; div.className='w-full max-w-4xl mb-8';
  div.innerHTML='<h2 class="font-semibold mb-2">并列约束 / Global constraints</h2><div id="constraintCards" class="space-y-4"></div><div class="mt-2"><select id="selAdd" class="border rounded p-2 mr-2"></select><button id="btnAdd" class="bg-gray-200 rounded px-3 py-1">添加约束 / Add</button></div>';
  $('childQuotaContainer').insertAdjacentElement('afterend',div);
  const sel=$('selAdd'); sel.innerHTML='<option value="">— 选择列 / Column —</option>';
  headers.forEach(h=>sel.insertAdjacentHTML('beforeend',`<option value="${h}">${h}</option>`));
  $('btnAdd').onclick=()=>{const col=sel.value;if(!col||globalConstraints[col])return;buildConstraintCard(col);globalConstraints[col]={useBucket:false};};
}
function buildConstraintCard(col){
  const totalCards = Object.keys(globalConstraints).length + 1;
  let optHTML = '';
  for (let i = 1; i <= totalCards; i++) {
    optHTML += `<option value="${i}" ${i===totalCards? 'selected':''}>${i}</option>`;
  }
  const card=document.createElement('div'); card.className='border rounded p-3 bg-white shadow';
  const uid=`body_${col.replace(/\W/g,'_')}`;
  card.innerHTML=`<div class="flex justify-between items-center mb-2"><h3 class="font-medium">${col}</h3><div class="flex items-center gap-3"><label class="flex items-center text-sm gap-1"><input type="checkbox" data-gbucket-toggle="${col}" class="accent-blue-600">启用 Bucket</label><button class="text-sm text-red-600 hover:underline" onclick="this.closest('.shadow').remove(); delete globalConstraints['${col}'];">删除 / Remove</button></div></div><table class="w-full text-sm border"><thead class="bg-gray-50"><tr><th class="border px-2 py-1">值 / Value</th><th class="border px-2 py-1">可用</th><th class="border px-2 py-1 bucket-col hidden">Bucket</th><th class="border px-2 py-1">数量</th><th class="border px-2 py-1">比例</th></tr></thead><tbody id="${uid}"></tbody></table><label class="text-sm flex items-center gap-1">Priority<select data-gprio="${col}"
            class="border rounded px-1 py-0.5 text-sm">${optHTML}</select></label>`;
  $('constraintCards').appendChild(card);
  const body=$(uid), byCol=gb(rawData,col);
  Object.keys(byCol).forEach(v=>{
    body.insertAdjacentHTML('beforeend',`<tr><td class="border px-2 py-1">${v}</td><td class="border px-2 py-1 text-right text-gray-500">≤ ${byCol[v].length}</td><td class="border px-2 py-1 bucket-col hidden"><input data-gbucket="${col}::${v}" class="w-24 border rounded p-1" value="${v}"></td><td class="border px-2 py-1"><input data-gcount="${col}::${v}" type="number" class="w-20 border rounded p-1"></td><td class="border px-2 py-1"><input data-gratio="${col}::${v}" class="w-24 border rounded p-1"></td></tr>`);
  });
  card.querySelector(`[data-gbucket-toggle="${col}"]`).onchange=e=>{const show=e.target.checked;card.querySelectorAll('.bucket-col').forEach(td=>td.classList.toggle('hidden',!show));globalConstraints[col].useBucket=show;};
}

/* ------------------------------------------------------------------
 * need() — 空配额 = 不限量
 * ------------------------------------------------------------------ */
function need(obj = {}, avail){
  return ok(obj.count)
       ? Math.min(+obj.count, avail)
       : (ok(obj.ratio) && obj.ratio.endsWith('%'))
       ? Math.floor(pct(obj.ratio) * (TOTAL_SAMPLE || avail))   // ← 关键改这里
       : avail;
}

/* ------------------------------------------------------------------
 * 点击生成样本
 * ------------------------------------------------------------------ */
  /* ---------- 计算本轮样本总量 (TOTAL_SAMPLE) ---------- */
  TOTAL_SAMPLE = uniqueParent.reduce((sum, pv) => {
    // 父层想要多少行
    const pvBucket = bucketEnabled ? (bucketMap[parentCol]?.[pv] || pv) : pv;
    const poolRows = rawData.filter(r => r[parentCol] === pv).length;
    return sum + need(pQ[pvBucket], poolRows);
  }, 0);
  // console.log('TOTAL_SAMPLE =', TOTAL_SAMPLE); // 调试用

$('run').onclick = () => {
  const pQ={}, gQ={},bucketMap={};

  /* ---------- 父层配额 ---------- */
  uniqueParent.forEach(v=>{
    const cntInp=document.querySelector(`[data-pcount="${esc(v)}"]`);
    const ratInp=document.querySelector(`[data-pratio="${esc(v)}"]`);
    const bucketInp=bucketEnabled?document.querySelector(`[data-pbucket="${esc(v)}"]`):null;
    const bucket=bucketEnabled?(bucketInp?.value.trim()||v):v;
    pQ[bucket]={count:cntInp?cntInp.value.trim():'',ratio:ratInp?ratInp.value.trim():''};
    if(bucketEnabled){(bucketMap[parentCol] ||= {})[v]=bucket;}
  });
  const cQ = collectChildQuotas();
  /* ---------- 子层配额 ---------- 
  document.querySelectorAll('[data-ccount]').forEach(inp=>{
    const key=inp.dataset.ccount;
    const ratioInp=document.querySelector(`[data-cratio="${esc(key)}"]`);
    cQ[key]={count:inp.value.trim(), ratio:ratioInp?ratioInp.value.trim():''};
  });*/

  /* ---------- 并列配额 ---------- */
  document.querySelectorAll('[data-gcount]').forEach(inp=>{
    const key=inp.dataset.gcount;
    const ratioInp=document.querySelector(`[data-gratio="${esc(key)}"]`);
    gQ[key]={count:inp.value.trim(), ratio:ratioInp?ratioInp.value.trim():''};
  });
  Object.keys(gQ).forEach(k=>{const {count,ratio}=gQ[k]; if(!ok(count)&&!ok(ratio)) delete gQ[k];});

  /* ---------- 并列 Bucket ---------- */
  const gBucketMap={};
  Object.keys(globalConstraints).forEach(col=>{
    if(!globalConstraints[col].useBucket) return;
    const map={};
    document.querySelectorAll(`[data-gbucket^="${esc(col)}::"]`).forEach(inp=>{
      const [,v]=inp.dataset.gbucket.split('::');
      map[v]=inp.value.trim()||v;
    });
    gBucketMap[col]=map;
  });

  /* ---------- 应用 Bucket 到数据行 ---------- */
  const data = rawData.map(r=>{
    const t={...r};
    if(bucketEnabled && bucketMap[parentCol] && bucketMap[parentCol][t[parentCol]]) t[parentCol]=bucketMap[parentCol][t[parentCol]];
    for(const col in gBucketMap){const orig=t[col]; if(gBucketMap[col][orig]) t[col]=gBucketMap[col][orig];}
    return t;
  });
/* ------------------------------------------------------------------
 * collectChildQuotas — 读取多子列配额
 * 返回形如 { "列::父::值": {count:"", ratio:""} }
 * ------------------------------------------------------------------ */
function collectChildQuotas() {
  const out = {};
  document.querySelectorAll('[data-ccount]').forEach(inp => {
    const key = inp.dataset.ccount;                       // col::parent::value
    const ratioInp = document.querySelector(
      `[data-cratio="${esc(key)}"]`);
    out[key] = {
      count : inp.value.trim(),
      ratio : ratioInp ? ratioInp.value.trim() : ''
    };
    if (!ok(out[key].count) && !ok(out[key].ratio)) {
      delete out[key];                 // ★ 新增
    }
  });
  return out;
}

  /* ---------- 抽样 & 导出 ---------- */
  const sampled = runSampling(data, pQ, cQ, gQ, bucketMap);
  exportFile(sampled);
};

/* ------------------------------------------------------------------
 * runSampling — 带 revMap 反查
 * ------------------------------------------------------------------ */
function runSampling(data, pQ, cQ, gQ, bucketMap){
  const byPar=gb(data,parentCol);
  const mappedParent=bucketEnabled?uniqueParent.map(v=>bucketMap[parentCol]?.[v]||v):uniqueParent;
  const revMap=bucketEnabled?Object.fromEntries(Object.entries(bucketMap[parentCol]||{}).map(([o,a])=>[a,o])):{};
  const out=[];
  mappedParent.forEach(pv => {
    let pool = shf(byPar[pv] || byPar[revMap[pv]] || []);
    let left = need(pQ[pv], pool.length);

    // ① 先按子列优先级排序
    const colsByPrio = [...childCols].sort((a,b)=>childPriority[a]-childPriority[b]);

    colsByPrio.forEach(col => {
      if (left <= 0) return;
      const byVal = gb(pool, col);
      (uniqueChild[pv][col] || []).forEach(v => {
        if (left <= 0) return;
        const key = `${col}::${pv}::${v}`;
        const want = need(cQ[key], (byVal[v] || []).length); // ① 想要多少
        const take = Math.min(want, left);                   // ② 最多不能超过 left
        out.push(...(byVal[v]||[]).slice(0, take));
        left -= take;
      });
      // 把抽掉的行从 pool 删掉
      pool = pool.filter(r => !out.includes(r));
    });

    if (left > 0) out.push(...pool.slice(0, left));   // 父层补齐
});


  /* ---------- 并列配额检查 & 解释 ---------- */
  const lack = [], surplus = [];   // ← 新增一张 surplus 表
  Object.keys(gQ).forEach(k => {
    const [col, val] = k.split('::');
    const want = need(gQ[k], data.filter(r => r[col] === val).length);
    const got  = out.filter(r => r[col] === val).length;

    if (want > got) lack.push({ col, val, want, got });
    if (got  > want) surplus.push({ col, val, extra: got - want });  // 统计多拿的行
  });

  if (lack.length) {
    // ➊ 拼一句“让渡给谁”的解释
    const explain = lack.map(l => {
      // 找到哪个值多拿并且同一列
      const donor = surplus.find(s => s.col === l.col && s.extra > 0);
      if (donor) {
        return `${l.col}=${l.val} 欠 ${l.want - l.got} (已被 ${donor.val} 占用 ${donor.extra})`;
      }
      return `${l.col}=${l.val} 欠 ${l.want - l.got}`;
    }).join(' | ');

    log('⚠️ 并列配额不足: ' + explain);   // 控制台可见
    alert('并列配额不足！\n' + explain);   // 弹窗
  } else {
    log('✅ 并列配额全部满足');
  }

  log(`✅ 抽样 ${out.length} rows`);
  return out;
}

/* ------------------------------------------------------------------
 * 导出 Excel
 * ------------------------------------------------------------------ */
function exportFile(rows){
  if(!rows.length){alert('未抽到样本');return;}
  const ws=XLSX.utils.json_to_sheet(rows);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Sample');
  const buf=XLSX.write(wb,{type:'array',bookType:'xlsx'});
  $('download').classList.remove('hidden');
  $('download').onclick=()=>saveAs(new Blob([buf],{type:'application/octet-stream'}),'sample_result.xlsx');
}
