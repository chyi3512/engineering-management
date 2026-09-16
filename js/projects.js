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

/* BuildFlow Phase 1：所有施工時間均從 project.steps 的 start / end 取得。 */
function projectDatedSteps(project){return (project.steps||[]).filter(step=>isCompleteScheduleDate(step.start)&&isCompleteScheduleDate(step.end)&&step.end>=step.start);}
function projectSchedulePeriod(project){
  const steps=projectDatedSteps(project);if(!steps.length)return null;
  return {start:steps.reduce((value,step)=>step.start<value?step.start:value,steps[0].start),end:steps.reduce((value,step)=>step.end>value?step.end:value,steps[0].end)};
}
function projectSchedulePeriodLabel(project){const period=projectSchedulePeriod(project);return period?fmtDate(period.start)+' → '+fmtDate(period.end)+'｜'+scheduleDays(period.start,period.end)+'天':'工期未設定';}
function projectStepProgress(step){const value=Number(step.progress);return Number.isFinite(value)?Math.max(0,Math.min(100,Math.round(value))):(step.done?100:0);}
function projectTotalScheduleProgress(project){const steps=project.steps||[];return steps.length?Math.round(steps.reduce((sum,step)=>sum+projectStepProgress(step),0)/steps.length):0;}
function projectPreviousStepNames(project,index){const step=(project.steps||[])[index];if(!step)return '無';const names=(project.steps||[]).filter(item=>item.next===step.name).map(item=>item.name);return names.length?names.join('、'):'無';}
function projectTodayISO(){return localDateISO(new Date());}
function projectCurrentSteps(project,today=projectTodayISO()){return projectDatedSteps(project).filter(step=>step.start<=today&&step.end>=today);}
function projectUpcomingSteps(project,today=projectTodayISO()){
  const future=projectDatedSteps(project).filter(step=>step.start>today).sort((a,b)=>a.start.localeCompare(b.start));
  if(!future.length)return [];const start=future[0].start;return future.filter(step=>step.start===start);
}
function projectGanttHTML(project,compact=false){
  const steps=projectDatedSteps(project);const period=projectSchedulePeriod(project);
  if(!period)return '<div class="empty">工期未設定。請在工程表填入完整的開始與結束日期。</div>';
  const days=scheduleDays(period.start,period.end),dayWidth=compact?14:24,dates=[];
  for(let date=dateObj(period.start);date<=dateObj(period.end);date.setDate(date.getDate()+1))dates.push(new Date(date));
  const width=Math.max(280,days*dayWidth),headers=dates.map((date,index)=>'<div class="buildflow-gantt-day">'+((index===0||date.getDate()===1||(!compact&&days<=31))?(date.getMonth()+1)+'/'+date.getDate():'')+'</div>').join('');
  return '<div class="buildflow-gantt-scroll"><div class="buildflow-gantt" style="--gantt-days:'+days+';--gantt-width:'+width+'px"><div class="buildflow-gantt-head"><div>工程</div><div class="buildflow-gantt-axis">'+headers+'</div></div>'+steps.map((step,index)=>{
    const offset=scheduleDays(period.start,step.start)-1,length=scheduleDays(step.start,step.end),sourceIndex=(project.steps||[]).indexOf(step);
    return '<div class="buildflow-gantt-row"><button class="buildflow-gantt-name" onclick="stepDetail('+project.id+','+sourceIndex+')"><b>'+esc(step.trade||'未分類')+'｜'+esc(step.name)+'</b><small>'+esc(fmtDate(step.start))+' ～ '+esc(fmtDate(step.end))+'</small></button><div class="buildflow-gantt-track"><div class="buildflow-gantt-bar" title="'+esc(step.name)+' '+esc(step.start)+' ～ '+esc(step.end)+'" style="left:calc('+offset+' / var(--gantt-days) * 100%);width:calc('+length+' / var(--gantt-days) * 100%)">'+(compact?'':esc(step.name))+'</div></div></div>';
  }).join('')+'</div></div>';
}
/* SWD2601 概要專用施工時間圖：獨立於 steps，資料只掛在此專案的 scheduleItems。 */
function isSWD2601Project(project){return /^SWD2601\s*陳宅$/i.test(String(project?.name||'').replace(/[｜|]/g,' ').replace(/\s+/g,' ').trim());}
const SWD2601_SCHEDULE_EXAMPLES=[
  ['泥作','防水','2026-09-09','2026-09-12'],['泥作','貼磚','2026-09-10','2026-09-11'],['泥作','填縫','2026-09-11','2026-09-12'],['木作','放樣','2026-09-09','2026-09-10'],['水電','配管','2026-09-10','2026-09-12'],['水電','試水','2026-09-13','2026-09-14'],['木地板','進料','2026-09-10','2026-09-11'],['木地板','施工(3D)','2026-09-12','2026-09-14']
];
function swdScheduleItemId(){return 'swd-schedule-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);}
function swdScheduleItems(project){
  if(!isSWD2601Project(project))return [];
  if(!Array.isArray(project.scheduleItems)){
    project.scheduleItems=SWD2601_SCHEDULE_EXAMPLES.map(([trade,name,start,end])=>({id:swdScheduleItemId(),projectId:project.id,trade,name,start,end}));
    save();
  }
  let repaired=false;project.scheduleItems.forEach(item=>{if(item&&item.projectId===undefined){item.projectId=project.id;repaired=true;}});if(repaired)save();
  return project.scheduleItems.filter(item=>item&&String(item.projectId)===String(project.id));
}
function swdScheduleTrades(project){return [...new Set([...SWD2601_SCHEDULE_EXAMPLES.map(item=>item[0]),...swdScheduleItems(project).map(item=>item.trade).filter(Boolean)])];}
function swdScheduleModal(projectId,itemId=''){
  const project=data.projects.find(item=>item.id===projectId);if(!isSWD2601Project(project))return;
  const item=itemId?swdScheduleItems(project).find(entry=>entry.id===itemId):null,trades=swdScheduleTrades(project),isEdit=!!item;
  openModal('<div class="swd-schedule-modal"><h2>'+ (isEdit?'編輯工程時間':'新增工程時間')+'</h2><label>工種<select id="swdScheduleTrade">'+trades.map(trade=>'<option value="'+esc(trade)+'" '+((item?.trade||trades[0])===trade?'selected':'')+'>'+esc(trade)+'</option>').join('')+'</select></label><label>工程名稱<input id="swdScheduleName" value="'+esc(item?.name||'')+'" required></label><div class="grid"><label>開始日期<input id="swdScheduleStart" type="date" value="'+esc(item?.start||'')+'" required></label><label>結束日期<input id="swdScheduleEnd" type="date" value="'+esc(item?.end||'')+'" required></label></div><div class="actions">'+(isEdit?'<button class="light danger" onclick="deleteSWDScheduleItem('+projectId+',\''+esc(itemId)+'\')">刪除</button>':'')+'<button class="light" onclick="closeModal()">取消</button><button onclick="saveSWDScheduleItem('+projectId+',\''+esc(itemId)+'\')">'+(isEdit?'儲存':'新增')+'</button></div></div>');
}
function saveSWDScheduleItem(projectId,itemId=''){
  const project=data.projects.find(item=>item.id===projectId),trade=document.getElementById('swdScheduleTrade')?.value||'',name=document.getElementById('swdScheduleName')?.value.trim(),start=document.getElementById('swdScheduleStart')?.value||'',end=document.getElementById('swdScheduleEnd')?.value||'';
  if(!isSWD2601Project(project)||!trade||!name||!isCompleteScheduleDate(start)||!isCompleteScheduleDate(end)||!scheduleDateRangeValid(start,end)){alert('請填寫完整工程名稱與有效開始／結束日期。');return;}
  const items=swdScheduleItems(project),existing=itemId&&items.find(item=>item.id===itemId);
  if(existing)Object.assign(existing,{projectId:project.id,trade,name,start,end});else items.push({id:swdScheduleItemId(),projectId:project.id,trade,name,start,end});
  save();closeModal();openProject(projectId,'overview');
}
function deleteSWDScheduleItem(projectId,itemId){
  const project=data.projects.find(item=>item.id===projectId);if(!isSWD2601Project(project))return;
  const items=swdScheduleItems(project),index=items.findIndex(item=>item.id===itemId);if(index<0)return;
  if(!confirm('刪除這一筆施工時間？'))return;items.splice(index,1);save();closeModal();openProject(projectId,'overview');
}
function swdScheduleGanttHTML(project){
  const items=swdScheduleItems(project).filter(item=>isCompleteScheduleDate(item.start)&&isCompleteScheduleDate(item.end)&&item.end>=item.start);if(!items.length)return '<div class="empty">尚未建立施工時間。</div>';
  // 直接沿用 2022 timelineHTML 的日格、像素位移和絕對定位 Bar 結構；僅資料改為此專案 scheduleItems。
  const start=items.reduce((value,item)=>item.start<value?item.start:value,items[0].start),end=items.reduce((value,item)=>item.end>value?item.end:value,items[0].end),days=scheduleDays(start,end),dates=[],dayWidth=22;
  for(let date=dateObj(start);date<=dateObj(end);date.setDate(date.getDate()+1))dates.push(new Date(date));
  const width=Math.max(300,days*dayWidth),trades=swdScheduleTrades(project);
  const today=localDateISO(new Date()),todayOffset=isCompleteScheduleDate(today)&&today>=start&&today<=end?scheduleDays(start,today)-1:-1;
  const todayMarker=todayOffset>=0?'<div aria-label="今天" style="position:absolute;left:'+(todayOffset*dayWidth)+'px;top:0;bottom:0;width:'+dayWidth+'px;background:rgba(80,80,80,.08);pointer-events:none"></div>':'';
  const heads=dates.map((date,index)=>'<div style="min-width:'+dayWidth+'px;text-align:center;font-size:9px;color:#777">'+(index===0||date.getDate()===1||days<=21?(date.getMonth()+1)+'/'+date.getDate():'')+'</div>').join('');
  const rows=trades.map(trade=>{
    const tradeItems=items.filter(item=>item.trade===trade).sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end));if(!tradeItems.length)return '';
    const bars=tradeItems.map(item=>{const left=scheduleDays(start,item.start)-1,length=scheduleDays(item.start,item.end);return '<button title="'+esc(item.name)+' '+esc(fmtDate(item.start))+'–'+esc(fmtDate(item.end))+'" onclick="swdScheduleModal('+project.id+',\''+esc(item.id)+'\')" style="position:absolute;left:'+(left*dayWidth)+'px;width:'+(length*dayWidth)+'px;top:6px;height:25px;background:#444;border-radius:6px;overflow:hidden;padding:5px 7px;color:#fff;font-size:10px;font-weight:700;white-space:nowrap;text-overflow:ellipsis;text-align:left">'+esc(item.name)+'</button>';}).join('');
    return '<div style="display:grid;grid-template-columns:114px '+width+'px;border-bottom:1px solid #eee;min-height:38px"><div style="position:sticky;left:0;z-index:2;background:#fff;padding:11px 6px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><b>'+esc(trade)+'</b></div><div style="position:relative;height:38px;background-image:linear-gradient(to right,#eee 1px,transparent 1px);background-size:'+(100/days)+'% 100%">'+todayMarker+bars+'</div></div>';
  }).join('');
  return '<div class="swd-gantt-scroll" style="overflow-x:auto"><div style="min-width:'+(114+width)+'px"><div style="display:grid;grid-template-columns:114px '+width+'px;border-bottom:1px solid #ddd"><div style="position:sticky;left:0;z-index:3;background:#fff;padding:8px 6px;font-size:11px;font-weight:700">工種 / 工程名稱</div><div style="position:relative;display:grid;grid-template-columns:repeat('+days+',1fr)">'+todayMarker+heads+'</div></div>'+rows+'</div></div>';
}
function swdScheduleOverviewHTML(project){return '<div class="section"><div><b>施工時間圖</b><div class="muted">可自行新增工程名稱與日期</div></div><button onclick="swdScheduleModal('+project.id+')">＋ 新增工程時間</button></div><div class="card">'+swdScheduleGanttHTML(project)+'</div>';}
function migrateSWDLegacyScheduleItems(project){
  if(!isSWD2601Project(project)||!Array.isArray(project.scheduleItems))return;
  let changed=false;(project.steps||=[]);project.scheduleItems.forEach(item=>{
    if(!item||!isCompleteScheduleDate(item.start)||!isCompleteScheduleDate(item.end)||item.end<item.start)return;
    if(!project.steps.some(step=>step.trade===item.trade&&step.name===item.name&&step.start===item.start&&step.end===item.end)){project.steps.push({name:item.name,trade:item.trade,start:item.start,end:item.end,next:'',notes:[],done:false});changed=true;}
  });delete project.scheduleItems;save();
}
function swdStepTrades(project){return [...new Set([...(typeof libraryGroups==='function'?libraryGroups().map(group=>group.name):[]),...(project.steps||[]).map(step=>step.trade||'未分類')])];}
function swdStepsGanttHTML(project){
  const items=projectDatedSteps(project),trades=swdStepTrades(project);if(!items.length)return '<div class="empty">工期未設定</div>';
  const period=projectSchedulePeriod(project),days=scheduleDays(period.start,period.end),dayWidth=22,width=days*dayWidth,dates=[];
  for(let date=dateObj(period.start);date<=dateObj(period.end);date.setDate(date.getDate()+1))dates.push(new Date(date));
  const heads=dates.map((date,index)=>'<div style="min-width:'+dayWidth+'px;text-align:center;font-size:9px;color:#777">'+(index===0||date.getDate()===1||days<=21?(date.getMonth()+1)+'/'+date.getDate():'')+'</div>').join('');
  const rows=trades.map(trade=>{const tradeItems=(project.steps||[]).map((step,index)=>({step,index})).filter(item=>isCompleteScheduleDate(item.step.start)&&isCompleteScheduleDate(item.step.end)&&item.step.end>=item.step.start&&(item.step.trade||'未分類')===trade);const bars=tradeItems.map(({step,index})=>{const left=scheduleDays(period.start,step.start)-1,length=scheduleDays(step.start,step.end);return '<button title="'+esc(step.name)+' '+esc(fmtDate(step.start))+'–'+esc(fmtDate(step.end))+'" onclick="stepDetail('+project.id+','+index+')" style="position:absolute;left:'+(left*dayWidth)+'px;width:'+(length*dayWidth)+'px;top:6px;height:25px;background:#444;border-radius:6px;overflow:hidden;padding:5px 7px;color:#fff;font-size:10px;font-weight:700;white-space:nowrap;text-overflow:ellipsis;text-align:left">'+esc(step.name)+'</button>';}).join('');return '<div style="display:grid;grid-template-columns:114px '+width+'px;border-bottom:1px solid #eee;min-height:38px"><div style="position:sticky;left:0;z-index:2;background:#fff;padding:11px 6px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><b>'+esc(trade)+'</b></div><div style="position:relative;height:38px;background-image:linear-gradient(to right,#eee 1px,transparent 1px);background-size:'+(100/days)+'% 100%">'+bars+'</div></div>';}).join('');
  return '<div class="swd-gantt-scroll" style="overflow-x:auto"><div style="min-width:'+(114+width)+'px"><div style="display:grid;grid-template-columns:114px '+width+'px;border-bottom:1px solid #ddd"><div style="position:sticky;left:0;z-index:3;background:#fff;padding:8px 6px;font-size:11px;font-weight:700">工種</div><div style="display:grid;grid-template-columns:repeat('+days+',1fr)">'+heads+'</div></div>'+rows+'</div></div>';
}
function swdStepsOverviewHTML(project){migrateSWDLegacyScheduleItems(project);return '<div class="section"><div><b>施工時間圖</b><div class="muted">工程表日期即時同步</div></div><button onclick="addProjectStep('+project.id+')">＋ 新增工程時間</button></div><div class="card">'+swdStepsGanttHTML(project)+'</div>';}
function projectSummaryItems(title,steps,project){return '<div class="section"><b>'+title+'</b></div><div class="card">'+(steps.length?steps.map(step=>'<div class="row"><div style="flex:1"><b>'+esc(step.trade||'未分類')+'｜'+esc(step.name)+'</b><div class="muted">'+esc(fmtDate(step.start))+' ～ '+esc(fmtDate(step.end))+'</div></div><span class="tag">'+projectStepProgress(step)+'%</span></div>').join(''):'<div class="muted">'+(title==='現在施工'?'目前沒有排定施工中的工程。':'沒有尚未開始的工程。')+'</div>')+'</div>';}
function projectOverviewHTML(project){
  const confirmation=nextSiteConfirmation(project),nodes=typeof workflowProjectNodes==='function'?workflowProjectNodes(project):[],checks=nodes.reduce((sum,node)=>sum+(node.checklist||[]).length,0),doneChecks=nodes.reduce((sum,node)=>sum+(node.checklist||[]).filter(item=>item.done).length,0);
  const timeline=isSWD2601Project(project)?swdStepsOverviewHTML(project):'<div class="section"><b>施工時間軸</b></div><div class="card">'+projectGanttHTML(project,true)+'</div>';
  return '<div class="card buildflow-overview-stats"><div><span class="muted">工期</span><b>'+esc(projectSchedulePeriodLabel(project))+'</b></div><div><span class="muted">總進度</span><b>'+projectTotalScheduleProgress(project)+'%</b></div></div>'+timeline+projectSummaryItems('現在施工',projectCurrentSteps(project),project)+projectSummaryItems('接下來施工',projectUpcomingSteps(project),project)+'<div class="section"><b>下次現場確認</b></div><div class="card">'+((confirmation.checks||[]).length?confirmation.checks.map(item=>'<div class="row">'+(item.done?'☑':'☐')+'　'+esc(item.text)+'</div>').join(''):'<div class="muted">尚無確認事項</div>')+'</div><div class="section"><b>施工檢查摘要</b></div><div class="card"><b>'+doneChecks+'/'+checks+' 項已完成</b><div class="muted">既有 Workflow／Checklist 摘要</div></div><div class="section"><b>本週紀錄／日報</b></div><div class="card"><div class="muted">已有 '+(project.siteReports||[]).length+' 份現場日報</div></div>';
}
function projectScheduleTrades(project){return [...new Set((project.steps||[]).map(step=>step.trade||'未分類'))];}
function updateProjectScheduleDate(id,index,field,value,input){
  const project=data.projects.find(item=>item.id===id),step=project?.steps?.[index];if(!step||!['start','end'].includes(field))return;
  if(input?.validity?.badInput||(value&&!isCompleteScheduleDate(value)))return;
  const start=field==='start'?value:(step.start||''),end=field==='end'?value:(step.end||'');
  if(!scheduleDateRangeValid(start,end)){alert('結束日期不能早於開始日期');openProject(id,'schedule');return;}
  step[field]=value;save();openProject(id,'schedule');
}
function updateProjectScheduleDone(id,index,checked){const step=data.projects.find(item=>item.id===id)?.steps?.[index];if(!step)return;step.done=!!checked;if(step.done&&!step.actualCompletedAt)step.actualCompletedAt=new Date().toISOString();save();openProject(id,'schedule');}
function addProjectScheduleItem(id,trade){
  openModal('<h2>新增工程項目</h2><label>工種<input id="projectScheduleTrade" value="'+esc(trade)+'"></label><label>工程名稱<input id="projectScheduleName" required></label><div class="grid"><label>開始日期<input id="projectScheduleStart" type="date"></label><label>結束日期<input id="projectScheduleEnd" type="date"></label></div><div class="actions"><button class="light" onclick="closeModal()">取消</button><button onclick="saveProjectScheduleItem('+id+')">新增</button></div>');
}
function saveProjectScheduleItem(id){
  const project=data.projects.find(item=>item.id===id),name=document.getElementById('projectScheduleName')?.value.trim(),trade=document.getElementById('projectScheduleTrade')?.value.trim()||'未分類',start=document.getElementById('projectScheduleStart')?.value||'',end=document.getElementById('projectScheduleEnd')?.value||'';
  if(!project||!name)return;if((start&&!isCompleteScheduleDate(start))||(end&&!isCompleteScheduleDate(end))||!scheduleDateRangeValid(start,end)){alert('請填入有效日期，且結束日期不可早於開始日期。');return;}
  project.steps.push({name,trade,start,end,next:'',notes:[],done:false});save();closeModal();openProject(id,'schedule');
}
function projectScheduleTableHTML(project){
  const trades=projectScheduleTrades(project),groups=trades.map((trade,tradeIndex)=>{
    const rows=(project.steps||[]).map((step,index)=>({step,index})).filter(item=>(item.step.trade||'未分類')===trade).map(({step,index})=>'<tr><td><input type="date" value="'+esc(step.start||'')+'" onchange="updateProjectScheduleDate('+project.id+','+index+',\'start\',this.value,this)"></td><td><input type="date" value="'+esc(step.end||'')+'" onchange="updateProjectScheduleDate('+project.id+','+index+',\'end\',this.value,this)"></td><td><button class="buildflow-item-edit" onclick="stepDetail('+project.id+','+index+')">'+esc(step.name)+'</button></td><td><label class="buildflow-progress"><input type="checkbox" '+(step.done?'checked':'')+' onchange="updateProjectScheduleDone('+project.id+','+index+',this.checked)"> '+projectStepProgress(step)+'%</label></td><td>'+esc(projectPreviousStepNames(project,index))+'</td></tr>').join('')||'<tr><td colspan="5" class="muted">目前沒有工程項目</td></tr>';
    return '<details class="card buildflow-trade-group" open><summary><b>'+esc(trade)+'</b><span class="tag">'+(project.steps||[]).filter(step=>(step.trade||'未分類')===trade).length+' 項</span></summary><div class="buildflow-schedule-scroll"><table><thead><tr><th>開始日期</th><th>結束日期</th><th>工程名稱</th><th>進度</th><th>前置工程</th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="buildflow-trade-actions"><button class="light" onclick="addProjectScheduleItem('+project.id+',\''+esc(trade)+'\')">＋ 新增工程項目</button></div></details>';
  }).join('');
  return '<div class="section"><b>施工時間圖 / Gantt</b><span class="muted">讀取下方工程進度表日期</span></div><div class="card">'+projectGanttHTML(project)+'</div><div class="section"><b>工程進度表</b><span class="muted">依工種分組；日期直接編輯</span></div>'+(groups||'<div class="empty">目前沒有工程項目。</div>');
}
function openProject(id,tab='overview'){
  const p=data.projects.find(x=>x.id===id);if(!p)return;
  releaseDailyPhotoViews();
  let siteError='';try{ensureProjectSiteAppointments(p);}catch(error){siteError='到期事項尚未儲存：'+error.message;}
  const tabs=[['overview','概要'],['schedule','工程表'],['inspection','施工檢查'],['weekly','本週紀錄']];
  const content=tab==='schedule'?projectScheduleTableHTML(p):tab==='inspection'?workflowProjectHTML(p):tab==='weekly'?projectSiteTopHTML(p)+projectSiteBottomHTML(p):projectOverviewHTML(p);
  main.innerHTML='<button class="back" onclick="home()">← 返回</button><div class="card"><span class="tag">'+esc(p.status)+'</span><h2>'+esc(p.name)+'</h2><div class="muted">'+esc(p.client)+'　｜　'+esc(projectSchedulePeriodLabel(p))+'</div><div style="margin:15px 0 7px" class="bar"><div class="fill" style="width:'+projectTotalScheduleProgress(p)+'%"></div></div><b>'+projectTotalScheduleProgress(p)+'%</b><div style="margin-top:12px"><button class="light" onclick="openProjectData('+id+')">專案資料</button></div></div><div class="buildflow-tabs" role="tablist">'+tabs.map(item=>'<button role="tab" aria-selected="'+(tab===item[0])+'" onclick="openProject('+id+',\''+item[0]+'\')">'+item[1]+'</button>').join('')+'</div>'+content;
  bindProjectSite(p);if(siteError)projectSiteMessage(main,siteError);
}
function reorderProject(id){let p=data.projects.find(x=>x.id===id);openModal('<h2>編排施工順序</h2><div class="hint">由上到下就是施工順序。按 ↑ ↓ 調整，系統會同步更新「下一步」提示。</div>'+p.steps.map((s,i)=>'<div class="card" style="padding:12px"><b>'+esc(s.name)+'</b><div class="muted">'+esc(s.trade)+'</div><div style="margin-top:8px"><button class="orderbtn" onclick="moveProjectStep('+id+','+i+',-1)">↑ 上移</button> <button class="orderbtn" onclick="moveProjectStep('+id+','+i+',1)">↓ 下移</button></div></div>').join('')+'<button style="width:100%" onclick="closeModal();openProject('+id+')">完成編排</button>')}

