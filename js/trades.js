let libraryExpanded=new Set();
function library(e){
  nav(e);
  main.innerHTML='<div class="library-screen"><div class="section"><div><b>工種庫</b><div class="muted">施工知識與施工範本</div></div><button class="light" onclick="newLibraryTrade()">＋ 新增工種</button></div><input type="search" aria-label="搜尋工種或施工項目" placeholder="搜尋工種或施工項目…" oninput="renderLibraryGroups(this.value)"><div id="libraryGroupList"></div></div>';
  renderLibraryGroups('');
}
function renderLibraryGroups(query){
  const q=String(query||'').trim().toLocaleLowerCase();
  document.getElementById('libraryGroupList').innerHTML=libraryGroups().map(t=>{
    const source=t.source,index=source==='2022'?t.ti:t.customIndex,key=source+':'+index;
    const rows=(t.items||[]).map((item,j)=>({item,j})),matches=rows.filter(row=>String(row.item[0]).toLocaleLowerCase().includes(q));
    if(q&&!t.name.toLocaleLowerCase().includes(q)&&!matches.length)return '';
    const preview=(q?matches:rows).slice(0,5),extra=(q?matches:rows).length-preview.length;
    return `<section class="card library-trade-card"><button class="library-trade-link" onclick="openLibraryTrade('${source}',${index})"><span class="library-trade-head"><b>${esc(t.name)}</b><span class="muted">${rows.length} 個施工項目 ›</span></span><span class="library-preview">${preview.map(row=>esc(row.item[0])).join(' · ')}${extra?' · +'+extra:''}</span></button><details ${libraryExpanded.has(key)?'open':''} ontoggle="rememberLibraryExpanded('${key}',this.open)"><summary>展開施工項目</summary>${(q&&!t.name.toLocaleLowerCase().includes(q)?matches:rows).map(row=>`<button class="library-subitem row" onclick="libraryDetailBySource('${source}',${index},${row.j})"><span>${esc(row.item[0])}</span><span>›</span></button>`).join('')}</details></section>`;
  }).join('')||'<div class="empty">找不到符合的工種或施工項目</div>';
}
const libraryOuterNoteFilters={};
function libraryOuterTradeNotesHTML(trade,source,index){
  const filter=libraryOuterNoteFilters[source+':'+index]||'全部';
  const notes=(trade.notes||[]).map((text,i)=>({text,i,category:trade.noteCategories?.[i]||'未分類'})).filter(note=>filter==='全部'||note.category===filter);
  return `<div class="library-note-filters" role="group" aria-label="注意事項分類">${LIBRARY_NOTE_CATEGORIES.map(category=>`<button type="button" class="light" aria-pressed="${category===filter}" onclick="filterLibraryOuterNotes(this,'${source}',${index},'${category}')">${esc(category)}</button>`).join('<span aria-hidden="true">｜</span>')}</div><div class="library-note-rows">${notes.length?notes.map(note=>`<div class="row"><div class="library-note-text"><span class="library-note-category">${esc(note.category)}</span>${esc(note.text)}</div><button class="orderbtn" onclick="editLibraryTradeNote('${source}',${index},${note.i},true)">編輯</button><button class="light" onclick="removeLibraryTradeNote('${source}',${index},${note.i},true)">刪除</button></div>`).join(''):'<div class="empty">此分類尚無注意事項</div>'}</div>`;
}
function filterLibraryOuterNotes(button,source,index,category){
  libraryOuterNoteFilters[source+':'+index]=category;
  const trade=source==='2022'?data.trades[index]:libData[index];
  const filters=button.closest('.library-note-filters'),rows=filters.nextElementSibling;
  const content=document.createElement('div');
  content.innerHTML=libraryOuterTradeNotesHTML(trade,source,index);
  filters.replaceWith(content.firstElementChild);
  rows.replaceWith(content.firstElementChild);
}
function rememberLibraryExpanded(key,open){if(open)libraryExpanded.add(key);else libraryExpanded.delete(key);}
function openLibraryTrade(source,index){const t=source==='2022'?data.trades[index]:libData[index];if(t)libraryTradeDetail(t.name,source,index,index);}

