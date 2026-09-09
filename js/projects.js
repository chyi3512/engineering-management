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

function openProject(id){let p=data.projects.find(x=>x.id===id);if(!p)return;releaseDailyPhotoViews();let siteError='';try{ensureProjectSiteAppointments(p);}catch(error){siteError='到期事項尚未儲存：'+error.message;}let cur=p.steps.findIndex(x=>!x.done);if(cur<0)cur=p.steps.length-1;let s=p.steps[cur]||{name:'尚無工項',trade:'',notes:[],next:''};main.innerHTML='<button class="back" onclick="home()">← 返回</button><div class="card"><span class="tag">'+esc(p.status)+'</span><h2>'+esc(p.name)+'</h2><div class="muted">'+esc(p.client)+'</div><div style="margin:15px 0 7px" class="bar"><div class="fill" style="width:'+progress(p)+'%"></div></div><b>'+progress(p)+'%</b></div>'+projectSiteTopHTML(p)+'<div class="section"><b>工程進度表</b></div><div class="grid"><button class="light" onclick="openProjectSchedule('+id+',\'baseline\')">預估進度（唯讀）</button><button class="light" onclick="openProjectSchedule('+id+',\'actual\')">現場實際進度</button></div><div class="section"><b>工程檢視</b></div><div class="grid"><button onclick="openProjectView('+id+',\'time\')">◷ 時間／本週進度</button><button onclick="openProjectView('+id+',\'trade\')">☷ 依工種查看</button></div><div class="section"><b>現場實際施工流程</b><div><button class="light" onclick="reorderProject('+id+')">編排</button> <button onclick="addProjectStep('+id+')">＋ 自訂工項</button></div></div><div class="card">'+p.steps.map((x,i)=>'<div class="row" onclick="stepDetail('+id+','+i+')"><div class="dot '+(x.done?'checked':'')+'">'+(x.done?'✓':'')+'</div><div style="flex:1"><b style="'+(x.done?'text-decoration:line-through;color:#999':'')+'">'+esc(x.name)+'</b><div class="muted">'+esc(x.trade)+'　'+(x.start?esc(fmtDate(x.start)+' ～ '+fmtDate(x.end||x.start)):'尚未排定')+'　→ '+esc(x.next||'未設定')+'</div></div></div>').join('')+'</div><div class="section"><b>現在建議處理</b></div><div class="current"><span class="tag">NOW</span><h3 style="margin-top:10px">'+esc(s.name)+'</h3><div class="muted">'+esc(s.trade)+'</div>'+projectConfirmationHTML(id,cur,p.steps[cur])+'<div class="next"><div class="muted">完成後下一步</div><b>→ '+esc(s.next||'請自行設定')+'</b></div><button style="width:100%;margin-top:13px" onclick="completeStep('+id+','+cur+')">完成此工項</button></div><div class="grid"><button onclick="newIssue('+id+')">⚠ 新增問題</button><button onclick="report('+id+')">📝 歷史日報</button></div>'+projectSiteBottomHTML(p);bindProjectSite(p);if(siteError)projectSiteMessage(main,siteError);}

function reorderProject(id){let p=data.projects.find(x=>x.id===id);openModal('<h2>編排施工順序</h2><div class="hint">由上到下就是施工順序。按 ↑ ↓ 調整，系統會同步更新「下一步」提示。</div>'+p.steps.map((s,i)=>'<div class="card" style="padding:12px"><b>'+esc(s.name)+'</b><div class="muted">'+esc(s.trade)+'</div><div style="margin-top:8px"><button class="orderbtn" onclick="moveProjectStep('+id+','+i+',-1)">↑ 上移</button> <button class="orderbtn" onclick="moveProjectStep('+id+','+i+',1)">↓ 下移</button></div></div>').join('')+'<button style="width:100%" onclick="closeModal();openProject('+id+')">完成編排</button>')}

function moveProjectStep(id,i,dir){let p=data.projects.find(x=>x.id===id),n=i+dir;if(n<0||n>=p.steps.length)return;[p.steps[i],p.steps[n]]=[p.steps[n],p.steps[i]];p.steps.forEach((s,k)=>s.next=(k<p.steps.length-1?p.steps[k+1].name:''));save();closeModal();reorderProject(id)}


function completeStep(id,i){const s=data.projects.find(p=>p.id===id)?.steps[i];if(!s)return;s.done=true;save();openProject(id)}

