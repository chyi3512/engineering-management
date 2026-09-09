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