function libraryTradeDetail(tradeName,source,ti,customIndex){
  let t=null,notes=[];
  if(source==='2022' && data.trades[ti]){ t=data.trades[ti]; notes=Array.isArray(t.notes)?t.notes:[]; }
  else if(source==='custom' && libData[customIndex]){ t=libData[customIndex]; notes=Array.isArray(t.notes)?t.notes:[]; }
  if(!t)return library();
  const items=t.items||[], index=source==='2022'?ti:customIndex;
  main.innerHTML=`<div class="library-screen"><button class="back" onclick="library()">← 返回工種庫</button>
    <div class="card"><h2 class="library-trade-title">${esc(t.name)}</h2><div class="muted">施工知識與施工範本</div></div>
    <div class="section"><b>施工項目</b><button class="light" onclick="toggleLibraryListEditing('${source}',${index})">${libraryListEditing?'完成':'編輯'}</button></div>
    <div class="card library-subitems">${items.length?items.map((it,j)=>`<div class="row"><button class="library-subitem" style="flex:1;min-width:0" onclick="libraryDetailBySource('${esc(source)}',${index},${j})">${esc(it[0])} ›</button>${libraryListEditing?libraryRowMenu(`<button onclick="editLibrarySourceItem('${source}',${index},${j})">編輯</button><button onclick="deleteLibrarySourceItem('${source}',${index},${j})">刪除</button><button ${j===0?'disabled':''} onclick="moveLibrarySourceItem('${source}',${index},${j},-1)">上移</button><button ${j===items.length-1?'disabled':''} onclick="moveLibrarySourceItem('${source}',${index},${j},1)">下移</button>`):''}</div>`).join(''):'<div class="empty">尚未設定施工項目</div>'}</div>
    <button class="light" style="margin-top:12px" onclick="addLibrarySourceItem('${esc(source)}',${index})">＋ 新增施工項目</button>
    ${(t.notes||[]).length||Array.isArray(t.photos)&&t.photos.length?'<div class="hint" style="margin-top:20px">原有未分類的工種注意事項與參考照片已保留，未自動改綁到施工項目，避免資料誤歸屬。</div>':''}</div>`;
}

function addLibrarySourceItem(source,index){
  editLibrarySourceItem(source,index,-1);
}

function libraryDetailBySource(source,index,j){
  if(source==='2022')return exampleLibraryItemDetail(index,j);
  return libraryDetail(index,j);
}

function libraryDetail(ti,j){return renderLibraryItem('custom',ti,j);}

