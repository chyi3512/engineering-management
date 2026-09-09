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