function stepDetail(id,i){let p=data.projects.find(x=>x.id===id),s=p.steps[i];let opts='<option value="">未設定</option>'+p.steps.map((x,j)=>'<option value="P:'+j+'" '+(x.name===s.next?'selected':'')+'>'+esc(x.trade+'｜'+x.name)+'</option>').join('');openModal('<h2>編輯工項</h2><label>工項名稱</label><input id="sn" value="'+esc(s.name)+'"><label>工種</label><input id="st" value="'+esc(s.trade)+'"><div class="grid"><div><label>開始日期</label><input id="ss" type="date" value="'+esc(s.start||'')+'"></div><div><label>結束日期</label><input id="se" type="date" value="'+esc(s.end||'')+'"></div></div><div class="hint">設定日期後，「時間／本週進度」會自動判斷本週工程。</div><label>下一個工程銜接</label><select id="snext">'+opts+'</select><div class="hint">可以銜接到本工程任何工項，例如「水電→木作」。</div><div class="section"><b>注意事項</b><button class="light" onclick="addNote('+id+','+i+')">＋ 新增</button></div>'+s.notes.map((n,j)=>'<div class="row"><div style="flex:1">□ '+esc(n)+'</div><button class="orderbtn" onclick="editNote('+id+','+i+','+j+')">編輯</button><span class="danger" onclick="delNote('+id+','+i+','+j+')">×</span></div>').join('')+(s.libraryTrade&&s.libraryItem?'<div class="hint">來源：工種庫 → '+esc(s.libraryTrade)+'｜'+esc(s.libraryItem)+'　<button class="light" style="padding:5px 8px;margin-left:4px" onclick="viewProjectLibrarySource(\''+esc(s.libraryTrade)+'\',\''+esc(s.libraryItem)+'\')">查看工種庫資料</button></div>':'')+'<div class="actions" style="margin-top:15px"><button class="light" onclick="closeModal()">取消</button><button onclick="saveStepEdit('+id+','+i+')">儲存修改</button></div>')}

function saveStepEdit(id,i){
  const p=data.projects.find(x=>x.id===id),s=p.steps[i];
  const name=document.getElementById('sn').value.trim(),trade=document.getElementById('st').value.trim()||'自訂';
  const startInput=document.getElementById('ss'),endInput=document.getElementById('se'),start=startInput.value,end=endInput.value;
  if(!name)return;
  if(startInput.validity.badInput||endInput.validity.badInput||(start&&!isCompleteScheduleDate(start))||(end&&!isCompleteScheduleDate(end)))return;
  if(!scheduleDateRangeValid(start,end)){alert('結束日期不能早於開始日期');return;}
  const v=document.getElementById('snext').value;
  Object.assign(s,{name,trade,start,end,next:v.startsWith('P:')?(p.steps[Number(v.slice(2))]?.name||''):''});
  save();closeModal();openProject(id);
}

function viewProjectLibrarySource(tradeName,itemName){const src=libraryItemSource(tradeName,itemName);if(!src){alert('工種庫中找不到原始資料，這個工程項目仍可獨立使用。');return;}closeModal();if(src.source==='2022')exampleLibraryItemDetail(src.ti,src.j);else libraryDetail(src.customIndex,src.j)}

function addNote(id,i){let n=prompt('新增注意事項');if(n){data.projects.find(p=>p.id===id).steps[i].notes.push(n);save();closeModal();stepDetail(id,i)}}

function editNote(id,i,j){let a=data.projects.find(p=>p.id===id).steps[i].notes,n=prompt('修改注意事項',a[j]);if(n!==null&&n.trim()){a[j]=n.trim();save();closeModal();stepDetail(id,i)}}

function delNote(id,i,j){const s=data.projects.find(p=>p.id===id).steps[i];s.notes.splice(j,1);if(s.noteChecks)s.noteChecks.splice(j,1);save();closeModal();stepDetail(id,i)}

function addProjectStep(id){openModal('<h2>新增自訂工項</h2><label>工項名稱</label><input id="n"><label>工種</label><input id="t"><label>下一步</label><input id="nx"><label>注意事項（每行一項）</label><textarea id="nt"></textarea><div class="actions"><button class="light" onclick="closeModal()">取消</button><button onclick="saveStep('+id+')">加入</button></div>')}

function saveStep(id){if(!n.value)return;data.projects.find(p=>p.id===id).steps.push({name:n.value,trade:t.value||'自訂',next:nx.value,notes:nt.value.split('\n').filter(Boolean),done:false});save();closeModal();openProject(id)}