// Both existing library sources use the same editor; project completion is never toggled here.
function libraryItemRef(source,index,j){return (source==='2022'?data.trades[index]:libData[index])?.items?.[j];}
function saveLibrarySource(source){source==='2022'?save():saveLib();}
function libraryRowMenu(content){return '<details class="library-menu"><summary aria-label="項目操作">⋯</summary><div>'+content+'</div></details>';}
function libraryContentMenu(source,index,j,kind,k,length){
  const args="'"+source+"',"+index+','+j+",'"+kind+"',"+k;
  return libraryRowMenu('<button onclick="libraryContentAction('+args+',\'edit\')">編輯</button><button onclick="libraryContentAction('+args+',\'delete\')">刪除</button>'+(kind==='check'?'<button '+(k===0?'disabled':'')+' onclick="libraryContentAction('+args+',\'up\')">上移</button><button '+(k===length-1?'disabled':'')+' onclick="libraryContentAction('+args+',\'down\')">下移</button>':''));
}
function renderLibraryItem(source,index,j,notesOpen=false){
  const trade=source==='2022'?data.trades[index]:libData[index],item=trade?.items?.[j];if(!item)return library();
  const checks=Array.isArray(item[6])?item[6]:[],notes=Array.isArray(item[1])?item[1]:[];
  const visible=notes.map((text,k)=>({text,k})).filter(note=>libraryConstructionNotes([note.text],checks).length);
  const args="'"+source+"',"+index+','+j;
  main.innerHTML='<div class="library-screen"><button class="back" onclick="openLibraryTrade(\''+source+'\','+index+')">← 返回施工項目</button>'+
    '<div class="section"><div><span class="muted">'+esc(trade.name)+'</span><h2>'+esc(item[0])+'</h2></div>'+libraryRowMenu('<button onclick="editLibrarySourceItem('+args+')">編輯施工項目</button><button onclick="deleteLibrarySourceItem('+args+')">刪除施工項目</button>')+'</div>'+
    '<div class="section"><b>工程 Checklist</b><span class="muted">'+checks.length+' 項範本</span></div><div class="library-content">'+checks.map((check,k)=>'<div class="row"><span aria-hidden="true">□</span><span class="library-row-text">'+esc(check.text||check.label||check)+'</span>'+libraryContentMenu(source,index,j,'check',k,checks.length)+'</div>').join('')+
    '<button class="library-add" onclick="showLibraryContentForm(\'check\')">＋ 新增確認項目</button><form id="library-check-form" hidden onsubmit="addLibraryContent(event,'+args+',\'check\')"><input name="text" required placeholder="輸入 Checklist 項目…"><button class="light">新增</button></form></div>'+
    '<details class="library-notes" '+(notesOpen?'open':'')+'><summary class="section"><b>施工筆記</b><span class="muted">'+visible.length+'則 ⌄</span></summary><div class="library-content">'+visible.map(note=>'<div class="row"><span class="library-row-text">'+esc(note.text)+'</span>'+libraryContentMenu(source,index,j,'note',note.k,notes.length)+'</div>').join('')+
    '<button class="library-add" onclick="showLibraryContentForm(\'note\')">＋ 新增施工筆記</button><form id="library-note-form" hidden onsubmit="addLibraryContent(event,'+args+',\'note\')"><textarea name="text" required placeholder="輸入施工筆記…"></textarea><button class="light">新增</button></form></div></details>'+
    '<div class="section"><b>參考照片</b></div><div class="library-reference">'+libraryItemPhotosHTML(source,index,j)+'</div></div>';
}
function showLibraryContentForm(kind){const form=document.getElementById('library-'+kind+'-form');form.hidden=false;form.elements.text.focus();}
function addLibraryContent(event,source,index,j,kind){
  event.preventDefault();const text=event.currentTarget.elements.text.value.trim(),item=libraryItemRef(source,index,j);if(!text||!item)return;
  if(source==='2022'&&kind==='note')return librarySharedNotice();
  const slot=kind==='check'?6:1;if(!Array.isArray(item[slot]))item[slot]=[];
  item[slot].push(kind==='check'?{text}:text);saveLibrarySource(source);renderLibraryItem(source,index,j,kind==='note');
}
function libraryContentAction(source,index,j,kind,k,action){
  if(source==='2022'&&kind==='note')return librarySharedNotice();
  const item=libraryItemRef(source,index,j),list=item?.[kind==='check'?6:1];if(!Array.isArray(list)||k<0||k>=list.length)return;
  if(action==='edit'){
    const old=list[k],text=prompt(kind==='check'?'編輯 Checklist 項目':'編輯施工筆記',old.text||old.label||old);
    if(!text?.trim())return;
    if(typeof old==='object'){if('text' in old||!('label' in old))old.text=text.trim();else old.label=text.trim();}else list[k]=text.trim();
  }else if(action==='delete'){if(!confirm('刪除此'+(kind==='check'?' Checklist 項目':'施工筆記')+'？'))return;list.splice(k,1);}
  else{const to=k+(action==='up'?-1:1);if(to<0||to>=list.length)return;[list[k],list[to]]=[list[to],list[k]];}
  saveLibrarySource(source);renderLibraryItem(source,index,j,kind==='note');
}
function librarySharedNotice(){alert('此項目與工程表共用資料。為遵守不修改工程表，需先確認工種庫專用 metadata 方案，才能調整名稱、分類或施工筆記。');}
function editLibrarySourceItem(source,index,j){
  if(source==='2022')return librarySharedNotice();
  const item=libraryItemRef(source,index,j);
  openModal('<h2>'+(item?'編輯':'新增')+'施工項目</h2><label>施工項目名稱</label><input id="libraryItemName" value="'+esc(item?.[0]||'')+'"><label>所屬工種</label><select id="libraryItemTrade">'+libData.map((trade,k)=>'<option value="'+k+'" '+(k===index?'selected':'')+'>'+esc(trade.name)+'</option>').join('')+'</select><div class="actions"><button class="light" onclick="closeModal()">取消</button><button onclick="saveLibrarySourceItem('+index+','+j+')">儲存</button></div>');
}
function saveLibrarySourceItem(index,j){
  const name=document.getElementById('libraryItemName').value.trim(),target=Number(document.getElementById('libraryItemTrade').value);
  if(!name||!libData[target])return;
  let item=j<0?[name,[]]:libData[index]?.items?.[j];if(!item)return;
  item[0]=name;
  if(j<0||target!==index){if(j>=0)libData[index].items.splice(j,1);libData[target].items.push(item);j=libData[target].items.length-1;}
  saveLib();closeModal();renderLibraryItem('custom',target,j);
}
function deleteLibrarySourceItem(source,index,j){
  if(source==='2022')return librarySharedNotice();
  if(!libraryItemRef(source,index,j)||!confirm('刪除此施工範本與其筆記、參考照片？已套用的專案資料不會刪除。'))return;
  libData[index].items.splice(j,1);saveLib();openLibraryTrade(source,index);
}
function moveLibrarySourceItem(source,index,j,dir){
  if(source==='2022')return librarySharedNotice();
  const list=libData[index]?.items,to=j+dir;if(!list||to<0||to>=list.length)return;
  [list[j],list[to]]=[list[to],list[j]];saveLib();openLibraryTrade(source,index);
}
let libraryListEditing=false;
function toggleLibraryListEditing(source,index){libraryListEditing=!libraryListEditing;openLibraryTrade(source,index);}