function moveProjectStep(id,i,dir){let p=data.projects.find(x=>x.id===id),n=i+dir;if(n<0||n>=p.steps.length)return;[p.steps[i],p.steps[n]]=[p.steps[n],p.steps[i]];p.steps.forEach((s,k)=>s.next=(k<p.steps.length-1?p.steps[k+1].name:''));save();closeModal();reorderProject(id)}


function completeStep(id,i){const s=data.projects.find(p=>p.id===id)?.steps[i];if(!s)return;s.done=true;if(!s.actualCompletedAt)s.actualCompletedAt=new Date().toISOString();save();openProject(id)}

function stepDetail(id,i){let p=data.projects.find(x=>x.id===id),s=p.steps[i];let opts='<option value="">未設定</option>'+p.steps.map((x,j)=>'<option value="P:'+j+'" '+(x.name===s.next?'selected':'')+'>'+esc(x.trade+'｜'+x.name)+'</option>').join(''),progressField=isSWD2601Project(p)?'<label>進度（%）<input id="sp" type="number" min="0" max="100" value="'+projectStepProgress(s)+'"></label>':'',deleteButton=isSWD2601Project(p)?'<button class="light danger" onclick="deleteProjectStep('+id+','+i+')">刪除工程</button>':'';openModal('<h2>編輯工項</h2><label>工項名稱</label><input id="sn" value="'+esc(s.name)+'"><label>工種</label><input id="st" value="'+esc(s.trade)+'"><div class="grid"><div><label>開始日期</label><input id="ss" type="date" value="'+esc(s.start||'')+'"></div><div><label>結束日期</label><input id="se" type="date" value="'+esc(s.end||'')+'"></div></div>'+progressField+'<div class="hint">設定日期後，「時間／本週進度」會自動判斷本週工程。</div><label>下一個工程銜接</label><select id="snext">'+opts+'</select><div class="hint">可以銜接到本工程任何工項，例如「水電→木作」。</div><div class="section"><b>注意事項</b><button class="light" onclick="addNote('+id+','+i+')">＋ 新增</button></div>'+s.notes.map((n,j)=>'<div class="row"><div style="flex:1">□ '+esc(n)+'</div><button class="orderbtn" onclick="editNote('+id+','+i+','+j+')">編輯</button><span class="danger" onclick="delNote('+id+','+i+','+j+')">×</span></div>').join('')+(s.libraryTrade&&s.libraryItem?'<div class="hint">來源：工種庫 → '+esc(s.libraryTrade)+'｜'+esc(s.libraryItem)+'　<button class="light" style="padding:5px 8px;margin-left:4px" onclick="viewProjectLibrarySource(\''+esc(s.libraryTrade)+'\',\''+esc(s.libraryItem)+'\')">查看工種庫資料</button></div>':'')+'<div class="actions" style="margin-top:15px">'+deleteButton+'<button class="light" onclick="closeModal()">取消</button><button onclick="saveStepEdit('+id+','+i+')">儲存修改</button></div>')}

