
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
function saveLib(){localStorage.setItem(LIBKEY,JSON.stringify(libData))}
function libraryGroups(){
  // Google Drive 照片搬移入口會在工程庫頁面使用既有樣式，不改原本版面結構。

  const groups=[];
  (data.trades||[]).forEach((t,ti)=>groups.push({name:t.name,items:t.items||[],source:'2022',ti,customIndex:-1}));
  (libData||[]).forEach((t,ci)=>{
    let g=groups.find(x=>x.source==='2022'&&x.name===t.name);
    if(!g){g={name:t.name,items:[],source:'custom',ti:-1,customIndex:ci};groups.push(g);}
    (t.items||[]).forEach(it=>{
      const exists=g.items.some(x=>x[0]===it[0]);
      if(!exists)g.items.push(it);
    });
  });
  return groups;
}
function libraryItemSource(tradeName,itemName){
  const ti=(data.trades||[]).findIndex(t=>t.name===tradeName);
  if(ti>=0 && (data.trades[ti].items||[]).some(it=>it[0]===itemName))return {source:'2022',ti,j:data.trades[ti].items.findIndex(it=>it[0]===itemName)};
  const ci=(libData||[]).findIndex(t=>t.name===tradeName);
  if(ci>=0)return {source:'custom',ti:-1,customIndex:ci,j:libData[ci].items.findIndex(it=>it[0]===itemName)};
  return null;
}
// 2022 工程範例的「下一步」以工程進度表的實際順序為準。
// 先依開始日期排序；同一天則保留原本工程進度表的排列順序。
function progressTableItems(){
  return scheduleItems().map((x,i)=>({...x,_order:i})).sort((a,b)=>{
    const ad=a.start||'9999-99-99',bd=b.start||'9999-99-99';
    return ad.localeCompare(bd)||a._order-b._order;
  });
}
function progressNextFor2022(ti,j){
  const list=progressTableItems();
  const idx=list.findIndex(x=>x.ti===ti&&x.j===j);
  if(idx<0||idx>=list.length-1)return '';
  return list[idx+1].name;
}
function libraryNextLabel(source,ti,j,itemNext){
  if(source==='2022') return progressNextFor2022(ti,j)||'後續未設定';
  return itemNext||'未設定';
}
function library(e){
  nav(e);
  const groups=libraryGroups();
  main.innerHTML=`<div class="section"><div><b>工種庫</b><div class="muted">施工知識母庫：工種是第一層，施工項目是第二層。</div></div><button onclick="newLibraryTrade()">＋ 新增工種</button></div>
    <div class="hint">2022 工程範例中的工種會直接連到這裡；新增的工種只存在工種庫，不會改動 2022 案例。</div>
    ${groups.length?groups.map((t,i)=>{
      const onclick=`libraryTradeDetail('${esc(t.name).replace(/'/g,"\\'")}','${esc(t.source)}',${t.source==='2022'?t.ti:-1},${t.source==='custom'?t.customIndex:-1})`;
      return `<div class="card library-trade-card" style="cursor:pointer" onclick="${onclick}">
        <div class="library-trade-head"><div><span class="tag">${t.source==='2022'?'2022 工程範例':'工種庫新增'}</span><h2 class="library-home-trade-title">${esc(t.name)}</h2><div class="muted">工種｜${t.items.length} 個施工項目</div></div>${t.source==='custom'?`<button class="light" onclick="event.stopPropagation();editLibraryTrade(${t.customIndex})">編輯</button>`:'<span class="muted">來源連動</span>'}</div>
        <div class="library-child-summary">${t.items.length?t.items.map((it,j)=>`<span><b>${j+1}</b> ${esc(it[0])}</span>`).join(''):'<span class="muted">尚未設定施工項目</span>'}</div>
        <div class="library-enter">查看工種注意事項與施工項目　→</div>
      </div>`;
    }).join(''):'<div class="empty">尚未建立工種</div>'}`;
}

function libraryTradeDetail(tradeName,source,ti,customIndex){
  let t=null,notes=[];
  if(source==='2022' && data.trades[ti]){ t=data.trades[ti]; notes=Array.isArray(t.notes)?t.notes:[]; }
  else if(source==='custom' && libData[customIndex]){ t=libData[customIndex]; notes=Array.isArray(t.notes)?t.notes:[]; }
  if(!t)return library();
  const items=t.items||[], index=source==='2022'?ti:customIndex;
  main.innerHTML=`<button class="back" onclick="library()">← 返回工種庫</button>
    <div class="card"><span class="tag">${source==='2022'?'2022 工程範例':'工種庫新增'}</span><h2 class="library-trade-title">${esc(t.name)}</h2><div class="muted">工種｜${items.length} 個施工項目</div></div>
    <div class="section"><b>工種注意事項</b><button class="light" onclick="addLibraryTradeNote('${esc(source)}',${index})">＋ 新增</button></div>
    <div class="card">${notes.length?notes.map((n,i)=>`<div class="row"><div style="flex:1">□ ${esc(n)}</div><button class="orderbtn" onclick="editLibraryTradeNote('${esc(source)}',${index},${i})">編輯</button><span class="danger" onclick="removeLibraryTradeNote('${esc(source)}',${index},${i})">×</span></div>`).join(''):'<div class="empty">尚未設定工種注意事項</div>'}</div>
    <div class="section"><b>照片參考</b><button class="light" onclick="addLibraryTradePhoto('${esc(source)}',${index})">＋ 新增照片</button></div>
    <div class="card library-photo-card">${libraryTradePhotosHTML(source,index,t)}</div>
    <div class="section"><b>施工項目</b><span class="muted">次項目</span></div>
    <div class="card library-subitems">${items.length?items.map((it,j)=>`<div class="row library-subitem" style="cursor:pointer" onclick="libraryDetailBySource('${esc(source)}',${index},${j})"><span class="sub-index">${j+1}</span><div style="flex:1"><b>${esc(it[0])}</b><div class="muted">${(it[1]||[]).length} 項注意事項　｜　下一步：${esc(source==='2022'?progressNextFor2022(ti,j):(it[2]||'未設定'))}</div></div><span>→</span></div>`).join(''):'<div class="empty">尚未設定施工項目</div>'}</div>
    <div class="hint">「${esc(t.name)}」是工種；${items.map(it=>'「'+esc(it[0])+'」').join('、')} 是這個工種底下的施工次項目。工種本身可以另外記錄整體注意事項。</div>`;
}
function libraryDetailBySource(source,index,j){
  if(source==='2022')return exampleLibraryItemDetail(index,j);
  return libraryDetail(index,j);
}
function libraryTradePhotosHTML(source,index,t){
  const photos=Array.isArray(t.photos)?t.photos:[];
  if(!photos.length)return '<div class="empty">尚未建立照片參考。<br><span class="muted">可以放施工標準、細部做法或現場參考照片。</span></div>';
  return `<div class="library-photo-grid">${photos.map((p,i)=>`
    <div class="library-photo">
      <img src="${esc(p.data)}" alt="${esc(p.title||'照片參考')}">
      <div class="library-photo-info">
        <div class="library-photo-title">${esc(p.title||'照片參考')}</div>
        ${p.note?`<div class="library-photo-meta">${esc(p.note)}</div>`:''}
        <div class="library-photo-meta">${esc(p.date||'')}</div>
        <div class="library-photo-actions">
          <button class="light" onclick="editLibraryTradePhoto('${esc(source)}',${index},${i})">編輯</button>
          <button class="library-photo-delete" onclick="removeLibraryTradePhoto('${esc(source)}',${index},${i})">刪除</button>
        </div>
      </div>
    </div>`).join('')}</div>`;
}

/* ===== Google Drive 照片雲端版 =====
   此頁面以 Google Apps Script HtmlService 開啟時，會使用 google.script.run
   將照片直接上傳到 Google Drive。離線直接開啟 HTML 時則保留原本功能。
*/
const CLOUD_PHOTO_FOLDER = '工程管理照片';

function cloudReady(){
  return typeof google !== 'undefined' && google.script && google.script.run;
}
function cloudCall(method, args, ok, fail){
  if(!cloudReady()){ fail && fail(new Error('此 HTML 尚未透過 Google Apps Script 開啟')); return; }
  let runner = google.script.run
    .withSuccessHandler(ok || function(){})
    .withFailureHandler(fail || function(e){ console.error(e); alert('雲端操作失敗：'+(e.message||e)); });
  runner[method].apply(runner, args || []);
}
function uploadPhotoToDrive(file, tradeName, title, note, done){
  const r = new FileReader();
  r.onload = function(){
    cloudCall('uploadPhoto', [r.result, file.name, tradeName || '未分類', title || '', note || ''],
      function(result){ done(null, result); },
      function(err){ done(err); });
  };
  r.onerror = function(){ done(r.error || new Error('讀取照片失敗')); };
  r.readAsDataURL(file);
}
function migrateExistingPhotosToDrive(){
  if(!cloudReady()){
    alert('請先把 Index.html 部署成 Google Apps Script 網頁應用程式，再使用這個功能。');
    return;
  }
  const all = [];
  (data.trades||[]).forEach((t,ti)=>(t.photos||[]).forEach((p,pi)=>all.push({source:'2022',ti,pi,t,p})));
  (libData||[]).forEach((t,ti)=>(t.photos||[]).forEach((p,pi)=>all.push({source:'lib',ti,pi,t,p})));
  const pending = all.filter(x => x.p && x.p.data && x.p.data.indexOf('data:image/')===0);
  if(!pending.length){
    alert('沒有需要搬到 Google Drive 的本機 Base64 照片。');
    return;
  }
  if(!confirm(`找到 ${pending.length} 張本機照片。\n\n會逐張上傳到 Google Drive，完成後系統只保留雲端照片網址。\n\n確定開始？`)) return;

  let i=0, ok=0, fail=0;
  const next=()=>{
    if(i>=pending.length){
      save(); saveLib();
      alert(`照片搬移完成！\n成功：${ok} 張\n失敗：${fail} 張`);
      return;
    }
    const x=pending[i++];
    // 顯示簡單進度
    try{
      const title=x.p.title||'照片參考';
      const note=x.p.note||'';
      const blobData=x.p.data;
      cloudCall('uploadPhotoDataUrl',[blobData, `${x.p.id||Date.now()}_${title}.jpg`, x.t.name||'未分類', title, note],
        function(result){
          if(result && result.url){
            x.p.data=result.url;
            x.p.driveId=result.id||'';
            x.p.storage='google-drive';
            ok++;
          }else fail++;
          if(x.source==='2022') save(); else saveLib();
          next();
        },
        function(){ fail++; next(); }
      );
    }catch(e){ fail++; next(); }
  };
  next();
}

function cloudPhotoDeleteIfNeeded(p, after){
  if(!p || !p.driveId || !cloudReady()){ after&&after(); return; }
  cloudCall('deletePhoto',[p.driveId],function(){after&&after();},function(){after&&after();});
}


function addLibraryTradePhoto(source,index){
  const t=source==='2022'?data.trades[index]:libData[index];
  if(!t)return;
  openModal(`<h2>新增照片參考</h2><div class="hint">雲端版會直接存到 Google Drive；若是舊照片，可在工程庫頁面使用「搬移舊照片到雲端」。</div><div class="hint">建議放「標準做法、細部節點、施工完成樣式」等照片。圖片會縮小後儲存在這個工程管理系統裡。</div><label>照片</label><input id="ltphoto" type="file" accept="image/*" multiple><label>照片標題</label><input id="ltphotoTitle" placeholder="例如：排水管施工完成範例"><label>說明</label><textarea id="ltphotoNote" placeholder="例如：管根需加強防水，完成後確認坡度"></textarea><div id="ltphotoPreview" class="muted">尚未選擇照片</div><div class="actions"><button class="light" onclick="closeModal()">取消</button><button onclick="saveLibraryTradePhotos('${esc(source)}',${index})">加入照片</button></div>`);
  document.getElementById('ltphoto').addEventListener('change',function(){document.getElementById('ltphotoPreview').textContent=this.files.length+' 張照片已選擇';});
}
async function resizeLibraryPhoto(file,maxSize=1200,quality=.78){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>{const img=new Image();img.onload=()=>{let w=img.naturalWidth,h=img.naturalHeight;const scale=Math.min(1,maxSize/Math.max(w,h));w=Math.round(w*scale);h=Math.round(h*scale);const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.drawImage(img,0,0,w,h);resolve(c.toDataURL('image/jpeg',quality));};img.onerror=reject;img.src=r.result;};
    r.onerror=reject;r.readAsDataURL(file);
  });
}
async function saveLibraryTradePhotos(source,index){
  const t=source==='2022'?data.trades[index]:libData[index];
  const input=document.getElementById('ltphoto');
  if(!t||!input||!input.files.length){alert('請先選擇照片');return;}
  const title=(document.getElementById('ltphotoTitle')?.value||'照片參考').trim();
  const note=(document.getElementById('ltphotoNote')?.value||'').trim();
  if(!Array.isArray(t.photos))t.photos=[];
  const files=Array.from(input.files);

  try{
    // Google Apps Script 版本：照片直接進 Google Drive。
    if(cloudReady()){
      let done=0;
      for(const file of files){
        await new Promise((resolve,reject)=>{
          uploadPhotoToDrive(file,t.name,title||(file.name||'照片參考'),note,(err,result)=>{
            if(err){reject(err);return;}
            t.photos.push({
              id:Date.now()+'_'+Math.random().toString(36).slice(2,7),
              data:result.url,
              driveId:result.id||'',
              storage:'google-drive',
              title:title||(file.name||'照片參考'),
              note,
              date:new Date().toLocaleDateString('zh-TW')
            });
            done++;
            resolve();
          });
        });
      }
    }else{
      // 直接開本機 HTML 時保留原本離線模式。
      for(const file of files){
        t.photos.push({
          id:Date.now()+'_'+Math.random().toString(36).slice(2,7),
          data:await resizeLibraryPhoto(file),
          title:title||(file.name||'照片參考'),
          note,
          date:new Date().toLocaleDateString('zh-TW')
        });
      }
    }
    source==='2022'?save():saveLib();
    closeModal();libraryTradeDetail(t.name,source,index,index);
  }catch(e){
    alert('照片上傳失敗：'+(e.message||'請稍後再試。'));
  }
}
function editLibraryTradePhoto(source,index,i){
  const t=source==='2022'?data.trades[index]:libData[index],p=t?.photos?.[i];if(!p)return;
  openModal(`<h2>編輯照片參考</h2><img src="${esc(p.data)}" style="width:100%;max-height:220px;object-fit:contain;background:#f5f5f3;border-radius:12px"><label>照片標題</label><input id="ltphotoTitleEdit" value="${esc(p.title||'照片參考')}"><label>說明</label><textarea id="ltphotoNoteEdit">${esc(p.note||'')}</textarea><div class="actions"><button class="light" onclick="closeModal()">取消</button><button onclick="saveLibraryTradePhotoEdit('${esc(source)}',${index},${i})">儲存</button></div>`);
}
function saveLibraryTradePhotoEdit(source,index,i){
  const t=source==='2022'?data.trades[index]:libData[index],p=t?.photos?.[i];if(!p)return;
  p.title=document.getElementById('ltphotoTitleEdit').value.trim()||'照片參考';p.note=document.getElementById('ltphotoNoteEdit').value.trim();
  source==='2022'?save():saveLib();closeModal();libraryTradeDetail(t.name,source,index,index);
}
function removeLibraryTradePhoto(source,index,i){
  const t=source==='2022'?data.trades[index]:libData[index], p=t?.photos?.[i];if(!p)return;
  if(!confirm('刪除這張照片參考？'))return;
  const finish=()=>{
    t.photos.splice(i,1);
    source==='2022'?save():saveLib();
    libraryTradeDetail(t.name,source,index,index);
  };
  cloudPhotoDeleteIfNeeded(p,finish);
}
function addLibraryTradeNote(source,index){
  const t=source==='2022'?data.trades[index]:libData[index];
  if(!t)return;
  const n=prompt('新增工種注意事項');
  if(n&&n.trim()){if(!Array.isArray(t.notes))t.notes=[];t.notes.push(n.trim());source==='2022'?save():saveLib();closeModal();libraryTradeDetail(t.name,source,index,index);}
}
function editLibraryTradeNote(source,index,k){
  const t=source==='2022'?data.trades[index]:libData[index],a=Array.isArray(t&&t.notes)?t.notes:[];
  if(!a[k])return;
  const n=prompt('修改工種注意事項',a[k]);
  if(n!==null&&n.trim()){a[k]=n.trim();source==='2022'?save():saveLib();libraryTradeDetail(t.name,source,index,index);}
}
function removeLibraryTradeNote(source,index,k){
  const t=source==='2022'?data.trades[index]:libData[index];
  if(!t||!Array.isArray(t.notes))return;
  if(!confirm('刪除此工種注意事項？'))return;
  t.notes.splice(k,1);source==='2022'?save():saveLib();libraryTradeDetail(t.name,source,index,index);
}
function libraryDetailByName(tradeName,itemName){
  const src=libraryItemSource(tradeName,itemName);
  if(!src)return library();
  if(src.source==='2022')return exampleLibraryItemDetail(src.ti,src.j);
  return libraryDetail(src.customIndex,src.j);
}
function libraryDetail(ti,j){
  const t=libData[ti],it=t&&t.items[j]; if(!t||!it)return library();
  main.innerHTML='<button class="back" onclick="library()">← 返回工種庫</button>'+
    '<div class="card"><span class="tag">'+esc(t.name)+'</span><h2 style="margin:9px 0 5px">'+esc(it[0])+'</h2><div class="muted">施工知識標準內容</div></div>'+
    '<div class="section"><b>前置條件／注意事項</b><button class="light" onclick="editLibraryItem('+ti+','+j+')">編輯</button></div>'+
    '<div class="card">'+((it[1]||[]).length?(it[1]||[]).map(x=>'<div class="row"><div style="flex:1">□ '+esc(x)+'</div></div>').join(''):'<div class="empty">尚未設定</div>')+'</div>'+
    '<div class="section"><b>下一個工程銜接</b></div><div class="card">'+(it[2]?'<b>→ '+esc(it[2])+'</b>':'<div class="muted">尚未設定</div>')+'</div>'+
    '<div class="hint">這是工種庫母資料。套用到工程後，工程可以自行修改，不會反過來改變這裡。</div>';
}
function newLibraryTrade(){openModal('<h2>新增工種</h2><label>工種名稱</label><input id="ltn" placeholder="例如：拆除工程"><label>第一個施工項目</label><input id="lti" placeholder="例如：現場保護／拆除前確認"><label>注意事項（每行一項）</label><textarea id="ltno"></textarea><label>下一步</label><input id="ltnx" placeholder="例如：清運完成後進入水電放樣"><div class="actions"><button class="light" onclick="closeModal()">取消</button><button onclick="saveLibraryTrade()">建立</button></div>')}
function saveLibraryTrade(){const name=ltn.value.trim(),item=lti.value.trim();if(!name||!item){alert('請填寫工種名稱與第一個施工項目');return;}libData.push({name,items:[[item,ltno.value.split('\n').map(x=>x.trim()).filter(Boolean),ltnx.value.trim()]]});saveLib();closeModal();library()}
function editLibraryTrade(i){const t=libData[i];openModal('<h2>編輯 '+esc(t.name)+'</h2><label>工種名稱</label><input id="len" value="'+esc(t.name)+'"><div class="hint">施工順序由上到下。每個施工項目都可以獨立修改。</div>'+t.items.map((it,j)=>'<div class="card" style="padding:12px"><b>'+esc(it[0])+'</b><div class="muted" style="margin:6px 0 10px">下一步 → '+esc(it[2]||'未設定')+'</div><button class="editbtn" onclick="editLibraryItem('+i+','+j+')">編輯內容</button> <span class="danger" onclick="removeLibraryItem('+i+','+j+')">刪除</span></div>').join('')+'<button class="light" onclick="addLibraryItem('+i+')">＋ 新增施工項目</button><div class="actions" style="margin-top:12px"><button class="light" onclick="closeModal()">取消</button><button onclick="saveLibraryTradeName('+i+')">儲存工種</button></div>')}
function saveLibraryTradeName(i){const n=len.value.trim();if(!n)return;libData[i].name=n;saveLib();closeModal();library()}
function addLibraryItem(i){const n=prompt('施工項目名稱');if(!n)return;const no=prompt('注意事項，每項用「、」分隔')||'';const nx=prompt('下一步')||'';libData[i].items.push([n.trim(),no.split('、').map(x=>x.trim()).filter(Boolean),nx.trim()]);saveLib();closeModal();editLibraryTrade(i)}
function removeLibraryItem(i,j){if(!confirm('刪除此施工項目？'))return;libData[i].items.splice(j,1);saveLib();closeModal();library()}
function editLibraryItem(ti,j){const t=libData[ti],it=t.items[j];openModal('<h2>編輯施工項目</h2><div class="card" style="padding:12px"><span class="tag">'+esc(t.name)+'</span></div><label>施工項目</label><input id="lei" value="'+esc(it[0])+'"><label>注意事項／前置條件（每行一項）</label><textarea id="lenotes">'+esc((it[1]||[]).join('\n'))+'</textarea><label>下一個工程銜接</label><input id="lenext" value="'+esc(it[2]||'')+'" placeholder="例如：泥作放樣完成後 → 木作進場"><div class="actions"><button class="light" onclick="closeModal();editLibraryTrade('+ti+')">取消</button><button onclick="saveLibraryItem('+ti+','+j+')">儲存</button></div>')}
function saveLibraryItem(ti,j){const it=libData[ti].items[j];it[0]=lei.value.trim()||it[0];it[1]=lenotes.value.split('\n').map(x=>x.trim()).filter(Boolean);it[2]=lenext.value.trim();saveLib();closeModal();libraryDetail(ti,j)}
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
function scheduleItems(){
  const out=[];
  (Array.isArray(data.trades)?data.trades:[]).forEach((t,ti)=>{
    if(!t||typeof t!=='object')return;
    const trade=String(t.name||'未分類');
    (Array.isArray(t.items)?t.items:[]).forEach((it,j)=>{
      if(!Array.isArray(it))return;
      out.push({ti,j,trade,name:String(it[0]||'未命名工程'),notes:Array.isArray(it[1])?it[1]:[],next:String(it[2]||''),start:String(it[3]||''),end:String(it[4]||''),plan:(it[5]&&typeof it[5]==='object')?it[5]:{type:'first'}});
    });
  });
  return out;
}

function dateObj(s){return s?new Date(s+'T00:00:00'):null}
function fmtDate(s){
  if(!s)return '未設定';
  const a=s.split('-'); return a.length===3?(Number(a[1])+'/'+Number(a[2])):s;
}
function scheduleDays(a,b){
  if(!a||!b)return null;
  const x=dateObj(a),y=dateObj(b);
  if(!x||!y||isNaN(x)||isNaN(y)||y<x)return null;
  return Math.floor((y-x)/86400000)+1;
}
function scheduleDuration(start,end){
  const d=scheduleDays(start,end);
  return d?d+' 天':'—';
}
function relationLabel(x,items){
  const p=x.plan||{};
  if(!p.type||p.type==='first')return '第一階段';
  const a=items.find(y=>y.ti===p.ti&&y.j===p.j);
  if(!a)return '第一階段';
  if(p.type==='same')return '與「'+a.name+'」同步';
  if(p.type==='after')return '等「'+a.name+'」完成後';
  if(p.type==='later')return '「'+a.name+'」之後';
  return '第一階段';
}
function timelineBounds(items){
  const dated=items.filter(x=>x.start).map(x=>dateObj(x.start)).concat(items.filter(x=>x.end).map(x=>dateObj(x.end)));
  if(!dated.length)return null;
  let min=new Date(Math.min(...dated.map(x=>x.getTime())));
  let max=new Date(Math.max(...dated.map(x=>x.getTime())));
  min.setDate(min.getDate()-2); max.setDate(max.getDate()+3);
  return {min,max};
}
function timelineDates(min,max){
  const arr=[],d=new Date(min);
  while(d<=max){arr.push(new Date(d));d.setDate(d.getDate()+1);}
  return arr;
}
function timelineHTML(items){
  // 上方「建議施工時間圖」與下方「工程進度表」使用同一批 items。
  // items 的 start/end 直接來自 data.trades[*].items[*][3]/[4]。
  const b=timelineBounds(items);
  if(!b)return '<div class="empty">目前還沒有設定日期，先在下面的工程進度表輸入開始／結束日期。</div>';
  const dates=timelineDates(b.min,b.max), total=dates.length, px=Math.max(18,total*22);
  const trades=[];
  items.forEach(x=>{if(x.start&&!trades.includes(x.trade))trades.push(x.trade)});
  const palette=['#666','#777','#888','#999','#aaa','#555','#777','#777'];
  const rows=trades.map((trade,ri)=>{
    const xs=items.filter(x=>x.trade===trade&&x.start);
    const bars=xs.map(x=>{
      const s=dateObj(x.start),e=dateObj(x.end||x.start);
      const left=Math.max(0,Math.round((s-b.min)/86400000));
      const width=Math.max(1,Math.round((e-s)/86400000)+1);
      return '<div title="'+esc(x.name)+' '+esc(fmtDate(x.start))+'–'+esc(fmtDate(x.end))+'" style="position:absolute;left:'+(left*22)+'px;width:'+(width*22)+'px;top:5px;height:25px;background:'+palette[ri%palette.length]+';border-radius:6px;overflow:hidden;padding:5px 7px;color:#fff;font-size:10px;font-weight:700;white-space:nowrap">'+esc(x.name)+'</div>';
    }).join('');
    return '<div style="display:grid;grid-template-columns:82px 1fr;border-bottom:1px solid #eee;min-height:36px">'+
      '<div style="padding:9px 6px;font-size:11px;font-weight:700;white-space:nowrap"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+palette[ri%palette.length]+';margin-right:5px"></span>'+esc(trade)+'</div>'+
      '<div style="position:relative;height:36px;background-image:linear-gradient(to right,#eee 1px,transparent 1px);background-size:'+(100/total)+'% 100%">'+bars+'</div></div>';
  }).join('');
  const heads=dates.map((d,i)=>'<div style="min-width:22px;text-align:center;font-size:9px;color:#777">'+(i===0||d.getDate()===1?((d.getMonth()+1)+'/'+d.getDate()):d.getDate())+'</div>').join('');
  return '<div style="overflow-x:auto" class="schedule-timeline-scroll"><div style="min-width:'+px+'px">'+
    '<div style="display:flex;justify-content:space-between;gap:10px;padding:0 4px 8px;font-size:11px;color:#777"><span>日期來源：下方工程進度表</span><b>'+esc(fmtDate(b.max.toISOString().slice(0,10)))+'</b></div>'+
    '<div style="display:grid;grid-template-columns:82px 1fr;border-bottom:1px solid #ddd"><div></div><div style="display:grid;grid-template-columns:repeat('+total+',1fr)">'+heads+'</div></div>'+
    rows+'</div></div>';
}
function planGroups(items){
  const first=[],same=[],after=[],later=[];
  items.forEach(x=>{
    const t=(x.plan||{}).type||'first';
    (t==='same'?same:t==='after'?after:t==='later'?later:first).push(x);
  });
  return [{title:'① 進場準備',items:first},{title:'② 同時進場',items:same},{title:'③ 前項完成後',items:after},{title:'④ 後續安排',items:later}].filter(x=>x.items.length);
}
function relationOptions(ti,j){
  const items=scheduleItems();
  let s='<option value="first">第一階段／進場準備</option>';
  items.filter(x=>!(x.ti===ti&&x.j===j)).forEach(x=>{
    s+='<option value="same:'+x.ti+':'+x.j+'">與 '+esc(x.trade)+'｜'+esc(x.name)+' 同時進場</option>';
    s+='<option value="after:'+x.ti+':'+x.j+'">等 '+esc(x.trade)+'｜'+esc(x.name)+' 完成後</option>';
    s+='<option value="later:'+x.ti+':'+x.j+'">在 '+esc(x.trade)+'｜'+esc(x.name)+' 之後安排</option>';
  });
  return s;
}

function weekly2022Date(s){
  if(!s)return null;
  const d=dateObj(s);
  return d && !isNaN(d) ? d : null;
}
function weekly2022Label(d){
  if(!d)return '';
  return (d.getMonth()+1)+'/'+d.getDate();
}
function renderWeeklyStages(items){
  const dated=items.filter(x=>x.start).map(x=>{
    const s=weekly2022Date(x.start);
    const e=weekly2022Date(x.end||x.start)||s;
    return {...x,wstart:s,wend:e};
  }).filter(x=>x.wstart);
  if(!dated.length)return '<div class="empty">目前沒有設定日期，先在工程進度表輸入開始日期。</div>';

  // 每週固定為週一～週日；一個工程跨週時，會在每個相關週次顯示。
  const weekKey=d=>{
    const x=new Date(d);
    const day=(x.getDay()+6)%7;
    x.setDate(x.getDate()-day);
    x.setHours(0,0,0,0);
    return x.getTime();
  };
  const map={};
  dated.forEach(x=>{
    let d=new Date(x.wstart);
    while(d<=x.wend){
      const k=weekKey(d);
      if(!map[k]){
        const start=new Date(k),end=new Date(k);
        end.setDate(end.getDate()+6);
        map[k]={start,end,items:[]};
      }
      if(!map[k].items.some(y=>y.ti===x.ti&&y.j===x.j))map[k].items.push(x);
      d.setDate(d.getDate()+7);
    }
  });

  const weeks=Object.values(map).sort((a,b)=>a.start-b.start);
  const firstWeekKey=weekKey(weeks[0].start);
  const weekNo=d=>Math.floor((weekKey(d)-firstWeekKey)/604800000)+1;
  const dayNames=['一','二','三','四','五','六','日'];

  return weeks.map(w=>{
    const active=[...w.items].sort((a,b)=>a.wstart-b.wstart);
    const byTrade={};
    active.forEach(x=>{
      const key=x.trade||'未分類';
      if(!byTrade[key])byTrade[key]=[];
      byTrade[key].push(x);
    });
    const tradeNames=Object.keys(byTrade);

    // 本週目標：只摘要本週主要工種，避免再增加一堆說明文字。
    const goalTrades=tradeNames.join('、');
    const objective='完成 '+goalTrades+' 的施工／銜接，並確認下一階段進場條件。';

    // 七日時間軸：每一列一個工種，工種多時仍能一眼看出各自的施工區段。
    const gridCols='repeat(7,minmax(0,1fr))';
    const dayHead='<div style="display:grid;grid-template-columns:88px 1fr;border-bottom:1px solid #e8e8e8">'+
      '<div></div><div style="display:grid;grid-template-columns:'+gridCols+'">'+
      dayNames.map((d,i)=>'<div style="text-align:center;padding:5px 0 6px;font-size:11px;color:#999">'+d+'</div>').join('')+
      '</div></div>';

    const timelineRows=tradeNames.map(trade=>{
      const xs=byTrade[trade];
      const bars=xs.map(x=>{
        const ss=x.wstart<w.start?w.start:x.wstart;
        const ee=x.wend>w.end?w.end:x.wend;
        const left=Math.max(0,Math.floor((ss-w.start)/86400000));
        const right=Math.min(6,Math.floor((ee-w.start)/86400000));
        const width=Math.max(1,right-left+1);
        return '<div title="'+esc(x.name)+'" style="position:absolute;left:calc('+left+'/7*100% + 2px);width:calc('+width+'/7*100% - 4px);top:7px;height:18px;background:#222;border-radius:9px"></div>';
      }).join('');
      return '<div style="display:grid;grid-template-columns:88px 1fr;border-bottom:1px solid #eeeeee;min-height:35px">'+
        '<div style="padding:10px 7px;font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(trade)+'</div>'+ 
        '<div style="position:relative;background-image:linear-gradient(to right,#ededed 1px,transparent 1px);background-size:calc(100% / 7) 100%">'+bars+'</div>'+ 
      '</div>';
    }).join('');

    // 本週工程：以工種分組，但每個工種只出現一次，避免後期大量工項混成一長串。
    const tradeBlocks=tradeNames.map(trade=>{
      const tradeItems=byTrade[trade];
      return '<div style="margin-bottom:12px">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:0 0 7px;border-bottom:1px solid #e5e5e5">'+
          '<b style="font-size:16px">'+esc(trade)+'</b><span class="muted">'+tradeItems.length+' 項</span>'+ 
        '</div>'+ 
        tradeItems.map(x=>{
          const ss=x.wstart<w.start?w.start:x.wstart;
          const ee=x.wend>w.end?w.end:x.wend;
          return '<div class="row" style="margin:0;padding:9px 0;border-bottom:1px solid #f0f0f0;cursor:pointer" onclick="exampleLibraryItemDetail('+x.ti+','+x.j+')">'+
            '<div style="flex:1;min-width:0"><b>'+esc(x.name)+'</b>'+(data.trades[x.ti]?.items?.[x.j]?.[7]?'<span class="checkpoint">◆ 查驗</span>':'')+
            '<div class="muted" style="margin-top:3px">'+weekly2022Label(ss)+' ～ '+weekly2022Label(ee)+'　｜　'+esc(relationLabel(x,items))+'</div></div><span style="padding-left:8px;color:#999">→</span></div>';
        }).join('')+
      '</div>';
    }).join('');

    return '<div class="card" style="padding:18px 16px;margin-bottom:16px">'+
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">'+
        '<div style="min-width:0"><div style="font-size:26px;font-weight:800;line-height:1.15">第 '+weekNo(w.start)+' 週</div>'+ 
        '<div style="font-size:14px;color:#888;margin-top:5px">'+w.start.getFullYear()+'/'+weekly2022Label(w.start)+' ～ '+w.end.getFullYear()+'/'+weekly2022Label(w.end)+'</div></div>'+ 
        '<span class="tag" style="white-space:nowrap">'+tradeNames.length+' 個工種</span>'+ 
      '</div>'+ 
      '<div style="margin-top:18px;padding:14px 14px;background:#f5f3ee;border:1px solid #e8e2d8;border-radius:12px">'+
        '<div style="font-size:15px;font-weight:700;margin-bottom:6px">🎯 本週目標</div>'+ 
        '<div style="font-size:15px;line-height:1.65">'+esc(objective)+'</div>'+ 
      '</div>'+ 
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:20px;margin-bottom:8px"><b style="font-size:16px">本週施工時程</b><span class="muted">7 天</span></div>'+ 
      '<div style="border-top:1px solid #e5e5e5;border-bottom:1px solid #e5e5e5">'+dayHead+timelineRows+'</div>'+ 
      '<div style="margin-top:18px;color:#888;font-size:14px">本週工程</div>'+ 
      '<div style="margin-top:10px">'+tradeBlocks+'</div>'+ 
    '</div>';
  }).join('');
}

function exampleLibraryItemDetail(ti,j){
  const t=data.trades[ti], it=t&&t.items[j];
  if(!t||!it)return exampleSchedule();
  if(!Array.isArray(it[6])){
    it[6]=(it[1]||[]).map(x=>({text:x,done:false}));
    save();
  }else{
    it[6]=it[6].map(x=>typeof x==='string'?{text:x,done:false}:x).filter(x=>x&&x.text);
  }
  const checks=it[6], done=checks.filter(x=>x.done).length;
  const items=scheduleItems();
  main.innerHTML=
    '<button class="back" onclick="exampleSchedule()">← 返回工程庫</button>'+
    '<div class="card">'+
      '<span class="tag">'+esc(t.name)+'</span>'+
      '<h2 style="margin:9px 0 5px">'+esc(it[0])+(it[7]?'<span class="checkpoint">◆ 主要查驗節點</span>':'')+'</h2>'+
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:6px">'+
        '<div class="muted" style="font-size:14px">'+(it[3]&&it[4]?esc(fmtDate(it[3])+' ～ '+fmtDate(it[4])):(it[3]?esc(fmtDate(it[3])+' 起'):'日期尚未設定'))+'</div>'+
        '<button class="light" style="font-size:12px;padding:8px 11px;white-space:nowrap" onclick="editScheduleDates('+ti+','+j+')">調整時間</button>'+
      '</div>'+
    '</div>'+
    '<div class="section"><b>前置條件</b><span class="muted">'+done+'/'+checks.length+'</span></div>'+
    '<div class="card">'+
      (checks.length?checks.map((c,i)=>
        '<label class="row" style="cursor:pointer">'+
          '<input type="checkbox" '+(c.done?'checked':'')+' onchange="toggleLibraryCheck('+ti+','+j+','+i+',this.checked)" style="width:20px;height:20px;margin:0;flex:none">'+
          '<span style="flex:1;'+(c.done?'text-decoration:line-through;color:#999':'')+'">'+esc(c.text)+'</span>'+
        '</label>'
      ).join(''):'<div class="empty">尚未設定前置條件</div>')+
      '<button class="light" style="width:100%;margin-top:10px" onclick="editLibraryChecks('+ti+','+j+')">編輯前置條件</button>'+
    '</div>'+
    '<div class="section"><b>施工安排</b></div>'+
    '<div class="card">'+
      '<div class="row"><div style="flex:1"><div class="muted">進場關係</div><b>'+esc(relationLabel({plan:it[5]||{}},items))+'</b></div></div>'+
      '<div class="row"><div style="flex:1"><div class="muted">工程進度表的下一個事項</div><b>→ '+esc(progressNextFor2022(ti,j)||'後續未設定')+'</b></div></div>'+ (it[7]?'<div class="warn"><b>◆ 主要查驗節點</b><br>做到這裡要停下來確認，完成查驗後再進入下一事項。</div>':'')+
      '<button class="light" style="width:100%;margin-top:10px" onclick="editSchedulePlan('+ti+','+j+')">編輯施工安排</button>'+
    '</div>'+
    '<div class="hint">這裡是工程庫的標準內容。之後新增工程時，可以從工程庫套用，再在該工程裡個別調整。</div>';
}
function editScheduleDates(ti,j){
  const it=data.trades[ti].items[j];
  if(!it)return;
  openModal('<h2>調整工程時間</h2>'+
    '<div class="card" style="padding:12px"><b>'+esc(it[0])+'</b><div class="muted" style="margin-top:5px">只修改這個施工項目的開始／結束日期，不會改動其他工項。</div></div>'+
    '<label>開始日期</label><input id="dateStart" type="date" value="'+esc(it[3]||'')+'">'+
    '<label>結束日期</label><input id="dateEnd" type="date" value="'+esc(it[4]||'')+'">'+
    '<div class="hint">修改後會立即反映在工程進度表與上方時間範圍。</div>'+
    '<div class="actions"><button class="light" onclick="closeModal()">取消</button><button onclick="saveScheduleDates('+ti+','+j+')">儲存時間</button></div>');
}
function saveScheduleDates(ti,j){
  const it=data.trades[ti].items[j];
  if(!it)return;
  const start=document.getElementById('dateStart').value;
  const end=document.getElementById('dateEnd').value;
  if(start&&end&&end<start){alert('結束日期不能早於開始日期');return;}
  it[3]=start;
  it[4]=end;
  save();
  closeModal();
  // 日期也是工程進度表的唯一時間資料；儲存後直接回到進度表，讓上方時間圖重新繪製。
  exampleSchedule();
}

function toggleLibraryCheck(ti,j,i,checked){
  const it=data.trades[ti].items[j];
  if(!Array.isArray(it[6]))it[6]=(it[1]||[]).map(x=>({text:x,done:false}));
  if(it[6][i])it[6][i].done=!!checked;
  save();
  exampleLibraryItemDetail(ti,j);
}
function editLibraryChecks(ti,j){
  const it=data.trades[ti].items[j];
  const checks=Array.isArray(it[6])?it[6]:((it[1]||[]).map(x=>({text:x,done:false})));
  openModal('<h2>編輯前置條件</h2><div class="hint">一行一項。這些是工程庫的標準確認項目。</div><textarea id="libraryChecksEdit">'+esc(checks.map(x=>x.text||x).join('\n'))+'</textarea><div class="actions"><button class="light" onclick="closeModal()">取消</button><button onclick="saveLibraryChecks('+ti+','+j+')">儲存</button></div>');
}
function saveLibraryChecks(ti,j){
  const it=data.trades[ti].items[j];
  const old=Array.isArray(it[6])?it[6]:[];
  const lines=document.getElementById('libraryChecksEdit').value.split('\n').map(x=>x.trim()).filter(Boolean);
  it[1]=lines;
  it[6]=lines.map(text=>{
    const oldItem=old.find(x=>(x.text||x)===text);
    return {text,done:oldItem?!!oldItem.done:false};
  });
  save();closeModal();exampleLibraryItemDetail(ti,j);
}


function normalizeScheduleGroupName(name){
  return String(name||'').trim().replace(/^\d+\.\s*/,'').trim() || '未分類';
}
function getScheduleGroups(){
  // 分類是獨立資料：保留使用者建立的分類，同時自動補回目前工程正在使用的分類。
  // 不會因為分類目前沒有項目就自動刪除。
  const groups=[];
  const seen=new Set();
  const existing=Array.isArray(data.scheduleGroups)?data.scheduleGroups:[];

  const addGroup=(rawName, meta)=>{
    const name=normalizeScheduleGroupName(rawName);
    if(!name||seen.has(name))return;
    seen.add(name);
    const n=Number(meta?.number);
    groups.push({
      name,
      key:name,
      number:Number.isFinite(n)&&n>0?Math.floor(n):groups.length+1,
      showNumber:meta?.showNumber===true,
      _originalIndex:groups.length
    });
  };

  // 1. 先保留已經存在的自訂分類（包含沒有工程項目的新分類）。
  existing.forEach((g)=>addGroup(g?.name,g));

  // 2. 再補回目前工程項目實際使用的分類。
  scheduleItems().forEach(x=>addGroup(scheduleGroupName(x),{}));

  // 3. 如果工程項目的分類欄還沒設定，則使用原本的工種名稱，確保「清潔」等目前工種不會消失。
  (Array.isArray(data.trades)?data.trades:[]).forEach(t=>{
    if(!t)return;
    addGroup(t.name,{});
  });

  groups.sort((a,b)=>{
    const an=Number.isFinite(Number(a.number))?Number(a.number):999999;
    const bn=Number.isFinite(Number(b.number))?Number(b.number):999999;
    return an-bn || a._originalIndex-b._originalIndex;
  });
  groups.forEach((g,i)=>{g.number=i+1;delete g._originalIndex;});
  return groups;
}

function scheduleGroupName(x){
  const raw=data.trades?.[x.ti]?.items?.[x.j];
  return Array.isArray(raw)&&String(raw[9]||'').trim()
    ? normalizeScheduleGroupName(raw[9])
    : normalizeScheduleGroupName(x.trade||'未分類');
}
function saveScheduleGroups(groups){
  // 分類本身獨立保存；不會因為目前沒有工程項目而被刪除。
  const clean=[];
  const seen=new Set();
  (groups||[]).forEach(g=>{
    const name=normalizeScheduleGroupName(g?.name);
    if(!name||seen.has(name))return;
    seen.add(name);
    clean.push({
      name,
      key:name,
      number:clean.length+1,
      showNumber:g?.showNumber===true
    });
  });
  data.scheduleGroups=clean;
  save();
}

function editScheduleGroup(index){
  const groups=getScheduleGroups(), g=groups[index];
  if(!g)return;
  openModal(
    '<h2>編輯分類</h2>'+
    '<label>分類名稱</label>'+
    '<input id="scheduleGroupNameEdit" value="'+esc(g.name)+'" placeholder="例如：木作">'+
    '<label>工種編號</label>'+
    '<input id="scheduleGroupNumberEdit" type="number" min="1" step="1" value="'+esc(String(g.number||''))+'" placeholder="例如：23">'+
    '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin:8px 0 14px">'+
      '<input id="scheduleGroupShowNumberEdit" type="checkbox" '+(g.showNumber?'checked':'')+' style="width:18px;height:18px;margin:0">'+
      '<span>顯示工種編號</span>'+
    '</label>'+
    '<div class="hint">編號就是分類順序。輸入 2 就會移到第 2 項，其他分類自動順延。</div>'+
    '<div class="actions"><button class="light" onclick="closeModal()">取消</button><button onclick="saveScheduleGroupEdit('+index+')">儲存</button></div>'
  );
}
function saveScheduleGroupEdit(index){
  const groups=getScheduleGroups(), g=groups[index];
  if(!g)return;
  const nameEl=document.getElementById('scheduleGroupNameEdit');
  const numEl=document.getElementById('scheduleGroupNumberEdit');
  const showEl=document.getElementById('scheduleGroupShowNumberEdit');
  const next=normalizeScheduleGroupName(nameEl?.value||'');
  if(!next){alert('請輸入分類名稱');return;}
  if(groups.some((x,i)=>i!==index&&normalizeScheduleGroupName(x.name)===next)){alert('已有相同分類名稱。');return;}
  const numRaw=String(numEl?.value||'').trim();
  const num=numRaw===''?g.number:Number(numRaw);
  if(!Number.isFinite(num)||num<1){alert('工種編號請輸入 1 以上的整數');return;}
  const old=g.name;
  const target=Math.max(1,Math.min(groups.length,Math.floor(num)));
  g.name=next;
  g.key=next;
  g.showNumber=!!showEl?.checked;
  const moved=groups.splice(index,1)[0];
  groups.splice(target-1,0,moved);
  groups.forEach((x,i)=>x.number=i+1);
  // 同步目前工程項目所使用的分類名稱，但不修改工種庫名稱。
  (Array.isArray(data.trades)?data.trades:[]).forEach(t=>{
    (Array.isArray(t.items)?t.items:[]).forEach(it=>{
      if(Array.isArray(it)&&normalizeScheduleGroupName(it[9]||'')===old)it[9]=next;
    });
  });
  saveScheduleGroups(groups);
  closeModal();
  exampleSchedule();
}
function moveScheduleGroup(index,delta){
  const groups=getScheduleGroups(), ni=index+delta;
  if(index<0||ni<0||ni>=groups.length)return;
  const tmp=groups[index];groups[index]=groups[ni];groups[ni]=tmp;
  groups.forEach((g,i)=>g.number=i+1);
  saveScheduleGroups(groups);exampleSchedule();
}
function addScheduleItemToGroup(groupIndex){
  const groups=getScheduleGroups();
  const g=groups[groupIndex];
  if(!g)return;
  openModal('<h2>新增「'+esc(g.name)+'」工程細項</h2>'+    '<label>工程項目名稱</label><input id="newScheduleItemName" placeholder="例如：現場清潔">'+    '<div class="grid"><div><label>開始日期</label><input id="newScheduleItemStart" type="date"></div><div><label>結束日期</label><input id="newScheduleItemEnd" type="date"></div></div>'+    '<label>注意事項（可選，每項用「、」分隔）</label><input id="newScheduleItemNotes" placeholder="例如：垃圾清運、地面保護">'+    '<div class="actions"><button class="light" onclick="closeModal()">取消</button><button onclick="saveNewScheduleItem('+groupIndex+')">新增</button></div>');
  setTimeout(()=>document.getElementById('newScheduleItemName')?.focus(),50);
}

function saveNewScheduleItem(groupIndex){
  const groups=getScheduleGroups();
  const g=groups[groupIndex];
  if(!g)return;
  const name=(document.getElementById('newScheduleItemName')?.value||'').trim();
  const start=document.getElementById('newScheduleItemStart')?.value||'';
  const end=document.getElementById('newScheduleItemEnd')?.value||'';
  const notes=(document.getElementById('newScheduleItemNotes')?.value||'').split('、').map(x=>x.trim()).filter(Boolean);
  if(!name){alert('請輸入工程項目名稱');return;}
  if(start&&end&&end<start){alert('結束日期不能早於開始日期');return;}

  // 優先放進同名的既有工種；若只有自訂分類，則建立一個對應工種容器。
  let ti=data.trades.findIndex(t=>normalizeScheduleGroupName(t?.name)===g.name);
  if(ti<0){
    data.trades.push({name:g.name,items:[],source:'custom'});
    ti=data.trades.length-1;
  }
  const t=data.trades[ti];
  const nextOrder=t.items.reduce((m,it)=>Math.max(m,Number(it?.[8])||0),0)+1;
  const item=[name,notes,'',start,end,'','',false,nextOrder,g.name];
  t.items.push(item);
  save();
  closeModal();
  exampleSchedule();
}

function addScheduleGroup(){
  const groups=getScheduleGroups();
  const name=prompt('新增工程分類名稱：','新分類');
  if(name===null)return;
  const n=normalizeScheduleGroupName(name);
  if(!n)return;
  if(groups.some(g=>normalizeScheduleGroupName(g.name)===n)){alert('已有相同分類名稱。');return;}
  groups.push({name:n,key:n,number:groups.length+1,showNumber:false});
  saveScheduleGroups(groups);
  exampleSchedule();
}
function cleanupScheduleGroups(){
  // 整理：把工程項目中的舊編號前綴去掉、同名分類合併；
  // 只保留「目前有工程項目」或「使用者明確建立」的分類。
  const oldGroups=Array.isArray(data.scheduleGroups)?data.scheduleGroups:[];
  const usedNames=[];
  (Array.isArray(data.trades)?data.trades:[]).forEach(t=>{
    (Array.isArray(t?.items)?t.items:[]).forEach(it=>{
      if(Array.isArray(it)&&String(it[9]||'').trim()){
        const n=normalizeScheduleGroupName(it[9]);
        if(n&&!usedNames.includes(n))usedNames.push(n);
        it[9]=n;
      }
    });
  });
  const clean=[];
  const seen=new Set();
  oldGroups.forEach(g=>{
    const n=normalizeScheduleGroupName(g?.name);
    if(!n||seen.has(n))return;
    seen.add(n);
    clean.push({name:n,key:n,showNumber:g?.showNumber===true});
  });
  // 工程項目中實際使用的分類一定補回來，例如清潔。
  usedNames.forEach(n=>{
    if(!seen.has(n)){
      seen.add(n);
      clean.push({name:n,key:n,showNumber:false});
    }
  });
  clean.forEach((g,i)=>g.number=i+1);
  data.scheduleGroups=clean;
  save();
  exampleSchedule();
  alert('分類整理完成。重複分類已合併，工程項目目前使用的分類也已保留。');
}
function deleteScheduleGroup(index){
  const groups=getScheduleGroups(), g=groups[index];
  if(!g)return;
  const hasItems=scheduleItems().some(x=>scheduleGroupName(x)===g.name);
  if(hasItems){alert('這個分類還有工程項目，請先把項目移到其他分類，再刪除。');return;}
  if(!confirm('確定刪除「'+g.name+'」分類？'))return;
  groups.splice(index,1);
  groups.forEach((x,i)=>x.number=i+1);
  saveScheduleGroups(groups);exampleSchedule();
}
// 工程進度表每一列的「編輯」：直接編輯該工程項目的內容
function editScheduleItem(ti,j){
  if(!data.trades?.[ti]?.items?.[j])return;
  return editTradeItem(ti,j);
}

function updateScheduleItemGroup(ti,j,value){
  const it=data.trades?.[ti]?.items?.[j];
  if(!Array.isArray(it))return;
  it[9]=String(value||'').trim();
  save();exampleSchedule();
}
function toggleTradeSchedule(id){
  const box=document.getElementById(id), icon=document.getElementById(id+'_icon');
  if(!box)return;
  const closed=box.style.display==='none';
  box.style.display=closed?'block':'none';
  if(icon)icon.textContent=closed?'▼':'▶';
}
function collapseAllTradeSchedules(){
  document.querySelectorAll('[id^="tradeSchedule_"]').forEach(box=>{
    box.style.display='none';
    const icon=document.getElementById(box.id+'_icon');
    if(icon)icon.textContent='▶';
  });
}
function updateScheduleOrder(ti,j,value){
  const it=data.trades?.[ti]?.items?.[j];
  if(!Array.isArray(it))return;
  const n=Number(value);
  it[8]=Number.isFinite(n)&&n>0?n:'';
  save();exampleSchedule();
}
function updateScheduleDateInline(ti,j,field,value){
  const it=data.trades?.[ti]?.items?.[j];
  if(!Array.isArray(it))return;
  if(field==='start')it[3]=value||'';
  if(field==='end')it[4]=value||'';
  if(it[3]&&it[4]&&it[4]<it[3]){alert('結束日期不能早於開始日期');return;}
  save();exampleSchedule();
}

function ensureScheduleGroups(){
  const groups=getScheduleGroups();
  const current=Array.isArray(data.scheduleGroups)?data.scheduleGroups:[];
  const old=current.map(g=>normalizeScheduleGroupName(g?.name)).filter(Boolean);
  const now=groups.map(g=>g.name);
  if(old.length!==now.length || old.some((n,i)=>n!==now[i])){
    saveScheduleGroups(groups);
  }
  return groups;
}

function exampleScheduleUnsafe(e){
  nav(e);
  const items=scheduleItems();
  const validItems=items.filter(x=>x && (!x.start || !isNaN(dateObj(x.start))) && (!x.end || !isNaN(dateObj(x.end))));
  const dated=validItems.filter(x=>x.start).sort((a,b)=>String(a.start).localeCompare(String(b.start)));
  const firstDate=dated.length?fmtDate(dated[0].start):'尚未排定';
  const lastDated=validItems.filter(x=>x.start||x.end).sort((a,b)=>String(b.end||b.start||'').localeCompare(String(a.end||a.start||'')));
  const lastDate=lastDated.length?fmtDate(lastDated[0].end||lastDated[0].start):'尚未排定';

  let timeline='';
  try{ timeline=timelineHTML(validItems); }
  catch(err){ console.error('施工時間圖錯誤',err); timeline='<div class="empty">施工時間圖暫時無法顯示，但下面的工程進度資料仍可正常使用。</div>'; }

  let weekly='';
  try{ weekly=renderWeeklyStages(validItems); }
  catch(err){ console.error('每週階段錯誤',err); weekly='<div class="empty">每週階段圖暫時無法顯示，工程進度表仍可正常使用。</div>'; }

  // 工程進度表：依「可自訂工程分類」分組；分類名稱與順序可由使用者調整。
  const groups=ensureScheduleGroups();
  const grouped={};
  groups.forEach(g=>grouped[g.name]=[]);
  validItems.forEach(x=>{
    const key=scheduleGroupName(x);
    if(!grouped[key])grouped[key]=[];
    grouped[key].push(x);
  });
  // 顯示全部分類：即使目前沒有工程項目，也要保留分類區塊。
  // 分類本身存在 ≠ 必須有工程項目。
  const groupNames=groups.map(g=>g.name);
  Object.keys(grouped).forEach(n=>{if(!groupNames.includes(n))groupNames.push(n);});
  const tradeRows=groupNames.map((groupName,idx)=>{
    const list=grouped[groupName];
    list.sort((a,b)=>{
      const ao=Number(data.trades?.[a.ti]?.items?.[a.j]?.[8]);
      const bo=Number(data.trades?.[b.ti]?.items?.[b.j]?.[8]);
      const av=Number.isFinite(ao)&&ao>0?ao:999999;
      const bv=Number.isFinite(bo)&&bo>0?bo:999999;
      return av-bv||String(a.start||'9999').localeCompare(String(b.start||'9999'));
    });
    const groupIndex=groups.findIndex(g=>g.name===groupName);
    const body=list.length ? list.map(x=>{
      const raw=data.trades?.[x.ti]?.items?.[x.j];
      const checkpoint=Array.isArray(raw)&&raw[7];
      const order=Array.isArray(raw)&&raw[8]!==undefined&&raw[8]!==''?raw[8]:'';
      return '<tr>'+
  
        '<td style="padding:8px;border-bottom:1px solid #eee;white-space:nowrap"><input type="date" value="'+esc(x.start||'')+'" onclick="event.stopPropagation()" onchange="updateScheduleDateInline('+x.ti+','+x.j+',\'start\',this.value)" style="margin:0;padding:8px;width:145px"></td>'+
        '<td style="padding:8px;border-bottom:1px solid #eee;white-space:nowrap"><input type="date" value="'+esc(x.end||'')+'" onclick="event.stopPropagation()" onchange="updateScheduleDateInline('+x.ti+','+x.j+',\'end\',this.value)" style="margin:0;padding:8px;width:145px"></td>'+
        '<td onclick="exampleLibraryItemDetail('+x.ti+','+x.j+')" style="padding:12px;border-bottom:1px solid #eee"><b>'+esc(x.name)+'</b>'+(checkpoint?'<span class="checkpoint">◆ 查驗</span>':'')+'</td>'+
        '<td style="padding:8px;border-bottom:1px solid #eee;white-space:nowrap"><select onclick="event.stopPropagation()" onchange="updateScheduleItemGroup('+x.ti+','+x.j+',this.value)" style="margin:0;padding:7px;min-width:100px">'+
          groups.map(g=>'<option value="'+esc(g.name)+'" '+(scheduleGroupName(x)===g.name?'selected':'')+'>'+esc(g.name)+'</option>').join('')+
        '</select></td>'+
        '<td style="padding:12px;border-bottom:1px solid #eee;text-align:center">'+esc(scheduleDuration(x.start,x.end))+'</td>'+
        '<td style="padding:12px;border-bottom:1px solid #eee"><button type="button" class="editbtn" onclick="event.preventDefault();event.stopPropagation();window.editScheduleItem('+x.ti+','+x.j+');return false;">編輯</button> <button class="light" onclick="event.stopPropagation();deleteScheduleItem('+x.ti+','+x.j+')" style="color:#b42318">刪除</button></td>'+
        '</tr>';
    }).join('') : '<tr><td colspan="6" style="padding:18px;text-align:center;color:#888;border-bottom:1px solid #eee">目前沒有工程項目</td></tr>';
    const id='tradeSchedule_'+idx;
    return '<div class="card" style="padding:0;overflow:hidden;margin-bottom:12px">'+
      '<div style="padding:14px 16px;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between;gap:8px">'+
        '<button type="button" onclick="toggleTradeSchedule(\''+id+'\')" style="flex:1;border:0;background:transparent;padding:0;display:flex;align-items:center;gap:10px;cursor:pointer;text-align:left;color:#171717">'+
          '<b style="font-size:18px">'+((groups[groupIndex]&&groups[groupIndex].showNumber)?String(groups[groupIndex].number)+'. ':'')+esc(groupName)+'</b><span class="tag">'+list.length+' 項</span><span id="'+id+'_icon">▼</span>'+
        '</button>'+
        '<div style="display:flex;gap:4px">'+
          '<button class="light" title="往上" onclick="event.stopPropagation();moveScheduleGroup('+groupIndex+',-1)">↑</button>'+
          '<button class="light" title="往下" onclick="event.stopPropagation();moveScheduleGroup('+groupIndex+',1)">↓</button>'+
          '<button type="button" class="light" onclick="event.stopPropagation();addScheduleItemToGroup('+groupIndex+')">＋ 新增</button>'+
          '<button type="button" class="light scheduleGroupEditBtn" data-group-index="'+groupIndex+'" style="position:relative;z-index:100;pointer-events:auto;cursor:pointer">編輯</button>'+
          '<button type="button" class="light" style="position:relative;z-index:20;pointer-events:auto;color:#b42318" onclick="deleteScheduleGroup('+groupIndex+')">刪除</button>'+
        '</div>'+
      '</div>'+
      '<div id="'+id+'" style="overflow-x:auto"><table style="width:100%;min-width:860px;border-collapse:collapse;font-size:13px"><thead><tr>'+
      '<th style="text-align:left;padding:10px;border-bottom:1px solid #ddd">開始</th><th style="text-align:left;padding:10px;border-bottom:1px solid #ddd">結束</th><th style="text-align:left;padding:10px;border-bottom:1px solid #ddd">工程項目</th><th style="text-align:left;padding:10px;border-bottom:1px solid #ddd">分類</th><th style="text-align:center;padding:10px;border-bottom:1px solid #ddd">工期</th><th style="padding:10px;border-bottom:1px solid #ddd">操作</th>'+
      '</tr></thead><tbody>'+body+'</tbody></table></div>'+
      '</div>';
  }).join('');
  
  main.innerHTML=
    '<div class="section"><div><b>施工安排指南</b><div class="muted">實際日期以工程進度表為準，上方時間圖會跟著日期同步。</div></div><div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><button class="light" onclick="cleanupScheduleGroups()">整理分類</button><button onclick="newScheduleItem()">＋ 新增</button></div></div>'+ 
    '<div class="card"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><div class="muted">工程時間範圍</div><h2 style="margin:4px 0">'+esc(firstDate)+' ～ '+esc(lastDate)+'</h2></div><span class="tag">'+validItems.length+' 個工程項目</span></div><div class="muted">日期直接讀取目前工程進度表，不會另外建立一份資料。</div></div>'+ 
    '<div class="section"><b>建議施工時間圖</b><span class="muted">與下方日期連動</span></div>'+ 
    '<div class="card" style="padding:10px">'+timeline+'</div>'+ 
    '<div class="section"><b>各階段重點</b><span class="muted">每週</span></div>'+weekly+
    '<div class="section"><div><b>工程進度表</b><div class="muted">依自訂分類分組；分類名稱、編號顯示與分類順序都可以自己調整。</div></div><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="light" onclick="addScheduleGroup()">＋ 分類</button><button class="light" onclick="cleanupScheduleGroups()">整理分類</button><button class="light" onclick="collapseAllTradeSchedules()">全部收合</button></div></div>'+ 
    (tradeRows||'<div class="empty">目前沒有工程項目。</div>');
}

function exampleSchedule(e){
  // 唯一的工程範例入口：使用上方已完成的分工種版本。
  // e 可以是按鈕元素，也可以省略；nav() 已做防呆。
  return exampleScheduleUnsafe(e);
}

function methods(e){nav(e);main.innerHTML='<div class="section"><b>工法／材料資料庫</b><button onclick="newMethod()">＋ 新增</button></div><div class="hint">可依品牌、系列、型號、用途搜尋。資料會直接保存在目前工程資料庫，不會另外建立新資料庫。</div><input id="methodSearch" placeholder="搜尋：神保、Panasonic、G系列、星光、面板…" oninput="renderMethods()"><div id="methodList"></div>';renderMethods()}
function renderMethods(){let box=document.getElementById('methodList');if(!box)return;let q=(document.getElementById('methodSearch').value||'').toLowerCase();let list=(data.methods||[]).filter(x=>(x.name+' '+x.maker+' '+x.series+' '+x.model+' '+x.category).toLowerCase().includes(q));box.innerHTML=list.map((m,i)=>'<div class="card"><span class="tag">'+esc(m.category)+'</span><h3 style="margin:8px 0 5px">'+esc(m.name)+'</h3><div class="muted">'+esc(m.maker)+'　'+esc(m.series)+'　'+esc(m.model)+'</div><p style="margin:10px 0">'+esc(m.note)+'</p><b>'+esc(m.price||'未設定')+'</b><div class="muted">'+esc(m.priceNote||'參考價格')+'</div><div style="margin-top:10px"><button class="light" onclick="editMethod('+i+')">編輯</button> <button onclick="deleteMethod('+i+')">刪除</button>'+(m.url?'<button class="light" onclick="window.open(\''+m.url+'\',\'_blank\')">查最新價格</button>':'')+'</div></div>').join('')||'<div class="empty">找不到資料。</div>'}
function newMethod(){openModal('<h2>新增工法／材料</h2><label>分類</label><select id="mc"><option>水電</option><option>泥作</option><option>木作</option><option>油漆</option><option>設備</option><option>其他</option></select><label>名稱</label><input id="mn" placeholder="例如：面板／貼磚工法"><label>品牌</label><input id="mm" placeholder="例如：神保電器"><label>系列</label><input id="ms" placeholder="例如：NK系列"><label>型號</label><input id="mmo"><label>參考單價</label><input id="mp" placeholder="例如：¥1,870（税込）"><label>價格備註</label><input id="mpn" placeholder="例如：2026/09、含稅／未稅"><label>說明</label><textarea id="mnote"></textarea><label>查價網址（可選）</label><input id="murl" placeholder="官方產品頁／供應商頁"><div class="actions"><button class="light" onclick="closeModal()">取消</button><button onclick="saveMethod()">儲存</button></div>')}
function saveMethod(){if(!mn.value)return;(data.methods||=[]).push({category:mc.value,name:mn.value,maker:mm.value,series:ms.value,model:mmo.value,price:mp.value,priceNote:mpn.value,note:mnote.value,url:murl.value});save();closeModal();methods()}
function editMethod(i){let m=data.methods[i];openModal('<h2>編輯工法／材料</h2><label>分類</label><input id="mc" value="'+esc(m.category)+'"><label>名稱</label><input id="mn" value="'+esc(m.name)+'"><label>品牌</label><input id="mm" value="'+esc(m.maker)+'"><label>系列</label><input id="ms" value="'+esc(m.series)+'"><label>型號</label><input id="mmo" value="'+esc(m.model)+'"><label>參考單價</label><input id="mp" value="'+esc(m.price)+'"><label>價格備註</label><input id="mpn" value="'+esc(m.priceNote)+'"><label>說明</label><textarea id="mnote">'+esc(m.note)+'</textarea><label>查價網址（可選）</label><input id="murl" value="'+esc(m.url||'')+'"><div class="actions"><button class="light" onclick="closeModal()">取消</button><button onclick="updateMethod('+i+')">儲存</button></div>')}
function updateMethod(i){let m=data.methods[i];m.category=mc.value;m.name=mn.value;m.maker=mm.value;m.series=ms.value;m.model=mmo.value;m.price=mp.value;m.priceNote=mpn.value;m.note=mnote.value;m.url=murl.value;save();closeModal();methods()}
function deleteMethod(i){if(confirm('刪除此資料？')){data.methods.splice(i,1);save();methods()}}
function projectWeekRange(){
  const now=new Date(); now.setHours(0,0,0,0);
  const day=now.getDay();
  const diff=day===0?-6:1-day;
  const start=new Date(now); start.setDate(now.getDate()+diff);
  const end=new Date(start); end.setDate(start.getDate()+6);
  const iso=d=>d.toISOString().slice(0,10);
  return {start:iso(start),end:iso(end),label:(start.getMonth()+1)+'/'+start.getDate()+' ～ '+(end.getMonth()+1)+'/'+end.getDate()};
}
function projectDateInRange(s,a,b){return !!s && s>=a && s<=b}
function projectTimeline(id){
  const p=data.projects.find(x=>x.id===id),w=projectWeekRange(),steps=p.steps||[];
  const active=steps.filter(s=>{
    if(!s.start&&!s.end)return false;
    const a=s.start||s.end,b=s.end||s.start;
    return a<=w.end&&b>=w.start;
  });
  const upcoming=steps.filter(s=>s.start&&s.start>w.end).sort((a,b)=>a.start.localeCompare(b.start)).slice(0,5);
  const weekDone=active.filter(s=>s.done).length;
  let html='<div class="card"><div class="row"><div style="flex:1"><b>本週進度</b><div class="muted">'+esc(w.label)+'｜依工程項目的開始／結束日期判斷</div></div><span class="tag">'+weekDone+'/'+active.length+' 完成</span></div>';
  if(active.length) html+=active.map((s,i)=>'<div class="row" style="cursor:pointer" onclick="stepDetail('+id+','+p.steps.indexOf(s)+')"><div class="dot '+(s.done?'checked':'')+'">'+(s.done?'✓':'')+'</div><div style="flex:1"><b>'+esc(s.name)+'</b><div class="muted">'+esc(s.trade)+'　'+esc(fmtDate(s.start||''))+' ～ '+esc(fmtDate(s.end||s.start||''))+'</div></div><span class="tag">'+(s.done?'完成':'本週')+'</span></div>').join('');
  else html+='<div class="empty">本週尚未排定工程。<br><span class="muted">點下面的工項即可設定開始／結束日期。</span></div>';
  html+='</div>';
  if(upcoming.length) html+='<div class="section"><b>接下來</b><span class="muted">最近 5 項</span></div><div class="card">'+upcoming.map(s=>'<div class="row" style="cursor:pointer" onclick="stepDetail('+id+','+p.steps.indexOf(s)+')"><div style="flex:1"><b>'+esc(s.name)+'</b><div class="muted">'+esc(s.trade)+'　'+esc(fmtDate(s.start))+' ～ '+esc(fmtDate(s.end||s.start))+'</div></div><span class="tag">'+esc(fmtDate(s.start))+'</span></div>').join('')+'</div>';
  return html;
}
function projectTradeView(id){
  const p=data.projects.find(x=>x.id===id),steps=p.steps||[],trades=[];
  steps.forEach(s=>{if(!trades.includes(s.trade||'自訂'))trades.push(s.trade||'自訂')});
  return '<div class="section"><b>依工種查看</b><span class="muted">'+trades.length+' 個工種</span></div>'+trades.map(t=>{
    const arr=steps.map((s,i)=>({s,i})).filter(x=>(x.s.trade||'自訂')===t);
    const done=arr.filter(x=>x.s.done).length;
    return '<div class="card"><div class="row"><div style="flex:1"><b>'+esc(t)+'</b><div class="muted">'+done+'/'+arr.length+' 完成</div></div><span class="tag">'+Math.round(done/Math.max(1,arr.length)*100)+'%</span></div>'+arr.map(x=>'<div class="row" style="cursor:pointer" onclick="stepDetail('+id+','+x.i+')"><div class="dot '+(x.s.done?'checked':'')+'">'+(x.s.done?'✓':'')+'</div><div style="flex:1"><b>'+esc(x.s.name)+'</b><div class="muted">'+(x.s.start?esc(fmtDate(x.s.start)+' ～ '+fmtDate(x.s.end||x.s.start)):'尚未排定')+'</div></div></div>').join('')+'</div>';
  }).join('')||'<div class="empty">目前沒有工項。</div>';
}
function openProjectView(id,view){
  const p=data.projects.find(x=>x.id===id); if(!p)return;
  if(view==='time'){main.innerHTML='<button class="back" onclick="openProject('+id+')">← 返回工程</button><div class="card"><span class="tag">時間</span><h2>'+esc(p.name)+'</h2><div class="muted">用本週與接下來的工期快速掌握進度</div></div>'+projectTimeline(id);return;}
  if(view==='trade'){main.innerHTML='<button class="back" onclick="openProject('+id+')">← 返回工程</button><div class="card"><span class="tag">工種</span><h2>'+esc(p.name)+'</h2><div class="muted">依水電、木作、泥作等工種查看本工程</div></div>'+projectTradeView(id);return;}
  openProject(id);
}
function openProject(id){let p=data.projects.find(x=>x.id===id),cur=p.steps.findIndex(x=>!x.done);if(cur<0)cur=p.steps.length-1;let s=p.steps[cur];main.innerHTML='<button class="back" onclick="home()">← 返回</button><div class="card"><span class="tag">'+esc(p.status)+'</span><h2>'+esc(p.name)+'</h2><div class="muted">'+esc(p.client)+'</div><div style="margin:15px 0 7px" class="bar"><div class="fill" style="width:'+progress(p)+'%"></div></div><b>'+progress(p)+'%</b></div><div class="section"><b>工程檢視</b></div><div class="grid"><button onclick="openProjectView('+id+',\'time\')">◷ 時間／本週進度</button><button onclick="openProjectView('+id+',\'trade\')">☷ 依工種查看</button></div><div class="section"><b>施工流程</b><div><button class="light" onclick="reorderProject('+id+')">編排</button> <button onclick="addProjectStep('+id+')">＋ 自訂工項</button></div></div><div class="card">'+p.steps.map((x,i)=>'<div class="row" onclick="stepDetail('+id+','+i+')"><div class="dot '+(x.done?'checked':'')+'">'+(x.done?'✓':'')+'</div><div style="flex:1"><b style="'+(x.done?'text-decoration:line-through;color:#999':'')+'">'+esc(x.name)+'</b><div class="muted">'+esc(x.trade)+'　'+(x.start?esc(fmtDate(x.start)+' ～ '+fmtDate(x.end||x.start)):'尚未排定')+'　→ '+esc(x.next||'未設定')+'</div></div></div>').join('')+'</div><div class="section"><b>現在建議處理</b></div><div class="current"><span class="tag">NOW</span><h3 style="margin-top:10px">'+esc(s.name)+'</h3><div class="muted">'+esc(s.trade)+'</div>'+s.notes.map(n=>'<div class="warn">□ '+esc(n)+'</div>').join('')+'<div class="next"><div class="muted">完成後下一步</div><b>→ '+esc(s.next||'請自行設定')+'</b></div><button style="width:100%;margin-top:13px" onclick="completeStep('+id+','+cur+')">完成此工項</button></div><div class="grid"><button onclick="newIssue('+id+')">⚠ 新增問題</button><button onclick="report('+id+')">📝 工程日報</button></div>'}
function reorderProject(id){let p=data.projects.find(x=>x.id===id);openModal('<h2>編排施工順序</h2><div class="hint">由上到下就是施工順序。按 ↑ ↓ 調整，系統會同步更新「下一步」提示。</div>'+p.steps.map((s,i)=>'<div class="card" style="padding:12px"><b>'+esc(s.name)+'</b><div class="muted">'+esc(s.trade)+'</div><div style="margin-top:8px"><button class="orderbtn" onclick="moveProjectStep('+id+','+i+',-1)">↑ 上移</button> <button class="orderbtn" onclick="moveProjectStep('+id+','+i+',1)">↓ 下移</button></div></div>').join('')+'<button style="width:100%" onclick="closeModal();openProject('+id+')">完成編排</button>')}
function moveProjectStep(id,i,dir){let p=data.projects.find(x=>x.id===id),n=i+dir;if(n<0||n>=p.steps.length)return;[p.steps[i],p.steps[n]]=[p.steps[n],p.steps[i]];p.steps.forEach((s,k)=>s.next=(k<p.steps.length-1?p.steps[k+1].name:''));save();closeModal();reorderProject(id)}

function completeStep(id,i){data.projects.find(p=>p.id===id).steps[i].done=true;save();openProject(id)}
function stepDetail(id,i){let p=data.projects.find(x=>x.id===id),s=p.steps[i];let opts='<option value="">未設定</option>'+p.steps.map((x,j)=>'<option value="P:'+j+'" '+(x.name===s.next?'selected':'')+'>'+esc(x.trade+'｜'+x.name)+'</option>').join('');openModal('<h2>編輯工項</h2><label>工項名稱</label><input id="sn" value="'+esc(s.name)+'"><label>工種</label><input id="st" value="'+esc(s.trade)+'"><div class="grid"><div><label>開始日期</label><input id="ss" type="date" value="'+esc(s.start||'')+'"></div><div><label>結束日期</label><input id="se" type="date" value="'+esc(s.end||'')+'"></div></div><div class="hint">設定日期後，「時間／本週進度」會自動判斷本週工程。</div><label>下一個工程銜接</label><select id="snext">'+opts+'</select><div class="hint">可以銜接到本工程任何工項，例如「水電→木作」。</div><div class="section"><b>注意事項</b><button class="light" onclick="addNote('+id+','+i+')">＋ 新增</button></div>'+s.notes.map((n,j)=>'<div class="row"><div style="flex:1">□ '+esc(n)+'</div><button class="orderbtn" onclick="editNote('+id+','+i+','+j+')">編輯</button><span class="danger" onclick="delNote('+id+','+i+','+j+')">×</span></div>').join('')+(s.libraryTrade&&s.libraryItem?'<div class="hint">來源：工種庫 → '+esc(s.libraryTrade)+'｜'+esc(s.libraryItem)+'　<button class="light" style="padding:5px 8px;margin-left:4px" onclick="viewProjectLibrarySource(\''+esc(s.libraryTrade)+'\',\''+esc(s.libraryItem)+'\')">查看工種庫資料</button></div>':'')+'<div class="actions" style="margin-top:15px"><button class="light" onclick="closeModal()">取消</button><button onclick="saveStepEdit('+id+','+i+')">儲存修改</button></div>')}
function saveStepEdit(id,i){let p=data.projects.find(x=>x.id===id),s=p.steps[i];s.name=document.getElementById('sn').value;s.trade=document.getElementById('st').value||'自訂';s.start=document.getElementById('ss').value;s.end=document.getElementById('se').value;if(s.start&&s.end&&s.end<s.start){alert('結束日期不能早於開始日期');return;}let v=document.getElementById('snext').value;if(!v)s.next='';else if(v.indexOf('P:')===0)s.next=p.steps[+v.slice(2)].name;else{let a=v.split(':');s.next='【'+data.trades[+a[1]].name+'】 '+data.trades[+a[1]].items[+a[2]][0]}save();closeModal();openProject(id)}

function viewProjectLibrarySource(tradeName,itemName){const src=libraryItemSource(tradeName,itemName);if(!src){alert('工種庫中找不到原始資料，這個工程項目仍可獨立使用。');return;}closeModal();if(src.source==='2022')exampleLibraryItemDetail(src.ti,src.j);else libraryDetail(src.customIndex,src.j)}
function addNote(id,i){let n=prompt('新增注意事項');if(n){data.projects.find(p=>p.id===id).steps[i].notes.push(n);save();closeModal();stepDetail(id,i)}}
function editNote(id,i,j){let a=data.projects.find(p=>p.id===id).steps[i].notes,n=prompt('修改注意事項',a[j]);if(n!==null&&n.trim()){a[j]=n.trim();save();closeModal();stepDetail(id,i)}}
function delNote(id,i,j){data.projects.find(p=>p.id===id).steps[i].notes.splice(j,1);save();closeModal();stepDetail(id,i)}
function addProjectStep(id){openModal('<h2>新增自訂工項</h2><label>工項名稱</label><input id="n"><label>工種</label><input id="t"><label>下一步</label><input id="nx"><label>注意事項（每行一項）</label><textarea id="nt"></textarea><div class="actions"><button class="light" onclick="closeModal()">取消</button><button onclick="saveStep('+id+')">加入</button></div>')}
function saveStep(id){if(!n.value)return;data.projects.find(p=>p.id===id).steps.push({name:n.value,trade:t.value||'自訂',next:nx.value,notes:nt.value.split('\n').filter(Boolean),done:false});save();closeModal();openProject(id)}
function newProject(){
  const groups=libraryGroups();
  openModal('<h2>新增工程</h2><label>工程名稱</label><input id="pn" placeholder="例如：SWD2601｜陳宅"><label>業主／公司</label><input id="pc"><div class="section"><b>從工種庫套用施工項目</b></div><div class="hint">2022 工程範例的施工項目與工種庫新增內容都可以直接勾選。帶入後會成為本工程自己的內容，可獨立修改。</div>'+
    (groups.length?groups.map((t,i)=>'<div class="card" style="padding:12px"><b>'+esc(t.name)+'</b> <span class="tag" style="float:right">'+(t.source==='2022'?'2022':'工種庫')+'</span>'+t.items.map((it,j)=>'<label class="row" style="cursor:pointer"><input type="checkbox" class="libItem" value="'+i+':'+j+'" style="width:20px;height:20px;margin:0;flex:none"><span style="flex:1"><b>'+esc(it[0])+'</b><div class="muted">下一步：'+esc(it[2]||'未設定')+'</div></span></label>').join('')+'</div>').join(''):'<div class="empty">工種庫目前沒有資料。</div>')+
    '<div class="actions"><button class="light" onclick="closeModal()">取消</button><button onclick="saveProject()">建立</button></div>');
}
function saveProject(){
  if(!pn.value.trim())return;
  const groups=libraryGroups();
  let steps=[];
  document.querySelectorAll('.libItem:checked').forEach(c=>{const [gi,j]=c.value.split(':').map(Number),g=groups[gi],it=g.items[j];steps.push({name:it[0],trade:g.name,next:libraryNextLabel(g.source,g.ti,j,it[2]),notes:[...(it[1]||[])],done:false,libraryTrade:g.name,libraryItem:it[0],librarySource:g.source});});
  if(!steps.length)steps=[{name:'現場確認',trade:'自訂',next:'請新增工項',notes:['確認圖面','確認現場條件'],done:false}];
  data.projects.push({id:Date.now(),name:pn.value.trim(),client:pc.value||'未設定',status:'進行中',steps,issueCount:0});save();closeModal();projects()
}
function newIssue(pid=0){openModal('<h2>新增問題</h2><label>問題</label><input id="it"><label>說明</label><textarea id="ino"></textarea><label>優先度</label><select id="ip"><option>高</option><option>中</option><option>低</option></select><div class="actions"><button class="light" onclick="closeModal()">取消</button><button onclick="saveIssue('+pid+')">建立</button></div>')}
function saveIssue(pid){if(!it.value)return;let p=data.projects.find(x=>x.id===pid);data.issues.unshift({title:it.value,note:ino.value,priority:ip.value,status:'待確認',project:p?p.name:'未指定',date:new Date().toLocaleDateString('zh-TW')});if(p)p.issueCount=(p.issueCount||0)+1;save();closeModal();issues()}
function report(id){openModal('<h2>工程日報</h2><div class="muted">'+esc(data.projects.find(p=>p.id===id).name)+'</div><textarea placeholder="今天完成什麼？發現什麼問題？"></textarea><button style="width:100%">📷 加入照片（下一版）</button><div class="actions" style="margin-top:12px"><button onclick="closeModal()">取消</button><button onclick="closeModal()">儲存</button></div>')}
function newTrade(){openModal('<h2>新增工種</h2><label>工種名稱</label><input id="tn"><label>第一個工項</label><input id="ti"><label>注意事項（每行一項）</label><textarea id="tno"></textarea><label>下一步</label><input id="tnx"><div class="actions"><button class="light" onclick="closeModal()">取消</button><button onclick="saveTrade()">建立</button></div>')}
function saveTrade(){if(!tn.value||!ti.value)return;data.trades.push({name:tn.value,items:[[ti.value,tno.value.split('\n').filter(Boolean),tnx.value]]});save();closeModal();exampleSchedule()}
function editTrade(i){let t=data.trades[i];openModal('<h2>編輯 '+esc(t.name)+'</h2><label>工種名稱</label><input id="en" value="'+esc(t.name)+'"><div class="hint">施工順序由上到下。按 ↑ ↓ 就能自己重新排列；點「編輯」可以修改工項內容。</div>'+t.items.map((it,j)=>'<div class="card" style="padding:12px"><div><b>'+esc(it[0])+'</b><span class="tag" style="float:right">'+it[1].length+' 項提醒</span></div><div class="muted" style="margin:6px 0 10px">下一步 → '+esc(it[2]||'未設定')+'</div><div><button class="orderbtn" onclick="moveTradeItem('+i+','+j+',-999)">置頂</button> <button class="orderbtn" onclick="moveTradeItem('+i+','+j+',-1)">↑ 上移</button> <button class="orderbtn" onclick="moveTradeItem('+i+','+j+',1)">↓ 下移</button> <button class="editbtn" onclick="editTradeItem('+i+','+j+')">編輯內容</button> <span class="danger" onclick="removeItem('+i+','+j+')">刪除</span></div></div>').join('')+'<button class="light" onclick="addTradeItem('+i+')">＋ 新增工項</button><div class="actions" style="margin-top:12px"><button class="light" onclick="closeModal()">取消</button><button onclick="saveTradeName('+i+')">儲存工種</button></div>')}

function editTradeItem(ti,j){let t=data.trades[ti],it=t.items[j];let opts='<option value="">未設定</option>'+(data.trades||[]).map((tr,a)=>tr.items.map((x,k)=>'<option value="'+a+':'+k+'" '+((it[2]||'')===('【'+tr.name+'】 '+x[0])?'selected':'')+'>'+esc(tr.name+'｜'+x[0])+'</option>').join('')).join('');openModal('<h2>編輯工項</h2><label>工項名稱</label><input id="ein" value="'+esc(it[0])+'"><label>下一個工程銜接</label><select id="einext">'+opts+'</select><div class="hint">可以直接接到其他工種，例如泥作完成後 → 木作放樣。</div><div class="section"><b>注意事項</b><button class="light" onclick="addTradeNote('+ti+','+j+')">＋ 新增</button></div>'+it[1].map((n,k)=>'<div class="row"><div style="flex:1">□ '+esc(n)+'</div><button class="orderbtn" onclick="editTradeNote('+ti+','+j+','+k+')">編輯</button><span class="danger" onclick="removeTradeNote('+ti+','+j+','+k+')">×</span></div>').join('')+'<div class="actions" style="margin-top:15px"><button class="light" onclick="editTrade('+ti+')">返回</button><button onclick="saveTradeItem('+ti+','+j+')">儲存修改</button></div>')}
function editTradeNote(ti,j,k){let a=data.trades[ti].items[j][1],n=prompt('修改注意事項',a[k]);if(n!==null&&n.trim()){a[k]=n.trim();save();closeModal();editTradeItem(ti,j)}}

function saveTradeItem(ti,j){let it=data.trades[ti].items[j];it[0]=document.getElementById('ein').value||it[0];let v=document.getElementById('einext').value;if(v==='')it[2]='';else{let a=v.split(':');it[2]='【'+data.trades[+a[0]].name+'】 '+data.trades[+a[0]].items[+a[1]][0]}save();closeModal();editTrade(ti)}
function addTradeNote(ti,j){let n=prompt('新增注意事項');if(n){data.trades[ti].items[j][1].push(n);save();closeModal();editTradeItem(ti,j)}}
function removeTradeNote(ti,j,k){data.trades[ti].items[j][1].splice(k,1);save();closeModal();editTradeItem(ti,j)}
function moveTradeItem(ti,j,dir){let a=data.trades[ti].items;if(dir===-999){let x=a.splice(j,1)[0];a.unshift(x)}else{let n=j+dir;if(n<0||n>=a.length)return;[a[j],a[n]]=[a[n],a[j]]}a.forEach((it,k)=>it[2]=(k<a.length-1?a[k+1][0]:''));save();closeModal();editTrade(ti)}

function saveTradeName(i){data.trades[i].name=en.value;save();closeModal();exampleSchedule()}
function addTradeItem(i){let n=prompt('工項名稱');if(!n)return;let no=prompt('注意事項，每項用「、」分隔')||'';let nx=prompt('下一步')||'';data.trades[i].items.push([n,no.split('、').filter(Boolean),nx]);save();closeModal();exampleSchedule()}
function removeItem(i,j){data.trades[i].items.splice(j,1);save();closeModal();exampleSchedule()}
function openModal(c){window.sheet=document.getElementById('sheet');window.modal=document.getElementById('modal');if(!window.sheet||!window.modal)return;window.sheet.innerHTML=c;syncDomIdGlobals();window.modal.style.display='flex'}function closeModal(){const m=document.getElementById('modal');if(m)m.style.display='none'}
// 分類「編輯」使用事件委派，避免重新渲染工程進度表後 inline onclick 失效。
document.addEventListener('click',function(e){
  const btn=e.target.closest ? e.target.closest('.scheduleGroupEditBtn') : null;
  if(!btn)return;
  e.preventDefault();
  e.stopPropagation();
  const idx=parseInt(btn.getAttribute('data-group-index'),10);
  if(Number.isFinite(idx)) window.editScheduleGroup(idx);
},true);
home(document.querySelector('nav button'));