function newLibraryTrade(){openModal('<h2>新增工種</h2><label>工種名稱</label><input id="ltn" placeholder="例如：拆除工程"><label>第一個施工項目</label><input id="lti" placeholder="例如：現場保護／拆除前確認"><label>注意事項（每行一項）</label><textarea id="ltno"></textarea><label>下一步</label><input id="ltnx" placeholder="例如：清運完成後進入水電放樣"><div class="actions"><button class="light" onclick="closeModal()">取消</button><button onclick="saveLibraryTrade()">建立</button></div>')}

function saveLibraryTrade(){const name=ltn.value.trim(),item=lti.value.trim();if(!name||!item){alert('請填寫工種名稱與第一個施工項目');return;}libData.push({name,items:[[item,ltno.value.split('\n').map(x=>x.trim()).filter(Boolean),ltnx.value.trim()]]});saveLib();closeModal();library()}

function editLibraryTrade(i){const t=libData[i];openModal('<h2>編輯 '+esc(t.name)+'</h2><label>工種名稱</label><input id="len" value="'+esc(t.name)+'"><div class="hint">施工順序由上到下。每個施工項目都可以獨立修改。</div>'+t.items.map((it,j)=>'<div class="card" style="padding:12px"><b>'+esc(it[0])+'</b><div class="muted" style="margin:6px 0 10px">下一步 → '+esc(it[2]||'未設定')+'</div><button class="editbtn" onclick="editLibraryItem('+i+','+j+')">編輯內容</button> <span class="danger" onclick="removeLibraryItem('+i+','+j+')">刪除</span></div>').join('')+'<button class="light" onclick="addLibraryItem('+i+')">＋ 新增施工項目</button><div class="actions" style="margin-top:12px"><button class="light" onclick="closeModal()">取消</button><button onclick="saveLibraryTradeName('+i+')">儲存工種</button></div>')}