function deleteProjectStep(id,i){const project=data.projects.find(item=>item.id===id),step=project?.steps?.[i];if(!isSWD2601Project(project)||!step||!confirm('刪除工程「'+step.name+'」？'))return;project.steps.splice(i,1);project.steps.forEach(item=>{if(item.next===step.name)item.next='';});save();closeModal();openProject(id,'overview');}

function saveStepEdit(id,i){
  const p=data.projects.find(x=>x.id===id),s=p.steps[i];
  const name=document.getElementById('sn').value.trim(),trade=document.getElementById('st').value.trim()||'自訂';
  const startInput=document.getElementById('ss'),endInput=document.getElementById('se'),start=startInput.value,end=endInput.value;
  if(!name)return;
  if(startInput.validity.badInput||endInput.validity.badInput||(start&&!isCompleteScheduleDate(start))||(end&&!isCompleteScheduleDate(end)))return;
  if(!scheduleDateRangeValid(start,end)){alert('結束日期不能早於開始日期');return;}
  const v=document.getElementById('snext').value,progressInput=document.getElementById('sp'),progressValue=Number(progressInput?.value);
  if(progressInput&&(!Number.isFinite(progressValue)||progressValue<0||progressValue>100)){alert('進度請填 0 到 100。');return;}
  Object.assign(s,{name,trade,start,end,next:v.startsWith('P:')?(p.steps[Number(v.slice(2))]?.name||''):''},progressInput?{progress:Math.round(progressValue),done:progressValue===100}:{});
  save();closeModal();openProject(id);
}

