
/* Google Apps Script / IFRAME 相容層：明確建立 DOM 參照，避免 id 不自動成為全域變數。 */
window.main = document.getElementById('main');
window.modal = document.getElementById('modal');
window.sheet = document.getElementById('sheet');
function syncDomIdGlobals(){
  document.querySelectorAll('[id]').forEach(function(el){
    try { window[el.id] = el; } catch(e) {}
  });
}
syncDomIdGlobals();
/* Apps Script IFRAME 安全儲存層：某些瀏覽器/第三方 Cookie 設定下 localStorage 可能拋出 SecurityError。
   先安全取得；若不可用，退回記憶體儲存，避免整個 JavaScript 在初始化時中斷。 */
const SAFE_STORAGE = (() => {
  try {
    const s = window.localStorage;
    const test = '__eng_storage_test__';
    s.setItem(test, '1'); s.removeItem(test);
    return s;
  } catch (e) {
    const mem = Object.create(null);
    return {
      getItem: k => Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null,
      setItem: (k,v) => { mem[k] = String(v); },
      removeItem: k => { delete mem[k]; }
    };
  }
})();
const localStorage = SAFE_STORAGE;

const KEY='construction_v2';
let data=JSON.parse(localStorage.getItem(KEY)||'null')||{trades:defaultTrades,projects:[],issues:[],methods:[{category:'水電',name:'3路開關',maker:'神保電器',series:'NK系列',model:'NKW01008PW',price:'約 ¥1,870（税込）',priceNote:'2026/09 參考',note:'3路單聯開關組合例。',url:'https://ec.kirii.co.jp/shop/goods/search.aspx?maker=M1000046'},{category:'水電',name:'片切開關',maker:'Panasonic',series:'コスモシリーズ ワイド21',model:'WT5001',price:'¥280（税抜）',priceNote:'メーカー希望小売価格',note:'基本開關本體，需搭配把手、取付枠、プレート。',url:'https://www2.panasonic.biz/jp/densetsu/haisen/switch_concent/cosmo_wide21/lineup/switch/'},{category:'水電',name:'開關',maker:'Panasonic',series:'アドバンスシリーズ',model:'WTA3021系',price:'¥1,568（税込）起',priceNote:'メーカー頁面掲載例',note:'依顏色與組合不同價格會變動。',url:'https://sumai.panasonic.jp/wiring/switch_concent/series/advnace.html?top_link=sumu164'}]};
if(!data.methods)data.methods=[];
// 資料容錯：只補缺少的容器，不刪除、不重建使用者既有工程資料。
if(!Array.isArray(data.trades))data.trades=[];
if(!Array.isArray(data.projects))data.projects=[];
if(!Array.isArray(data.issues))data.issues=[];
data.trades.forEach(t=>{if(t&&typeof t==='object'&&!Array.isArray(t.items))t.items=[];});
data.projects.forEach(p=>{if(p&&typeof p==='object'&&!Array.isArray(p.steps))p.steps=[];});

// === 照片自動恢復：從 2026-09-07 備份補回現有資料中缺少的照片 ===
const LIBKEY='engineering_library_v1';
let libData=JSON.parse(localStorage.getItem(LIBKEY)||'null');
if(!Array.isArray(libData))libData=[];

function backupData(){
  const payload={version:'construction_backup_v2',exportedAt:new Date().toISOString(),construction:data,quotes:quoteData};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='工程管理_備份_'+new Date().toISOString().slice(0,10)+'.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function restoreData(){
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
  input.onchange=()=>{const f=input.files&&input.files[0];if(!f)return;const r=new FileReader();
    r.onload=()=>{try{const x=JSON.parse(r.result);
      if(x.construction){localStorage.setItem(KEY,JSON.stringify(x.construction));data=x.construction}
      if(x.quotes){localStorage.setItem(QUOTE_KEY,JSON.stringify(x.quotes));quoteData=x.quotes}
      alert('資料已還原，頁面即將重新整理。');location.reload();
    }catch(e){alert('備份檔格式錯誤，原資料沒有變動。')}};
    r.readAsText(f);
  };input.click();
}

function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

function nav(e){document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));if(e && e.nodeType===1 && e.classList)e.classList.add('active')}

function home(e){nav(e);main.innerHTML='<div class="card"><b>資料安全</b><div class="muted" style="margin:6px 0 10px">建議每次大改版前先備份一次。備份包含工程、工種、工法與報價。</div><button class="light" onclick="backupData()">匯出備份</button> <button class="light" onclick="restoreData()">還原備份</button></div><div class="grid"><div class="card stat"><span class="muted">進行中工程</span><b>'+data.projects.length+'</b></div><div class="card stat"><span class="muted">待處理問題</span><b>'+data.issues.length+'</b></div></div><div class="section"><b>我的工程</b><button onclick="newProject()">＋ 新增</button></div>'+cards()}

function cards(){return data.projects.length?data.projects.map(p=>'<div class="card" onclick="openProject('+p.id+')"><span class="tag">'+esc(p.status)+'</span><h3 style="margin-top:7px">'+esc(p.name)+'</h3><div class="muted">'+esc(p.client)+'</div><div style="margin:14px 0 7px" class="bar"><div class="fill" style="width:'+progress(p)+'%"></div></div><div class="muted">'+progress(p)+'%　⚠ '+(p.issueCount||0)+'　☑ '+p.steps.filter(s=>s.done).length+'/'+p.steps.length+'</div></div>').join(''):'<div class="empty">還沒有工程。<br>按右上角＋建立第一個工程。</div>'}

function progress(p){return p.steps.length?Math.round(p.steps.filter(s=>s.done).length/p.steps.length*100):0}

function projects(e){nav(e);main.innerHTML='<div class="section"><div><b>工程</b><div class="muted">工程範例與實際進行中的工程</div></div></div><button type="button" class="card" onclick="window.exampleSchedule()" style="cursor:pointer;width:100%;text-align:left;color:#171717"><span class="tag">工程範例</span><h3 style="margin:9px 0 4px">2022 工程範例</h3><div class="muted">查看原本的施工安排、每週階段重點與工程進度表</div></button><div class="section"><b>我的工程</b><button onclick="newProject()">＋ 新增工程</button></div>'+cards()}

function issues(e){nav(e);main.innerHTML='<div class="section"><b>問題追蹤</b><button onclick="newIssue()">＋ 新增</button></div>'+(data.issues.length?data.issues.map(i=>'<div class="card"><span class="tag">'+esc(i.priority)+'</span> <span class="tag">'+esc(i.status)+'</span><h3 style="margin-top:10px">'+esc(i.title)+'</h3><div class="muted">'+esc(i.project)+' · '+esc(i.date)+'</div><p>'+esc(i.note)+'</p></div>').join(''):'<div class="empty">目前沒有問題紀錄。</div>')}

function openModal(c){window.sheet=document.getElementById('sheet');window.modal=document.getElementById('modal');if(!window.sheet||!window.modal)return;window.sheet.innerHTML=c;syncDomIdGlobals();window.modal.style.display='flex'}function closeModal(){const m=document.getElementById('modal');if(m)m.style.display='none'}