function saveLibraryTradeName(i){const n=len.value.trim();if(!n)return;libData[i].name=n;saveLib();closeModal();library()}

function addLibraryItem(i){const n=prompt('施工項目名稱');if(!n)return;const no=prompt('注意事項，每項用「、」分隔')||'';const nx=prompt('下一步')||'';libData[i].items.push([n.trim(),no.split('、').map(x=>x.trim()).filter(Boolean),nx.trim()]);saveLib();closeModal();editLibraryTrade(i)}

function removeLibraryItem(i,j){if(!confirm('刪除此施工項目？'))return;libData[i].items.splice(j,1);saveLib();closeModal();library()}

function editLibraryItem(ti,j){const t=libData[ti],it=t.items[j];openModal('<h2>編輯施工項目</h2><div class="card" style="padding:12px"><span class="tag">'+esc(t.name)+'</span></div><label>施工項目</label><input id="lei" value="'+esc(it[0])+'"><label>注意事項／前置條件（每行一項）</label><textarea id="lenotes">'+esc((it[1]||[]).join('\n'))+'</textarea><label>下一個工程銜接</label><input id="lenext" value="'+esc(it[2]||'')+'" placeholder="例如：泥作放樣完成後 → 木作進場"><div class="actions"><button class="light" onclick="closeModal();editLibraryTrade('+ti+')">取消</button><button onclick="saveLibraryItem('+ti+','+j+')">儲存</button></div>')}

function saveLibraryItem(ti,j){const it=libData[ti].items[j];it[0]=lei.value.trim()||it[0];it[1]=lenotes.value.split('\n').map(x=>x.trim()).filter(Boolean);it[2]=lenext.value.trim();saveLib();closeModal();libraryDetail(ti,j)}

function newTrade(){openModal('<h2>新增工種</h2><label>工種名稱</label><input id="tn"><label>第一個工項</label><input id="ti"><label>注意事項（每行一項）</label><textarea id="tno"></textarea><label>下一步</label><input id="tnx"><div class="actions"><button class="light" onclick="closeModal()">取消</button><button onclick="saveTrade()">建立</button></div>')}

function saveTrade(){if(!tn.value||!ti.value)return;data.trades.push({name:tn.value,items:[[ti.value,tno.value.split('\n').filter(Boolean),tnx.value]]});save();closeModal();exampleSchedule()}

function editTrade(i){let t=data.trades[i];openModal('<h2>編輯 '+esc(t.name)+'</h2><label>工種名稱</label><input id="en" value="'+esc(t.name)+'"><div class="hint">施工順序由上到下。按 ↑ ↓ 就能自己重新排列；點「編輯」可以修改工項內容。</div>'+t.items.map((it,j)=>'<div class="card" style="padding:12px"><div><b>'+esc(it[0])+'</b><span class="tag" style="float:right">'+it[1].length+' 項提醒</span></div><div class="muted" style="margin:6px 0 10px">下一步 → '+esc(it[2]||'未設定')+'</div><div><button class="orderbtn" onclick="moveTradeItem('+i+','+j+',-999)">置頂</button> <button class="orderbtn" onclick="moveTradeItem('+i+','+j+',-1)">↑ 上移</button> <button class="orderbtn" onclick="moveTradeItem('+i+','+j+',1)">↓ 下移</button> <button class="editbtn" onclick="editTradeItem('+i+','+j+')">編輯內容</button> <span class="danger" onclick="removeItem('+i+','+j+')">刪除</span></div></div>').join('')+'<button class="light" onclick="addTradeItem('+i+')">＋ 新增工項</button><div class="actions" style="margin-top:12px"><button class="light" onclick="closeModal()">取消</button><button onclick="saveTradeName('+i+')">儲存工種</button></div>')}


