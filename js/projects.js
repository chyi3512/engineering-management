let projectOverviewViewDate='';
function projectViewDate(){return projectOverviewViewDate||projectTodayISO();}
function setProjectViewDate(projectId,date){if(!isCompleteScheduleDate(date))return;projectOverviewViewDate=date;openProject(projectId,'overview');}
function shiftProjectViewDate(projectId,days){setProjectViewDate(projectId,shiftScheduleDate(projectViewDate(),days));}
function resetProjectViewDate(projectId){projectOverviewViewDate='';openProject(projectId,'overview');}
function projectWeekRange(viewDate=projectTodayISO()){
  const now=dateObj(viewDate); now.setHours(0,0,0,0);
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
  const future=projectDatedSteps(project).filter(step=>step.start>today&&!step.done&&projectStepProgress(step)<100).sort((a,b)=>a.start.localeCompare(b.start));
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
let swdShowAllTrades=false;
function swdStepTrades(project){const all=[...new Set([...(typeof libraryGroups==='function'?libraryGroups().map(group=>group.name):[]),...(project.steps||[]).map(step=>step.trade||'未分類')])];return swdShowAllTrades?all:all.filter(trade=>projectDatedSteps(project).some(step=>(step.trade||'未分類')===trade));}
function toggleSWDAllTrades(projectId){swdShowAllTrades=!swdShowAllTrades;openProject(projectId,'overview');}
function swdStepsGanttHTML(project){
  const items=projectDatedSteps(project),trades=swdStepTrades(project);if(!items.length)return '<div class="empty">工期未設定</div>';
  const period=projectSchedulePeriod(project),dailyWidth=44,timelineDates=[];
  for(let date=dateObj(period.start);date<=dateObj(period.end);date.setDate(date.getDate()+1))timelineDates.push(timelineDateISO(date));
  const dateIndex=new Map(timelineDates.map((date,index)=>[date,index])),width=timelineDates.length*dailyWidth,columns='repeat('+timelineDates.length+','+dailyWidth+'px)';
  const heads=timelineDates.map(date=>'<div style="width:'+dailyWidth+'px;text-align:center;font-size:9px;color:#777">'+esc(fmtDate(date))+'</div>').join('');
  const grid=timelineDates.map(()=>'<div style="width:'+dailyWidth+'px;border-left:1px solid #eee"></div>').join('');
  const rows=trades.map(trade=>{const tradeItems=(project.steps||[]).map((step,index)=>({step,index})).filter(item=>isCompleteScheduleDate(item.step.start)&&isCompleteScheduleDate(item.step.end)&&item.step.end>=item.step.start&&(item.step.trade||'未分類')===trade);const bars=tradeItems.map(({step,index})=>{const startIndex=dateIndex.get(step.start),endIndex=dateIndex.get(step.end),length=endIndex-startIndex+1;return '<button title="'+esc(step.name)+' '+esc(fmtDate(step.start))+'–'+esc(fmtDate(step.end))+'" onclick="stepDetail('+project.id+','+index+')" style="position:absolute;left:'+(startIndex*dailyWidth)+'px;width:'+(length*dailyWidth)+'px;top:6px;height:25px;background:#444;border-radius:6px;overflow:hidden;padding:5px 7px;color:#fff;font-size:10px;font-weight:700;white-space:nowrap;text-overflow:ellipsis;text-align:left">'+esc(step.name)+'</button>';}).join('');return '<div style="display:grid;grid-template-columns:114px '+width+'px;border-bottom:1px solid #eee;min-height:38px"><div style="position:sticky;left:0;z-index:2;background:#fff;padding:11px 6px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><b>'+esc(trade)+'</b></div><div style="position:relative;height:38px"><div aria-hidden="true" style="position:absolute;inset:0;display:grid;grid-template-columns:'+columns+';pointer-events:none">'+grid+'</div>'+bars+'</div></div>';}).join('');
  return '<div class="swd-gantt-scroll" style="overflow-x:auto"><div style="min-width:'+(114+width)+'px"><div style="display:grid;grid-template-columns:114px '+width+'px;border-bottom:1px solid #ddd"><div style="position:sticky;left:0;z-index:3;background:#fff;padding:8px 6px;font-size:11px;font-weight:700">工種</div><div style="display:grid;grid-template-columns:'+columns+'">'+heads+'</div></div>'+rows+'</div></div>';
}
function projectWeekSummaryGanttHTML(project,viewDate=projectViewDate()){
  const week=projectWeekRange(viewDate),items=projectDatedSteps(project).filter(step=>step.start<=week.end&&step.end>=week.start),trades=[...new Set(items.map(step=>step.trade||'未分類'))];if(!items.length)return '<div class="section"><b>本週施工</b><button class="light" style="padding:7px 9px" onclick="openProject('+project.id+',\'schedule\')">查看完整工程表</button></div><div class="card"><div class="muted">本週尚未排定施工。</div></div>';
  const dates=[];for(let date=dateObj(week.start);date<=dateObj(week.end);date.setDate(date.getDate()+1))dates.push(timelineDateISO(date));
  const dayWidth=34,width=dates.length*dayWidth,columns='repeat(7,'+dayWidth+'px)',heads=dates.map(date=>'<div style="width:'+dayWidth+'px;text-align:center;font-size:10px;color:#777">'+esc(fmtDate(date))+'</div>').join(''),grid=dates.map(()=>'<div style="width:'+dayWidth+'px;border-left:1px solid #eee"></div>').join('');
  const rows=trades.map(trade=>{const bars=items.filter(step=>(step.trade||'未分類')===trade).map(step=>{const start=step.start<week.start?week.start:step.start,end=step.end>week.end?week.end:step.end,left=(scheduleDays(week.start,start)-1)*dayWidth,length=scheduleDays(start,end)*dayWidth;return '<div title="'+esc(step.name)+' '+esc(fmtDate(step.start))+'–'+esc(fmtDate(step.end))+'" style="position:absolute;left:'+left+'px;width:'+length+'px;top:6px;height:24px;background:#444;border-radius:6px;padding:5px 7px;color:#fff;font-size:10px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(step.name)+'</div>';}).join('');return '<div style="display:grid;grid-template-columns:86px '+width+'px;border-bottom:1px solid #eee;min-height:36px"><div style="padding:10px 6px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><b>'+esc(trade)+'</b></div><div style="position:relative;height:36px"><div aria-hidden="true" style="position:absolute;inset:0;display:grid;grid-template-columns:'+columns+';pointer-events:none">'+grid+'</div>'+bars+'</div></div>';}).join('');
  return '<div class="section"><b>本週施工</b><button class="light" style="padding:7px 9px" onclick="openProject('+project.id+',\'schedule\')">查看完整工程表</button></div><div class="card" style="padding:0;overflow-x:auto"><div style="min-width:'+(86+width)+'px"><div style="display:grid;grid-template-columns:86px '+width+'px;border-bottom:1px solid #ddd"><div style="padding:8px 6px;font-size:11px;font-weight:700">工種</div><div style="display:grid;grid-template-columns:'+columns+'">'+heads+'</div></div>'+rows+'</div></div>';
}
function swdNextStepHintHTML(project){const completed=(project.steps||[]).filter(step=>step.done||Number(step.progress)>=100).filter(step=>step.next);return completed.length?'<div class="hint" style="margin-top:8px"><b>下一步建議</b><br>'+completed.map(step=>esc(step.name)+' 工程完成 → '+esc(step.next)).join('<br>')+'</div>':'';}
function swdStepsOverviewHTML(project){migrateSWDLegacyScheduleItems(project);return '<div class="section"><div><b>施工時間圖</b><div class="muted">工程表日期即時同步</div></div><button onclick="addProjectStep('+project.id+')">＋ 新增工程</button></div><div class="card">'+swdStepsGanttHTML(project)+swdNextStepHintHTML(project)+'</div><button class="light" style="width:100%;margin-top:8px" onclick="toggleSWDAllTrades('+project.id+')">'+(swdShowAllTrades?'收合工種':'顯示全部工種')+'</button>';}
function projectAcceptanceSummaryHTML(project,step){const stepIndex=(project.steps||[]).indexOf(step),checks=Object.entries(step.completionChecks||{}),checkLabels=typeof PROTECTION_COMPLETION_CHECKS==='undefined'?{}:Object.fromEntries(PROTECTION_COMPLETION_CHECKS),unit=step.acceptanceUnit||step.acceptanceOrganization||'',note=step.acceptanceNote||step.acceptanceNotes||'',detail='<div class="muted" style="margin-top:8px">驗收狀態：'+(step.acceptanceConfirmed?'已驗收':'待確認')+(step.acceptanceConfirmedAt?'<br>驗收日期：'+esc(fmtDate(step.acceptanceConfirmedAt.slice(0,10))):'')+(unit?'<br>驗收單位：'+esc(unit):'')+(step.acceptanceReminder?'<br>驗收提醒：'+esc(step.acceptanceReminder):'')+'</div>'+(checks.length?'<div style="margin-top:8px"><b>驗收清單</b>'+checks.map(([key,done])=>'<div class="muted">'+(done?'☑':'☐')+' '+esc(checkLabels[key]||key)+'</div>').join('')+'</div>':'')+(note?'<div class="muted" style="margin-top:8px">備註：'+esc(note)+'</div>':'')+(!step.acceptanceConfirmed?'<button class="light" style="margin-top:8px;padding:7px 9px" onclick="confirmStepAcceptance('+project.id+','+stepIndex+')">確認驗收完成</button>':'');return '<details class="hint" style="padding:0"><summary style="display:flex;justify-content:space-between;align-items:center;padding:10px;cursor:pointer"><b>驗收節點</b><span class="muted">'+(step.acceptanceConfirmed?'已完成':'未完成')+'</span></summary><div style="padding:0 10px 10px">'+detail+'</div></details>';}
const PROTECTION_CONFIRMATION_DEFAULTS=['進貨動線保護','電梯保護','施工樓層保護','室內門窗框、保留物品保護'];
function projectProtectionChecks(step){return Array.isArray(step.protectionChecks)&&step.protectionChecks.length?step.protectionChecks:PROTECTION_CONFIRMATION_DEFAULTS.map((label,index)=>({id:'default-protection-'+index,label,checked:false,checkedAt:''}));}
function projectProtectionReferencePhotos(step){const words=/保護|電梯|門框|梯廳/;return (typeof libraryGroups==='function'?libraryGroups():[]).filter(group=>group.name===step.trade).flatMap(group=>((group.source==='2022'?data.trades[group.ti]:libData[group.customIndex])?.photos||[]).map((photo,index)=>({photo,group,index}))).filter(item=>words.test((item.photo.title||'')+' '+(item.photo.note||''))).slice(0,3);}
function projectRequiresInspection(step){return step.requireInspection===true||(!Object.prototype.hasOwnProperty.call(step,'requireInspection')&&(step.acceptance?.enabled||step.hasAcceptanceNode||(step.trade==='木作'&&step.name==='保護')));}
function projectStepInspectionChecks(step){return String(step.name||'').includes('保護')?projectProtectionChecks(step):(step.acceptanceChecks||[]);}
function projectNodeAcceptance(step,kind){if(!projectRequiresInspection(step))return null;return {enabled:true,label:step.acceptanceName||step.acceptance?.label||(kind==='protection'?'管委會驗收':'驗收節點')};}
function projectNodeNextStep(project,step){const next=(project.steps||[]).find(item=>item.name===step.next)||project.steps[(project.steps||[]).indexOf(step)+1];return next||null;}
function projectNodePhotosHTML(photos){return photos.length?'<div class="node-photo-strip">'+photos.slice(0,3).map(item=>'<div><button class="light node-photo" data-site-action="preview" data-photo-id="'+esc(item.photo.id)+'" data-photo-date="'+esc(item.day.date)+'"><img data-step-photo="'+esc(item.photo.id)+'" data-step-photo-date="'+esc(item.day.date)+'" alt="本案工程照片"></button><div class="muted">'+esc(item.photo.description||'')+'</div><button class="light" data-site-action="remove-photo" data-photo-id="'+esc(item.photo.id)+'" data-photo-date="'+esc(item.day.date)+'">刪除照片</button></div>').join('')+'</div>':'<div class="muted node-empty">尚無本案工程照片</div>';}
function projectNodeReferenceHTML(refs,source,link){if(!refs.length)return '';return '<section class="node-section"><div class="node-section-head"><b>參考照片</b>'+link+'</div><div class="muted node-source">'+esc(source)+'</div><div class="node-photo-strip">'+refs.slice(0,3).map(item=>{const photo=item.photo||item;return '<button class="light node-photo" data-site-action="reference-preview" data-photo-src="'+esc(photo.data||photo.url||'')+'" data-photo-title="'+esc(photo.title||'參考照片')+'"><img src="'+esc(photo.data||photo.url||'')+'" alt="'+esc(photo.title||'參考照片')+'"></button>';}).join('')+'</div></section>';}
function projectNodeTemplateHTML(project,step,options){const stepIndex=(project.steps||[]).indexOf(step),inspection=projectRequiresInspection(step),checks=inspection?projectStepInspectionChecks(step):options.checks,done=checks.filter(item=>item.checked).length,allDone=checks.length>0&&done===checks.length,photos=typeof projectStepPhotos==='function'?projectStepPhotos(project,stepIndex):[],acceptance=projectNodeAcceptance(step,options.kind),next=projectNodeNextStep(project,step),date=step.start?(fmtDate(step.start)+(step.end&&step.end!==step.start?' ～ '+fmtDate(step.end):'')):'日期未設定',acceptanceHTML=acceptance?'<details class="node-section node-acceptance"><summary class="node-section-head"><b>'+esc(acceptance.label)+'</b><span class="muted" data-inspection-status>'+ (allDone?'已確認':'未確認')+'</span><span class="muted" data-inspection-count>'+done+' / '+checks.length+'</span><span class="node-acceptance-chevron" aria-hidden="true">⌄</span></summary><div class="node-checklist" data-inspection-list>'+checks.map(item=>'<label class="site-check-row node-check-row"><input type="checkbox" data-inspection-check="'+esc(item.id)+'" '+(item.checked?'checked':'')+'><span>'+esc(item.label)+'</span></label>').join('')+'</div><button type="button" class="light node-small-button node-add-inspection" data-site-action="show-protection-add">＋ 新增確認項目</button><form data-protection-add-form hidden><input name="label" placeholder="確認項目" autocomplete="off" required><button type="submit" class="light">新增</button></form></details>':'<section class="node-section"><div class="node-section-head"><b>確認清單</b><span class="node-check-count">'+done+' / '+checks.length+'</span><button class="light node-small-button" onclick="addNodeChecklist('+project.id+','+stepIndex+',\''+options.kind+'\')">＋新增</button></div><div class="node-checklist">'+(checks.map(item=>'<label class="site-check-row node-check-row"><input type="checkbox" data-'+options.kind+'-check="'+esc(item.id)+'" '+(item.checked?'checked':'')+'><span>'+esc(item.label)+'</span></label>').join('')||'<div class="muted node-empty">尚無確認項目</div>')+'</div></section>',notes=(options.notes||[]).filter(Boolean),notesHTML=notes.length?'<section class="node-section node-notes"><div class="node-section-head"><b>注意事項</b></div>'+notes.map(note=>'<div class="muted node-note">'+esc(note)+'</div>').join('')+'</section>':'',refs=projectNodeReferenceHTML(options.refs,options.referenceSource,options.referenceLink),nextHTML=next?'<div class="node-next-card"><b>'+esc(next.trade||'未分類')+'｜'+esc(next.name||'')+'</b><div class="muted">'+(next.start?esc(fmtDate(next.start)):'日期未設定')+'</div></div>':'<div class="muted node-empty">尚無後續工序</div>',nextSection=options.kind==='protection'?'':'<section class="node-section"><div class="node-section-head"><b>接下來施工</b></div>'+nextHTML+'</section>';return '<div class="project-site node-template" data-site-project="'+esc(project.id)+'" data-site-date="'+esc(projectSiteDate())+'" data-site-step-index="'+stepIndex+'" data-site-step-trade="'+esc(step.trade||'')+'" data-site-step-name="'+esc(step.name||'')+'">'+notesHTML+acceptanceHTML+refs+'<section class="node-section"><div class="node-section-head"><b>本案工程照片</b><span class="muted">'+photos.length+' 張</span></div>'+projectNodePhotosHTML(photos)+'<button type="button" class="light node-small-button" data-site-action="upload">＋新增照片</button><input type="file" accept="image/*" multiple data-site-files hidden></section>'+nextSection+'</div>';}
function projectProtectionNodeHTML(project,step){const refs=projectProtectionReferencePhotos(step),index=refs.length?(refs[0].group.source==='2022'?refs[0].group.ti:refs[0].group.customIndex):0,link=refs.length?'<button class="back" onclick="openLibraryTrade(\''+esc(refs[0].group.source)+'\','+index+')">查看全部 ＞</button>':'';return projectNodeTemplateHTML(project,step,{kind:'protection',checks:projectProtectionChecks(step),notes:step.notes,refs,referenceSource:'木作資料庫 → 保護',referenceLink:link});}
const WATERPROOF_NOTES=['牆角、管根、門檻收頭需完整','防水高度依圖面確認','表面不得有破損、起泡','完成後確認乾燥／養護時間','後續工種進場前避免踩踏破壞'];
const WATERPROOF_CHECKLIST=['施工區域是否完成清潔','牆角／陰陽角補強完成','管根周圍防水完成','防水高度符合圖面','防水層無破損','門檻／止水墩位置確認','完成照片已記錄'];
function projectWaterproofReferencePhotos(step){if(Array.isArray(step.referencePhotos)&&step.referencePhotos.length)return step.referencePhotos;const group=(typeof libraryGroups==='function'?libraryGroups():[]).find(item=>item.name==='泥作'),trade=group&&(group.source==='2022'?data.trades[group.ti]:libData[group.customIndex]);return (trade?.photos||[]).filter(photo=>/防水|基礎/.test((photo.title||'')+' '+(photo.note||''))).slice(0,3);}
function projectWaterproofNodeHTML(project,step){const refs=projectWaterproofReferencePhotos(step);return projectNodeTemplateHTML(project,step,{kind:'waterproof',checks:Array.isArray(step.checklist)?step.checklist:[],notes:Array.isArray(step.notes)&&step.notes.length?step.notes:WATERPROOF_NOTES,refs,referenceSource:'泥作資料庫 → 基礎防水',referenceLink:''});}
function addNodeChecklist(projectId,stepIndex,kind){const step=data.projects.find(project=>project.id===projectId)?.steps?.[stepIndex],label=prompt('新增確認項目');if(!step||!label?.trim())return;if(kind==='protection'){const checks=projectProtectionChecks(step);step.protectionChecks=[...checks,{id:dailyReportId(),label:label.trim(),checked:false,checkedAt:''}];}else step.checklist=[...(step.checklist||[]),{id:dailyReportId(),label:label.trim(),checked:false,checkedAt:''}];save();openProject(projectId,'overview');}
function confirmNodeAcceptance(projectId,stepIndex){const step=data.projects.find(project=>project.id===projectId)?.steps?.[stepIndex];if(!step)return;const checks=String(step.name||'').includes('保護')?projectProtectionChecks(step):(step.checklist||[]);if(!checks.every(item=>item.checked))return;step.acceptanceConfirmed=true;step.acceptanceConfirmedAt=new Date().toISOString();save();openProject(projectId,'overview');}
function openWaterproofChecklist(projectId,stepIndex){const project=data.projects.find(item=>item.id===projectId),step=project?.steps?.[stepIndex];if(!step)return;const refs=projectWaterproofReferencePhotos(step),reference=refs.length?'<div style="display:flex;gap:8px">'+refs.map(photo=>'<img src="'+esc(photo.data||photo.url||'')+'" alt="'+esc(photo.title||'基礎防水參考')+'" style="width:72px;height:72px;object-fit:cover;border-radius:8px">').join('')+'</div>':'<div class="muted">目前沒有可預覽的資料庫照片</div>';openModal('<div class="project-site"><h2>加入確認清單</h2><label>選擇工種<select disabled><option>泥作</option></select></label><label>選擇施工節點<select disabled><option>基礎防水</option></select></label><div class="section"><b>確認項目</b></div>'+WATERPROOF_CHECKLIST.map(item=>'<div class="row">□ '+esc(item)+'</div>').join('')+'<div class="section">參考照片</div><div class="muted">泥作資料庫 → 基礎防水</div>'+reference+'<div class="actions" style="margin-top:15px"><button class="light" onclick="closeModal()">取消</button><button onclick="saveWaterproofChecklist('+projectId+','+stepIndex+')">加入</button></div></div>');}
function saveWaterproofChecklist(projectId,stepIndex){const step=data.projects.find(item=>item.id===projectId)?.steps?.[stepIndex];if(!step)return;step.checklist=WATERPROOF_CHECKLIST.map(label=>({id:dailyReportId(),label,checked:false,checkedAt:''}));save();closeModal();openProject(projectId,'overview');}
function projectSummaryItems(title,steps,project){const current=title==='現在施工';return '<div class="section"><b>'+title+'</b></div><div class="card">'+(steps.length?steps.map(step=>{const protection=current&&step.trade==='木作'&&step.name==='保護',waterproof=current&&isSWD2601Project(project)&&step.trade==='泥作'&&step.name==='全室基礎防水',reminder=step.hasAcceptanceNode?projectAcceptanceSummaryHTML(project,step):'',notes=(step.notes||[]).length?'<div style="margin-top:10px"><b>注意事項</b>'+(step.notes||[]).map(note=>'<div class="muted" style="margin-top:6px">□ '+esc(note)+'</div>').join('')+'</div>':'',upcomingReminder=!current&&step.trade==='木作'&&step.name==='放樣'?'<div style="margin-top:10px"><b>施工前提醒</b>'+['確認完成面基準','確認浴室止水墩尺寸','確認隔間定位'].map(note=>'<div class="muted" style="margin-top:6px">- '+note+'</div>').join('')+'</div>':'',heading=waterproof?'<div style="font-size:25px;font-weight:700;color:#222">'+esc(step.trade||'未分類')+'｜'+esc(step.name)+'</div><div class="muted" style="font-size:16px;font-weight:400;margin-top:5px;margin-bottom:20px">'+esc(fmtDate(step.start))+' ～ '+esc(fmtDate(step.end))+'</div>':'<b>'+esc(step.trade||'未分類')+'｜'+esc(step.name)+'</b><div class="muted">'+esc(fmtDate(step.start))+' ～ '+esc(fmtDate(step.end))+'</div>';return '<div class="row"><div style="flex:1">'+heading+(current?(waterproof?projectWaterproofNodeHTML(project,step):protection?projectProtectionNodeHTML(project,step):reminder+notes):upcomingReminder)+'</div>'+(!protection&&!waterproof?'<span class="tag">'+projectStepProgress(step)+'%</span>':'')+'</div>';}).join(''):'<div class="muted">'+(current?'目前沒有排定施工中的工程。':'尚無後續工程')+'</div>')+'</div>';}
function confirmStepAcceptance(projectId,stepIndex){const step=data.projects.find(project=>project.id===projectId)?.steps?.[stepIndex];if(!step||!step.hasAcceptanceNode)return;step.acceptanceConfirmed=true;step.acceptanceConfirmedAt=new Date().toISOString();save();openProject(projectId,'overview');}
function confirmProtectionAcceptance(projectId,stepIndex){const project=data.projects.find(item=>item.id===projectId),step=project?.steps?.[stepIndex];if(!step||!String(step.name||'').includes('保護')||!projectProtectionChecks(step).every(item=>item.checked))return;step.acceptanceConfirmed=true;step.acceptanceConfirmedAt=new Date().toISOString();save();openProject(projectId,'overview');}
function projectOverviewConfirmationHTML(project){const confirmation=nextSiteConfirmation(project);return '<section class="project-site" data-site-project="'+esc(project.id)+'" data-site-persistent="true" data-site-date="'+esc(projectSiteDate())+'"><div class="section"><b>下一次現場確認</b></div><div class="card"><div data-site-checks>'+projectSiteChecksHTML(confirmation)+'</div><button type="button" class="light" data-site-action="show-next-site-add">＋ 新增現場事項</button><form data-site-next-check-form hidden style="margin-top:10px"><input name="text" placeholder="今天要確認什麼？" autocomplete="off" required><button type="submit">新增</button></form><div class="muted" data-site-message role="status"></div></div></section>';}
function projectOverviewHTML(project){
  const confirmation=nextSiteConfirmation(project),nodes=typeof workflowProjectNodes==='function'?workflowProjectNodes(project):[],checks=nodes.reduce((sum,node)=>sum+(node.checklist||[]).length,0),doneChecks=nodes.reduce((sum,node)=>sum+(node.checklist||[]).filter(item=>item.done).length,0);
  const swd=isSWD2601Project(project),viewDate=projectViewDate(),isTest=swd&&viewDate!==projectTodayISO(),dateControl=swd?'<div class="card" style="padding:9px 12px;display:flex;gap:8px;align-items:center;justify-content:center"><button class="light" style="padding:5px 9px" onclick="shiftProjectViewDate('+project.id+',-1)">‹</button><input type="date" value="'+viewDate+'" onchange="setProjectViewDate('+project.id+',this.value)" style="width:auto;margin:0;padding:5px;border:0;background:transparent;text-align:center"><button class="light" style="padding:5px 9px" onclick="shiftProjectViewDate('+project.id+',1)">›</button><button class="light" style="padding:5px 8px" onclick="resetProjectViewDate('+project.id+')">回到今天</button>'+ (isTest?'<span class="tag" style="color:#888">測試日期</span>':'')+'</div>':'',timeline=swd?'':'<div class="section"><b>施工時間軸</b></div><div class="card">'+projectGanttHTML(project,true)+'</div>',weekSummary=swd?projectWeekSummaryGanttHTML(project,viewDate):'',pending='';
  return '<div class="card buildflow-overview-stats"><div><span class="muted">工期</span><b>'+esc(projectSchedulePeriodLabel(project))+'</b></div><div><span class="muted">總進度</span><b>'+projectTotalScheduleProgress(project)+'%</b></div></div>'+dateControl+weekSummary+timeline+projectSummaryItems('現在施工',projectCurrentSteps(project,viewDate),project)+projectSummaryItems('接下來施工',projectUpcomingSteps(project,viewDate),project)+pending;
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
  const chart=isSWD2601Project(project)?'':'<div class="section"><b>施工時間圖 / Gantt</b><span class="muted">讀取下方工程進度表日期</span></div><div class="card">'+projectGanttHTML(project)+'</div>';
  return chart+'<div class="section"><b>工程進度表</b><span class="muted">依工種分組；日期直接編輯</span></div>'+(groups||'<div class="empty">目前沒有工程項目。</div>');
}
function openProject(id,tab='overview'){
  const p=data.projects.find(x=>x.id===id);if(!p)return;
  releaseDailyPhotoViews();
  let siteError='';try{if(!(isSWD2601Project(p)&&tab==='overview'&&projectViewDate()!==projectTodayISO()))ensureProjectSiteAppointments(p);}catch(error){siteError='到期事項尚未儲存：'+error.message;}
  const tabs=[['overview','概要'],['schedule','工程表'],['inspection','施工檢查'],['weekly','本週紀錄']];
  const swd=isSWD2601Project(p),content=tab==='schedule'?(swd?swdStepsOverviewHTML(p):'')+projectScheduleTableHTML(p):tab==='inspection'?workflowProjectHTML(p):tab==='weekly'?projectWeeklyHTML(p):projectOverviewHTML(p);
  main.innerHTML='<button class="back" onclick="home()">← 返回</button><div class="card"><span class="tag">'+esc(p.status)+'</span><h2>'+esc(p.name)+'</h2><div class="muted">'+esc(p.client)+'　｜　'+esc(projectSchedulePeriodLabel(p))+'</div><div style="margin:15px 0 7px" class="bar"><div class="fill" style="width:'+projectTotalScheduleProgress(p)+'%"></div></div><b>'+projectTotalScheduleProgress(p)+'%</b><div style="margin-top:12px"><button class="light" onclick="openProjectData('+id+')">專案資料</button></div></div><div class="buildflow-tabs" role="tablist">'+tabs.map(item=>'<button role="tab" aria-selected="'+(tab===item[0])+'" onclick="openProject('+id+',\''+item[0]+'\')">'+item[1]+'</button>').join('')+'</div>'+content;
  bindProjectSite(p);if(siteError)projectSiteMessage(main,siteError);
}
function reorderProject(id){let p=data.projects.find(x=>x.id===id);openModal('<h2>編排施工順序</h2><div class="hint">由上到下就是施工順序。按 ↑ ↓ 調整，系統會同步更新「下一步」提示。</div>'+p.steps.map((s,i)=>'<div class="card" style="padding:12px"><b>'+esc(s.name)+'</b><div class="muted">'+esc(s.trade)+'</div><div style="margin-top:8px"><button class="orderbtn" onclick="moveProjectStep('+id+','+i+',-1)">↑ 上移</button> <button class="orderbtn" onclick="moveProjectStep('+id+','+i+',1)">↓ 下移</button></div></div>').join('')+'<button style="width:100%" onclick="closeModal();openProject('+id+')">完成編排</button>')}

function moveProjectStep(id,i,dir){let p=data.projects.find(x=>x.id===id),n=i+dir;if(n<0||n>=p.steps.length)return;[p.steps[i],p.steps[n]]=[p.steps[n],p.steps[i]];p.steps.forEach((s,k)=>s.next=(k<p.steps.length-1?p.steps[k+1].name:''));save();closeModal();reorderProject(id)}


function completeStep(id,i){const s=data.projects.find(p=>p.id===id)?.steps[i];if(!s)return;s.done=true;if(!s.actualCompletedAt)s.actualCompletedAt=new Date().toISOString();save();openProject(id)}

const NEXT_STEP_SUGGESTIONS={保護:[{name:'拆除',description:'若有既有裝修需要拆除，通常保護完成後先進行拆除。'},{name:'水電前置',description:'若需要先斷水、斷電、配置臨時電或設備移位，可先安排水電前置。'}]};
const PROTECTION_COMPLETION_CHECKS=[['protectionComplete','保護作業完成'],['propertyProtectionConfirmed','大樓／物業確認保護範圍'],['routeConfirmed','搬運動線確認'],['photosSaved','現場拍照留存'],['propertyAccepted','物業／大樓驗收通過']];
function nextStepSuggestions(name){return Object.entries(NEXT_STEP_SUGGESTIONS).find(([key])=>String(name||'').includes(key))?.[1]||[];}
function acceptanceEditorItemsHTML(items){return '<div id="acceptanceCheckItems">'+items.map((item,index)=>'<div class="acceptance-editor-item"><input data-acceptance-item value="'+esc(item.label||item.text||'')+'" placeholder="驗收確認項目"><button type="button" class="light" onclick="this.parentElement.remove()">刪除</button></div>').join('')+'</div>';}
function acceptanceReminderHTML(step){const required=projectRequiresInspection(step),items=projectStepInspectionChecks(step);return '<div class="acceptance-settings"><b>驗收設定</b><label class="workflow-check"><input id="requireInspection" type="checkbox" '+(required?'checked':'')+' onchange="toggleAcceptanceSettings(this.checked)">此工項需要驗收</label><div id="acceptanceSettingsFields" '+(required?'':'hidden')+'><label>驗收名稱<input id="acceptanceName" value="'+esc(step.acceptanceName||step.acceptance?.label||(step.name==='保護'?'管委會驗收':''))+'" placeholder="例如：管委會驗收"></label><label>驗收提醒文字<input id="acceptanceReminder" value="'+esc(step.acceptanceReminder||'')+'" placeholder="例如：保護完成請大樓確認"></label><div class="section"><b>驗收確認項目</b><button type="button" class="light" onclick="addAcceptanceEditorItem()">＋ 新增</button></div>'+acceptanceEditorItemsHTML(items)+'</div><div class="muted">開啟後，概要頁顯示驗收節點，不再顯示一般確認清單。</div></div>';}
function toggleAcceptanceSettings(show){const fields=document.getElementById('acceptanceSettingsFields');if(fields)fields.hidden=!show;}
function addAcceptanceEditorItem(){const root=document.getElementById('acceptanceCheckItems');if(root)root.insertAdjacentHTML('beforeend','<div class="acceptance-editor-item"><input data-acceptance-item placeholder="驗收確認項目"><button type="button" class="light" onclick="this.parentElement.remove()">刪除</button></div>');}
function nextStepSuggestionsHTML(step){const suggestions=nextStepSuggestions(step.name);return '<div style="margin-top:12px;padding:12px;background:#f7f7f5;border:1px solid #e8e8e4;border-radius:10px"><b>系統建議後續工程</b>'+(suggestions.length?suggestions.map(item=>'<div class="row" style="padding:9px 0"><div style="flex:1"><b>'+esc(item.name)+'</b><div class="muted">'+esc(item.description)+'</div></div><button type="button" class="light" onclick="selectSuggestedNextStep(\''+esc(item.name)+'\')">選擇</button></div>').join(''):'<div class="muted" style="margin-top:8px">目前沒有系統建議</div>')+'</div>';}
function selectSuggestedNextStep(name){const select=document.getElementById('snext');if(!select)return;const existing=Array.from(select.options).find(option=>option.textContent.endsWith('｜'+name));if(existing){select.value=existing.value;return;}const option=document.createElement('option');option.value='S:'+name;option.textContent=name;select.appendChild(option);select.value=option.value;}
function stepDurationDays(step){return Number.isInteger(Number(step.durationDays))&&Number(step.durationDays)>0?Number(step.durationDays):scheduleDays(step.start,step.end)||1;}
function stepDateFieldsHTML(step){const duration=stepDurationDays(step);return '<div id="stepScheduleMode" data-mode="duration"><div style="padding:12px;background:#f7f7f5;border:1px solid #e8e8e4;border-radius:10px"><div class="grid"><div><label>開始日期</label><input id="ss" type="date" value="'+esc(step.start||'')+'" oninput="syncStepDurationEnd()"></div><div><label>工期（日）</label><input id="sd" type="number" min="1" step="1" value="'+duration+'" oninput="syncStepDurationEnd()"></div></div><div id="stepComputedEnd" class="hint"></div></div></div>';}
function syncStepDurationEnd(){const start=document.getElementById('ss')?.value,duration=Number(document.getElementById('sd')?.value),label=document.getElementById('stepComputedEnd');if(!label)return;if(!isCompleteScheduleDate(start)||!Number.isInteger(duration)||duration<1){label.textContent='';return;}label.textContent='系統結束日期：'+fmtDate(shiftScheduleDate(start,duration-1));}
function setStepScheduleMode(mode){const root=document.getElementById('stepScheduleMode');if(!root)return;root.dataset.mode=mode;root.querySelectorAll('[data-step-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.stepMode===mode)));document.getElementById('stepDurationField').hidden=mode!=='duration';document.getElementById('stepEndField').hidden=mode!=='end';document.getElementById('stepComputedEnd').hidden=mode!=='duration';if(mode==='duration')syncStepDurationEnd();}
function stepDetail(id,i){let p=data.projects.find(x=>x.id===id),s=p.steps[i],deleteButton=isSWD2601Project(p)?'<button class="light danger" onclick="deleteProjectStep('+id+','+i+')">刪除工程</button>':'';openModal('<h2>編輯工項</h2><label>工項名稱</label><input id="sn" value="'+esc(s.name)+'"><label>工種</label><input id="st" value="'+esc(s.trade)+'">'+stepDateFieldsHTML(s)+acceptanceReminderHTML(s)+'<label>前置工程</label><input id="spredecessor" value="'+esc(s.predecessor||'')+'" placeholder="例如：保護工程"><label>後續工程</label><input id="snext" value="'+esc(s.next||'')+'" placeholder="例如：拆除"><div class="actions" style="margin-top:15px">'+deleteButton+'<button class="light" onclick="closeModal()">取消</button><button onclick="saveStepEdit('+id+','+i+')">儲存修改</button></div>');syncStepDurationEnd()}

function deleteProjectStep(id,i){const project=data.projects.find(item=>item.id===id),step=project?.steps?.[i];if(!isSWD2601Project(project)||!step||!confirm('刪除工程「'+step.name+'」？'))return;project.steps.splice(i,1);project.steps.forEach(item=>{if(item.next===step.name)item.next='';});save();closeModal();openProject(id,'overview');}

function saveStepEdit(id,i){
  const p=data.projects.find(x=>x.id===id),s=p.steps[i];
  const name=document.getElementById('sn').value.trim(),trade=document.getElementById('st').value.trim()||'自訂';
  const startInput=document.getElementById('ss'),mode='duration',durationInput=document.getElementById('sd'),duration=Number(durationInput?.value),start=startInput.value,end=isCompleteScheduleDate(start)&&Number.isInteger(duration)&&duration>=1?shiftScheduleDate(start,duration-1):'';
  if(!name)return;
  if(startInput.validity.badInput||!Number.isInteger(duration)||duration<1||(start&&!isCompleteScheduleDate(start))||(end&&!isCompleteScheduleDate(end)))return;
  if(!scheduleDateRangeValid(start,end)){alert('結束日期不能早於開始日期');return;}
  const next=document.getElementById('snext')?.value.trim()||'',predecessor=document.getElementById('spredecessor')?.value.trim()||'',requireInspection=document.getElementById('requireInspection')?.checked||false,acceptanceName=document.getElementById('acceptanceName')?.value.trim()||'',acceptanceReminder=document.getElementById('acceptanceReminder')?.value.trim()||'',acceptanceChecks=Array.from(document.querySelectorAll('[data-acceptance-item]')).map(input=>input.value.trim()).filter(Boolean).map((label,index)=>({id:projectStepInspectionChecks(s)[index]?.id||dailyReportId(),label,checked:projectStepInspectionChecks(s)[index]?.checked||false,checkedAt:projectStepInspectionChecks(s)[index]?.checkedAt||''}));
  Object.assign(s,{name,trade,start,end,scheduleMode:mode,durationDays:scheduleDays(start,end)||duration,predecessor,next,requireInspection,acceptanceName,acceptanceReminder,hasAcceptanceNode:requireInspection});if(Array.isArray(s.protectionChecks))s.protectionChecks=acceptanceChecks;else s.acceptanceChecks=acceptanceChecks;
  save();closeModal();openProject(id);
}

function viewProjectLibrarySource(tradeName,itemName){const src=libraryItemSource(tradeName,itemName);if(!src){alert('工種庫中找不到原始資料，這個工程項目仍可獨立使用。');return;}closeModal();if(src.source==='2022')exampleLibraryItemDetail(src.ti,src.j);else libraryDetail(src.customIndex,src.j)}

function addNote(id,i){let n=prompt('新增注意事項');if(n){data.projects.find(p=>p.id===id).steps[i].notes.push(n);save();closeModal();stepDetail(id,i)}}

function editNote(id,i,j){let a=data.projects.find(p=>p.id===id).steps[i].notes,n=prompt('修改注意事項',a[j]);if(n!==null&&n.trim()){a[j]=n.trim();save();closeModal();stepDetail(id,i)}}

function delNote(id,i,j){const s=data.projects.find(p=>p.id===id).steps[i];s.notes.splice(j,1);if(s.noteChecks)s.noteChecks.splice(j,1);save();closeModal();stepDetail(id,i)}

function addProjectStep(id){const project=data.projects.find(item=>item.id===id),swd=isSWD2601Project(project),predecessorOpts=(project?.steps||[]).map(step=>'<option>'+esc(step.trade+'｜'+step.name)+'</option>').join(''),scheduleFields=swd?'<div class="grid"><label>開始日期<input id="as" type="date" required></label><label>天數<input id="ad" type="number" min="1" step="1" value="1" required></label></div><label>進度（%）<input id="ap" type="number" min="0" max="100" value="0"></label><label>前置工程<select id="apredecessor"><option value="">未設定</option>'+predecessorOpts+'</select></label>':'';openModal('<h2>新增自訂工項</h2><label>工項名稱</label><input id="n"><label>工種</label><input id="t">'+scheduleFields+acceptanceReminderHTML({})+'<label>下一步</label><input id="nx"><label>注意事項（每行一項）</label><textarea id="nt"></textarea><div class="actions"><button class="light" onclick="closeModal()">取消</button><button onclick="saveStep('+id+')">加入</button></div>')}

function saveStep(id){const project=data.projects.find(p=>p.id===id),name=document.getElementById('n')?.value.trim(),trade=document.getElementById('t')?.value.trim()||'未分類',start=document.getElementById('as')?.value||'',days=Number(document.getElementById('ad')?.value),end=isCompleteScheduleDate(start)&&Number.isInteger(days)&&days>=1?shiftScheduleDate(start,days-1):'',progressInput=document.getElementById('ap'),progress=Number(progressInput?.value),predecessor=document.getElementById('apredecessor')?.value||'',requireInspection=document.getElementById('requireInspection')?.checked||false,acceptanceChecks=Array.from(document.querySelectorAll('[data-acceptance-item]')).map(input=>input.value.trim()).filter(Boolean).map(label=>({id:dailyReportId(),label,checked:false,checkedAt:''}));if(!project||!name)return;if(isSWD2601Project(project)&&(!isCompleteScheduleDate(start)||!isCompleteScheduleDate(end)||!Number.isFinite(progress)||progress<0||progress>100)){alert('請完整填寫開始日期、天數與 0 至 100 的進度。');return;}project.steps.push({name,trade,next:document.getElementById('nx')?.value||'',notes:(document.getElementById('nt')?.value||'').split('\n').filter(Boolean),requireInspection,acceptanceName:document.getElementById('acceptanceName')?.value.trim()||'',acceptanceReminder:document.getElementById('acceptanceReminder')?.value.trim()||'',acceptanceChecks,done:progressInput?progress===100:false,...(progressInput?{start,end,scheduleMode:'duration',durationDays:days,progress:Math.round(progress),predecessor:predecessor.includes('｜')?predecessor.split('｜').pop():predecessor}:{})});save();closeModal();openProject(id,'overview')}

let newProjectGroups=[];
function projectSummaryItems(title,steps,project){const current=title==='現在施工';const rows=steps.map(step=>{const protection=step.trade==='木作'&&step.name==='保護',waterproof=step.trade==='泥作'&&step.name==='全室基礎防水',special=current,date=step.start?fmtDate(step.start)+(step.end&&step.end!==step.start?' ～ '+fmtDate(step.end):''):'日期未設定',heading='<div class="node-current-heading"><b>'+esc(step.trade||'未分類')+'｜'+esc(step.name)+'</b><div class="muted">'+esc(date)+'</div></div>',body=special?(protection?projectProtectionNodeHTML(project,step):waterproof?projectWaterproofNodeHTML(project,step):projectNodeTemplateHTML(project,step,{kind:'generic',checks:step.checklist||[],notes:step.notes,refs:step.referencePhotos||[],referenceSource:'資料庫參考',referenceLink:''})):((step.notes||[]).length?'<div class="node-notes">'+(step.notes||[]).map(note=>'<div class="muted node-note">'+esc(note)+'</div>').join('')+'</div>':'');return '<div class="row node-current-row"><div style="flex:1">'+heading+body+'</div><span class="tag">'+projectStepProgress(step)+'%</span></div>';}).join('');return '<div class="section"><b>'+title+'</b></div><div class="card node-current-card">'+(rows||'<div class="muted">'+(current?'目前沒有排定施工中的工程。':'尚無後續工程')+'</div>')+'</div>';}
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