let newProjectGroups=[];
function newProject(){
  newProjectGroups=libraryGroups();
  openModal('<form id="newProjectForm"><h2>新增工程</h2><label for="projectName">工程名稱</label><input id="projectName" required placeholder="例如：SWD2601｜陳宅"><label for="projectClient">業主／公司</label><input id="projectClient"><label for="projectStart">預估開工日期</label><input id="projectStart" type="date" required value="'+localDateISO(new Date())+'"><div class="section"><b>從工種庫套用施工項目</b></div><div class="hint">勾選大工種可套用全部項目；展開後可個別選取。預估工期以範例的日期間距排定，未設定工期的項目預設 1 天。</div>'+newProjectGroups.map((t,i)=>'<div class="card" style="padding:12px"><div class="row"><button type="button" class="light" aria-expanded="false" aria-controls="projectTradeItems_'+i+'" onclick="toggleProjectTrade(this)">▶</button><label class="project-trade-label"><input type="checkbox" class="projectTrade" value="'+i+'" onchange="selectProjectTrade('+i+',this.checked)"><b>'+esc(t.name)+'</b></label><span class="tag">'+(t.source==='2022'?'2022':'工種庫')+'</span></div><div id="projectTradeItems_'+i+'" hidden>'+t.items.map((it,j)=>'<label class="row"><input type="checkbox" class="libItem" data-group="'+i+'" value="'+i+':'+j+'" onchange="syncProjectTradeSelection('+i+')"><span>'+esc(it[0])+'</span></label>').join('')+'</div></div>').join('')+'<div id="projectFormError" class="hint" role="alert" hidden></div><div class="actions"><button type="button" class="light" onclick="closeModal()">取消</button><button type="submit">建立工程</button></div></form>');
  document.getElementById('newProjectForm').addEventListener('submit',event=>{event.preventDefault();saveProject();});
}
function toggleProjectTrade(button){
  const box=document.getElementById(button.getAttribute('aria-controls'));
  box.hidden=!box.hidden;button.textContent=box.hidden?'▶':'▼';button.setAttribute('aria-expanded',String(!box.hidden));
}
function selectProjectTrade(i,checked){
  document.querySelectorAll('#newProjectForm .libItem[data-group="'+i+'"]').forEach(c=>c.checked=checked);
  syncProjectTradeSelection(i);
}
function syncProjectTradeSelection(i){
  const children=Array.from(document.querySelectorAll('#newProjectForm .libItem[data-group="'+i+'"]'));
  const parent=document.querySelector('#newProjectForm .projectTrade[value="'+i+'"]');
  parent.checked=children.length>0&&children.every(c=>c.checked);
  parent.indeterminate=children.some(c=>c.checked)&&!parent.checked;
}
function localDateISO(date){return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');}
function shiftScheduleDate(start,days){const date=dateObj(start);date.setDate(date.getDate()+days);return localDateISO(date);}
function buildProjectSchedule(selected,start){
  const dates=selected.map(x=>x.it[3]).filter(isCompleteScheduleDate).sort();
  const origin=dates[0];let cursor=0;
  return selected.map(({g,it,j})=>{
    const offset=isCompleteScheduleDate(it[3])?Math.round((dateObj(it[3])-dateObj(origin))/86400000):cursor;
    const duration=scheduleDays(it[3],it[4])||1;
    cursor=Math.max(cursor,offset+duration);
    return {name:it[0],trade:g.name,next:libraryNextLabel(g.source,g.ti,j,it[2]),notes:[...(it[1]||[])],noteChecks:[],siteConfirmed:false,done:false,start:shiftScheduleDate(start,offset),end:shiftScheduleDate(start,offset+duration-1),libraryTrade:g.name,libraryItem:it[0],librarySource:g.source};
  });
}
function freezeSchedule(value){
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freezeSchedule);Object.freeze(value);}
  return value;
}
function initializeProjectSchedules(){
  data.projects.forEach(p=>{
    if(!Array.isArray(p.steps))p.steps=Array.isArray(p.actualSchedule)?p.actualSchedule:[];
    // steps 保持既有持久化格式；actualSchedule 是相同現場資料的相容入口。
    if(!Object.getOwnPropertyDescriptor(p,'actualSchedule')?.get)Object.defineProperty(p,'actualSchedule',{configurable:true,enumerable:false,get(){return this.steps;}});
    if(Array.isArray(p.baselineSchedule))freezeSchedule(p.baselineSchedule);
  });
}
function saveProject(){
  const form=document.getElementById('newProjectForm');if(!form||form.dataset.created==='true')return;
  const name=document.getElementById('projectName').value.trim(),start=document.getElementById('projectStart').value;
  const error=document.getElementById('projectFormError');
  if(!name||!isCompleteScheduleDate(start)){error.hidden=false;error.textContent='請填寫工程名稱與完整有效的開工日期。';return;}
  const selected=Array.from(form.querySelectorAll('.libItem:checked')).map(c=>{const [gi,j]=c.value.split(':').map(Number);return {g:newProjectGroups[gi],it:newProjectGroups[gi].items[j],j};});
  let steps=buildProjectSchedule(selected,start);
  if(!steps.length)steps=[{name:'現場確認',trade:'自訂',next:'請新增工項',notes:['確認圖面','確認現場條件'],noteChecks:[],siteConfirmed:false,done:false,start,end:start}];
  const project={id:Math.max(Date.now(),...data.projects.map(p=>Number(p.id)+1||0)),name,client:document.getElementById('projectClient').value.trim()||'未設定',status:'進行中',steps,baselineSchedule:JSON.parse(JSON.stringify(steps)),baselineCreatedAt:new Date().toISOString(),issueCount:0};
  data.projects.push(project);initializeProjectSchedules();
  try{save();}catch(e){data.projects.pop();error.hidden=false;error.textContent='工程尚未儲存：'+e.message;return;}
  form.dataset.created='true';
  closeModal();projects();
}
function projectConfirmationHTML(id,i,s){
  if(!s)return '<div class="empty">目前沒有工項，請新增工項。</div>';
  return '<label class="warn project-check"><input type="checkbox" '+(s.siteConfirmed?'checked':'')+' onchange="toggleProjectConfirmation('+id+','+i+',this.checked)">現場確認</label>'+(s.notes||[]).map((n,j)=>'<label class="warn project-check"><input type="checkbox" '+(s.noteChecks?.[j]?'checked':'')+' onchange="toggleProjectNote('+id+','+i+','+j+',this.checked)">'+esc(n)+'</label>').join('');
}
function toggleProjectConfirmation(id,i,checked){const s=data.projects.find(p=>p.id===id)?.steps[i];if(s){s.siteConfirmed=!!checked;save();}}
function toggleProjectNote(id,i,j,checked){const s=data.projects.find(p=>p.id===id)?.steps[i];if(s){if(!Array.isArray(s.noteChecks))s.noteChecks=[];s.noteChecks[j]=!!checked;save();}}
function openProjectSchedule(id,kind){
  const p=data.projects.find(p=>p.id===id);if(!p)return;
  const baseline=kind==='baseline',rows=baseline?p.baselineSchedule:p.steps;
  main.innerHTML='<button class="back" onclick="openProject('+id+')">← 返回工程</button><div class="card"><h2>'+esc(p.name)+'</h2><b>'+(baseline?'預估工程進度表（唯讀）':'現場實際工程進度表')+'</b><div class="muted">'+(baseline?'建立工程當下保留的施工計畫':'可修改日期、工種與施工內容')+'</div></div>'+(rows?rows.map((s,i)=>'<div class="card"><b>'+esc(s.name)+'</b><div class="muted">'+esc(s.trade)+'｜'+esc(s.start||'未設定')+' ～ '+esc(s.end||'未設定')+'</div>'+(s.notes||[]).map(n=>'<div class="warn">'+esc(n)+'</div>').join('')+(baseline?'':'<button class="light" onclick="stepDetail('+id+','+i+')">編輯</button>')+'</div>').join(''):'<div class="empty">此舊工程沒有建立當下的預估快照。</div>');
}

function newIssue(pid=0){openModal('<h2>新增問題</h2><label>問題</label><input id="it"><label>說明</label><textarea id="ino"></textarea><label>優先度</label><select id="ip"><option>高</option><option>中</option><option>低</option></select><div class="actions"><button class="light" onclick="closeModal()">取消</button><button onclick="saveIssue('+pid+')">建立</button></div>')}

function saveIssue(pid){if(!it.value)return;let p=data.projects.find(x=>x.id===pid);data.issues.unshift({title:it.value,note:ino.value,priority:ip.value,status:'待確認',project:p?p.name:'未指定',date:new Date().toLocaleDateString('zh-TW')});if(p)p.issueCount=(p.issueCount||0)+1;save();closeModal();issues()}

function report(id){closeModal();openDailyReports(id);}
