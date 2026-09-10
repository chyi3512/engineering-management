let libraryExpanded=new Set();
function library(e){
  nav(e);const groups=libraryGroups();
  main.innerHTML='<div class="section"><div><b>工種庫</b><div class="muted">施工知識母庫：展開工種查看注意事項與施工項目。</div></div><button onclick="newLibraryTrade()">＋ 新增工種</button></div>'+groups.map(t=>{
    const index=t.source==='2022'?t.ti:t.customIndex,key=t.source+':'+index;
    const source=t.source,trade=source==='2022'?data.trades[index]:libData[index];
    return '<details class="card library-trade-card" '+(libraryExpanded.has(key)?'open':'')+' ontoggle="rememberLibraryExpanded(\''+key+'\',this.open)"><summary><span class="tag">'+(source==='2022'?'2022 工程範例':'工種庫新增')+'</span><b class="library-home-trade-title" style="display:inline-block">'+esc(t.name)+'</b></summary><div class="section"><b>注意事項</b><button class="light" onclick="addLibraryTradeNote(\''+source+'\','+index+',true)">＋ 新增注意事項</button></div>'+libraryOuterTradeNotesHTML(trade,source,index)+'<div class="library-child-summary">'+t.items.map((it,j)=>'<span><b>'+(j+1)+'</b> '+esc(it[0])+'</span>').join('')+'</div><button class="light library-enter" onclick="openLibraryTrade(\''+source+'\','+index+')">查看施工項目與照片 →</button>'+(source==='custom'?' <button class="light" onclick="editLibraryTrade('+index+')">編輯工種</button>':'')+'</details>';
  }).join('');
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
  main.innerHTML=`<button class="back" onclick="library()">← 返回工種庫</button>
    <div class="card"><span class="tag">${source==='2022'?'2022 工程範例':'工種庫新增'}</span><h2 class="library-trade-title">${esc(t.name)}</h2><div class="muted">工種｜${items.length} 個施工項目</div></div>
    ${workflowTemplateSummary(t,source,index)}
    <div class="section"><b>工種注意事項</b><button class="light" onclick="addLibraryTradeNote('${esc(source)}',${index})">＋ 新增</button></div>
    <div class="card">${libraryTradeNotesHTML(t,source,index)}</div>
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