function editTradeItem(ti,j,returnToSchedule){let t=data.trades[ti],it=t.items[j],backToSchedule=returnToSchedule===true||returnToSchedule===1,returnArg=backToSchedule?1:0;let opts='<option value="">未設定</option>'+(data.trades||[]).map((tr,a)=>tr.items.map((x,k)=>'<option value="'+a+':'+k+'" '+((it[2]||'')===('【'+tr.name+'】 '+x[0])?'selected':'')+'>'+esc(tr.name+'｜'+x[0])+'</option>').join('')).join('');openModal('<h2>編輯工項</h2><label>工項名稱</label><input id="ein" value="'+esc(it[0])+'"><label>下一個工程銜接</label><select id="einext">'+opts+'</select><div class="hint">可以直接接到其他工種，例如泥作完成後 → 木作放樣。</div><div class="section"><b>注意事項</b><button class="light" onclick="addTradeNote('+ti+','+j+','+returnArg+')">＋ 新增</button></div>'+it[1].map((n,k)=>'<div class="row"><div style="flex:1">□ '+esc(n)+'</div><button class="orderbtn" onclick="editTradeNote('+ti+','+j+','+k+','+returnArg+')">編輯</button><span class="danger" onclick="removeTradeNote('+ti+','+j+','+k+','+returnArg+')">×</span></div>').join('')+'<div class="actions" style="margin-top:15px"><button class="light" onclick="'+(backToSchedule?'closeModal();exampleSchedule()':'editTrade('+ti+')')+'">返回</button><button onclick="saveTradeItem('+ti+','+j+','+returnArg+')">儲存修改</button></div>')}

function editTradeNote(ti,j,k,returnToSchedule){let a=data.trades[ti].items[j][1],n=prompt('修改注意事項',a[k]);if(n!==null&&n.trim()){a[k]=n.trim();save();closeModal();editTradeItem(ti,j,returnToSchedule)}}


function saveTradeItem(ti,j,returnToSchedule){let it=data.trades[ti].items[j];it[0]=document.getElementById('ein').value||it[0];let v=document.getElementById('einext').value;if(v==='')it[2]='';else{let a=v.split(':');it[2]='【'+data.trades[+a[0]].name+'】 '+data.trades[+a[0]].items[+a[1]][0]}save();closeModal();if(returnToSchedule===true||returnToSchedule===1)exampleSchedule();else editTrade(ti)}

function addTradeNote(ti,j,returnToSchedule){let n=prompt('新增注意事項');if(n){data.trades[ti].items[j][1].push(n);save();closeModal();editTradeItem(ti,j,returnToSchedule)}}

function removeTradeNote(ti,j,k,returnToSchedule){data.trades[ti].items[j][1].splice(k,1);save();closeModal();editTradeItem(ti,j,returnToSchedule)}

function moveTradeItem(ti,j,dir){let a=data.trades[ti].items;if(dir===-999){let x=a.splice(j,1)[0];a.unshift(x)}else{let n=j+dir;if(n<0||n>=a.length)return;[a[j],a[n]]=[a[n],a[j]]}a.forEach((it,k)=>it[2]=(k<a.length-1?a[k+1][0]:''));save();closeModal();editTrade(ti)}


function saveTradeName(i){data.trades[i].name=en.value;save();closeModal();exampleSchedule()}

function addTradeItem(i){let n=prompt('工項名稱');if(!n)return;let no=prompt('注意事項，每項用「、」分隔')||'';let nx=prompt('下一步')||'';data.trades[i].items.push([n,no.split('、').filter(Boolean),nx]);save();closeModal();exampleSchedule()}

function removeItem(i,j){data.trades[i].items.splice(j,1);save();closeModal();exampleSchedule()}