function viewProjectLibrarySource(tradeName,itemName){const src=libraryItemSource(tradeName,itemName);if(!src){alert('工種庫中找不到原始資料，這個工程項目仍可獨立使用。');return;}closeModal();if(src.source==='2022')exampleLibraryItemDetail(src.ti,src.j);else libraryDetail(src.customIndex,src.j)}

function addNote(id,i){let n=prompt('新增注意事項');if(n){data.projects.find(p=>p.id===id).steps[i].notes.push(n);save();closeModal();stepDetail(id,i)}}

function editNote(id,i,j){let a=data.projects.find(p=>p.id===id).steps[i].notes,n=prompt('修改注意事項',a[j]);if(n!==null&&n.trim()){a[j]=n.trim();save();closeModal();stepDetail(id,i)}}

function delNote(id,i,j){const s=data.projects.find(p=>p.id===id).steps[i];s.notes.splice(j,1);if(s.noteChecks)s.noteChecks.splice(j,1);save();closeModal();stepDetail(id,i)}

function addProjectStep(id){const project=data.projects.find(item=>item.id===id),swd=isSWD2601Project(project),scheduleFields=swd?'<div class="grid"><label>開始日期<input id="as" type="date" required></label><label>結束日期<input id="ae" type="date" required></label></div><label>進度（%）<input id="ap" type="number" min="0" max="100" value="0"></label>':'';openModal('<h2>新增自訂工項</h2><label>工項名稱</label><input id="n"><label>工種</label><input id="t">'+scheduleFields+'<label>下一步</label><input id="nx"><label>注意事項（每行一項）</label><textarea id="nt"></textarea><div class="actions"><button class="light" onclick="closeModal()">取消</button><button onclick="saveStep('+id+')">加入</button></div>')}

function saveStep(id){const project=data.projects.find(p=>p.id===id),name=document.getElementById('n')?.value.trim(),trade=document.getElementById('t')?.value.trim()||'自訂',start=document.getElementById('as')?.value||'',end=document.getElementById('ae')?.value||'',progressInput=document.getElementById('ap'),progress=Number(progressInput?.value);if(!project||!name)return;if(isSWD2601Project(project)&&(!isCompleteScheduleDate(start)||!isCompleteScheduleDate(end)||!scheduleDateRangeValid(start,end)||!Number.isFinite(progress)||progress<0||progress>100)){alert('請填寫有效開始／結束日期與 0 到 100 的進度。');return;}project.steps.push({name,trade,next:document.getElementById('nx')?.value||'',notes:(document.getElementById('nt')?.value||'').split('\n').filter(Boolean),done:progressInput?progress===100:false,...(progressInput?{start,end,progress:Math.round(progress)}:{})});save();closeModal();openProject(id,isSWD2601Project(project)?'overview':'overview')}

let newProjectGroups=[];
function newProject(){
  newProjectGroups=libraryGroups();
  openModal('<form id="newProjectForm"><h2>新增工程</h2><label for="projectName">工程名稱</label><input id="projectName" required placeholder="例如：SWD2601｜陳宅"><label for="projectClient">業主／公司</label><input id="projectClient"><div class="grid"><div><label for="projectStart">預估開工日期</label><input id="projectStart" type="date" required value="'+localDateISO(new Date())+'"></div><div><label for="projectDuration">預估工期（日曆天）</label><input id="projectDuration" type="number" min="1" required value="180"></div></div><div class="section"><b>從工種庫套用施工項目</b></div><div class="hint">勾選大工種可套用全部項目；展開後可個別選取。預估工期以範例的日期間距排定，未設定工期的項目預設 1 天。</div>'+newProjectGroups.map((t,i)=>'<div class="card" style="padding:12px"><div class="row"><button type="button" class="light" aria-expanded="false" aria-controls="projectTradeItems_'+i+'" onclick="toggleProjectTrade(this)">▶</button><label class="project-trade-label"><input type="checkbox" class="projectTrade" value="'+i+'" onchange="selectProjectTrade('+i+',this.checked)"><b>'+esc(t.name)+'</b></label><span class="tag">'+(t.source==='2022'?'2022':'工種庫')+'</span></div><div id="projectTradeItems_'+i+'" hidden>'+t.items.map((it,j)=>'<label class="row"><input type="checkbox" class="libItem" data-group="'+i+'" value="'+i+':'+j+'" onchange="syncProjectTradeSelection('+i+')"><span>'+esc(it[0])+'</span></label>').join('')+'</div></div>').join('')+'<div id="projectFormError" class="hint" role="alert" hidden></div><div class="actions"><button type="button" class="light" onclick="closeModal()">取消</button><button type="submit">建立工程</button></div></form>');
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
    return {...(typeof checklistSourceId==='function'?{checklistSourceId:checklistSourceId(it,g.source)}:{}),name:it[0],trade:g.name,next:libraryNextLabel(g.source,g.ti,j,it[2]),notes:[...(it[1]||[])],noteChecks:[],siteConfirmed:false,done:false,start:shiftScheduleDate(start,offset),end:shiftScheduleDate(start,offset+duration-1),libraryTrade:g.name,libraryItem:it[0],librarySource:g.source};
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
  const name=document.getElementById('projectName').value.trim(),start=document.getElementById('projectStart').value,duration=Number(document.getElementById('projectDuration').value);
  const error=document.getElementById('projectFormError');
  if(!name||!isCompleteScheduleDate(start)||!Number.isFinite(duration)||duration<1){error.hidden=false;error.textContent='請填寫工程名稱、完整有效的開工日期與預估工期。';return;}
  const selected=Array.from(form.querySelectorAll('.libItem:checked')).map(c=>{const [gi,j]=c.value.split(':').map(Number);return {g:newProjectGroups[gi],it:newProjectGroups[gi].items[j],j};});
  let steps=buildProjectSchedule(selected,start);
  if(!steps.length)steps=[{name:'現場確認',trade:'自訂',next:'請新增工項',notes:['確認圖面','確認現場條件'],noteChecks:[],siteConfirmed:false,done:false,start,end:start}];
  const project={id:Math.max(Date.now(),...data.projects.map(p=>Number(p.id)+1||0)),name,client:document.getElementById('projectClient').value.trim()||'未設定',status:'進行中',steps,baselineSchedule:JSON.parse(JSON.stringify(steps)),baselineCreatedAt:new Date().toISOString(),scheduleMeta:{estimatedStart:start,estimatedDuration:Math.floor(duration)},issueCount:0,workflow:buildProjectWorkflow(selected,steps)};
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
function projectScheduleStats(p){
  const steps=p.steps||[],completed=steps.filter(s=>s.done).length;
  return {total:steps.length,completed,actual:steps.filter(s=>s.actualCompletedAt).length};
}
function openMainProjectSchedule(id){
  const p=data.projects.find(x=>x.id===id);if(!p)return;
  const meta=p.scheduleMeta||{};const stat=projectScheduleStats(p);
  const baseline=(p.baselineSchedule||[]).map(s=>'<div class="row"><div style="flex:1"><b>'+esc(s.name)+'</b><div class="muted">'+esc(s.trade||'')+'　'+esc(fmtDate(s.start||''))+' ～ '+esc(fmtDate(s.end||s.start||''))+'</div></div></div>').join('')||'<div class="empty">建立時未儲存預估工進表</div>';
  main.innerHTML='<button class="back" onclick="openProject('+id+')">← 返回工程</button><div class="card"><span class="tag">主要工進表</span><h2>'+esc(p.name)+'</h2><div class="muted">預估開工：'+esc(fmtDate(meta.estimatedStart||''))+'　預估工期：'+esc(String(meta.estimatedDuration||''))+' 日曆天</div><div class="muted" style="margin-top:6px">初始預估已保留；下列表格為最新排程。實際完成 '+stat.actual+'/'+stat.total+' 項。</div></div><div class="section"><b>最新排程／實際完成</b><button onclick="addProjectStep('+id+')">＋ 自訂工項</button></div><div class="card">'+(p.steps||[]).map((s,i)=>'<div class="row" onclick="stepDetail('+id+','+i+')"><div class="dot '+(s.done?'checked':'')+'">'+(s.done?'✓':'')+'</div><div style="flex:1"><b>'+esc(s.name)+'</b><div class="muted">'+esc(s.trade||'')+'　'+esc(fmtDate(s.start||''))+' ～ '+esc(fmtDate(s.end||s.start||''))+(s.actualCompletedAt?'　實際完成：'+esc(fmtDate(s.actualCompletedAt.slice(0,10))):'')+'</div></div></div>').join('')+'</div><details class="card"><summary>初始預估（唯讀）</summary><div style="margin-top:10px">'+baseline+'</div></details>';
}
function openProjectSchedule(id,kind){if(kind==='main'){openMainProjectSchedule(id);return;}
  const p=data.projects.find(p=>p.id===id);if(!p)return;
  const baseline=kind==='baseline',rows=baseline?p.baselineSchedule:p.steps;
  main.innerHTML='<button class="back" onclick="openProject('+id+')">← 返回工程</button><div class="card"><h2>'+esc(p.name)+'</h2><b>'+(baseline?'預估工程進度表（唯讀）':'現場實際工程進度表')+'</b><div class="muted">'+(baseline?'建立工程當下保留的施工計畫':'可修改日期、工種與施工內容')+'</div></div>'+(rows?rows.map((s,i)=>'<div class="card"><b>'+esc(s.name)+'</b><div class="muted">'+esc(s.trade)+'｜'+esc(s.start||'未設定')+' ～ '+esc(s.end||'未設定')+'</div>'+(s.notes||[]).map(n=>'<div class="warn">'+esc(n)+'</div>').join('')+(baseline?'':'<button class="light" onclick="stepDetail('+id+','+i+')">編輯</button>')+'</div>').join(''):'<div class="empty">此舊工程沒有建立當下的預估快照。</div>');
}

function newIssue(pid=0){openModal('<h2>新增問題</h2><label>問題</label><input id="it"><label>說明</label><textarea id="ino"></textarea><label>優先度</label><select id="ip"><option>高</option><option>中</option><option>低</option></select><div class="actions"><button class="light" onclick="closeModal()">取消</button><button onclick="saveIssue('+pid+')">建立</button></div>')}

function saveIssue(pid){if(!it.value)return;let p=data.projects.find(x=>x.id===pid);data.issues.unshift({title:it.value,note:ino.value,priority:ip.value,status:'待確認',project:p?p.name:'未指定',date:new Date().toLocaleDateString('zh-TW')});if(p)p.issueCount=(p.issueCount||0)+1;save();closeModal();issues()}

function report(id){closeModal();openDailyReports(id);}
