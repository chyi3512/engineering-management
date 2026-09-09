/* 工程詳細頁的每日現場紀錄。工期與工種庫只讀；文字沿用 save()，照片沿用日報照片庫。 */
let projectSitePending=0;
const SITE_STATUSES=['待確認','待處理','已處理'];
function projectSiteDate(){return localDateISO(new Date());}
function projectSiteDay(project,date=projectSiteDate()){
  return project.siteDays?.[date]||{id:'site:'+date,projectId:project.id,date,checks:[],trades:[],photos:[]};
}
function projectSiteUpdate(project,update){
  const keys=['siteDays','siteAppointments','siteReports'],previous=keys.map(key=>({key,had:Object.prototype.hasOwnProperty.call(project,key),value:project[key]}));
  for(const entry of previous)if(entry.had)project[entry.key]=JSON.parse(JSON.stringify(entry.value));
  try{update();save();}catch(error){for(const entry of previous){if(entry.had)project[entry.key]=entry.value;else delete project[entry.key];}throw error;}
}
function projectSiteWriteDay(project,date,update){
  projectSiteUpdate(project,()=>{project.siteDays||={};project.siteDays[date]||=projectSiteDay(project,date);update(project.siteDays[date]);});
}
function projectSiteCheck(text,appointmentId=''){return {id:dailyReportId(),text,done:false,note:'',status:'待確認',photoIds:[],appointmentId};}
function ensureProjectSiteAppointments(project,date=projectSiteDate()){
  const due=(project.siteAppointments||[]).filter(item=>!item.generatedItemId&&isCompleteScheduleDate(item.date)&&item.date<=date);
  if(!due.length)return false;
  projectSiteUpdate(project,()=>{
    project.siteDays||={};project.siteDays[date]||=projectSiteDay(project,date);
    for(const source of due){
      const appointment=project.siteAppointments.find(item=>item.id===source.id);
      // 同時檢查來源 ID，可相容已有現場項目、但來源標記未完整的備份。
      let found;for(const day of Object.values(project.siteDays)){const item=day.checks.find(check=>check.appointmentId===appointment.id);if(item){found={item,date:day.date};break;}}
      if(!found){const item=projectSiteCheck(appointment.text,appointment.id);project.siteDays[date].checks.push(item);found={item,date};}
      appointment.generatedItemId=found.item.id;appointment.generatedDate=found.date;
    }
  });return true;
}
function projectSiteTopHTML(project){
  const day=projectSiteDay(project),date=day.date;
  return '<section class="project-site" data-site-project="'+esc(project.id)+'" data-site-date="'+date+'"><div class="section"><b>現場確認（今日）</b><span class="muted">'+date+'</span></div><div class="card"><div data-site-checks>'+projectSiteChecksHTML(day)+'</div><input data-site-new-check aria-label="新增現場確認事項" placeholder="輸入事項，按 Enter 新增" autocomplete="off"><div class="muted" data-site-message role="status"></div></div><div class="section"><b>今日到場</b></div><div class="card site-trades">'+[...new Set([...dailyTradeNames(),...(project.steps||[]).map(step=>step.trade),...day.trades])].filter(Boolean).map(trade=>'<label class="site-check"><input type="checkbox" data-site-trade="'+esc(trade)+'" '+(day.trades.includes(trade)?'checked':'')+'><span>'+esc(trade)+'</span></label>').join('')+'</div></section>';
}
function projectSiteChecksHTML(day){
  return day.checks.map(item=>'<div class="site-check-row"><label class="site-check" aria-label="完成 '+esc(item.text)+'"><input type="checkbox" data-site-check="'+esc(item.id)+'" '+(item.done?'checked':'')+'></label><button class="site-item-text" data-site-action="detail" data-item-id="'+esc(item.id)+'"><span>'+esc(item.text)+'</span><small class="muted">'+(item.done?'已完成 · ':'')+esc(item.status)+(item.note?' · 備註':'')+(item.photoIds.length?' · 照片 '+item.photoIds.length:'')+(item.issueId?' · 已轉為問題':'')+'</small></button></div>').join('')||'<p class="muted">尚無確認事項</p>';
}
function projectSiteBottomHTML(project){
  const day=projectSiteDay(project);
  return '<section class="project-site" data-site-project="'+esc(project.id)+'" data-site-date="'+day.date+'"><div class="section"><b>預約／後續事項</b></div><div class="card"><div data-site-appointments>'+projectSiteAppointmentsHTML(project)+'</div><form data-site-appointment-form><label>預約日期<input type="date" name="date" value="'+day.date+'" required></label><label>事項<input name="text" placeholder="輸入事項，按 Enter 儲存" required></label><button type="submit" class="light">儲存預約</button></form></div><div class="section"><b>今日照片</b></div><div class="card"><div class="site-actions"><button class="light" data-site-action="upload">上傳多張照片</button><button class="light" data-site-action="camera">拍照</button></div><input type="file" accept="image/*" multiple data-site-files hidden><input type="file" accept="image/*" capture="environment" data-site-camera hidden><div class="site-photos" data-site-photos>'+projectSitePhotosHTML(day)+'</div><div data-site-message class="muted" role="status"></div></div><div class="section"><b>產生今日工程日報</b></div><div class="card"><p class="muted">直接帶入今天的現場確認、到場工種、預約事項與照片。</p><button data-site-action="generate">產生今日工程日報</button><div data-site-history>'+(project.siteReports||[]).slice().reverse().map(report=>'<div class="row"><button class="light" data-site-action="view-report" data-report-id="'+esc(report.id)+'">'+esc(report.date)+' 日報 · '+esc(new Date(report.createdAt).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'}))+'</button></div>').join('')+'</div><div data-site-message class="muted" role="status"></div></div></section>';
}
function projectSiteAppointmentsHTML(project){
  return (project.siteAppointments||[]).slice().sort((a,b)=>a.date.localeCompare(b.date)).map(item=>'<div class="row"><div style="flex:1">'+esc(item.date)+'<br>'+esc(item.text)+'<div class="muted">'+(item.generatedItemId?'已加入 '+esc(item.generatedDate)+' 現場確認':'屆期自動加入現場確認')+'</div></div>'+(!item.generatedItemId?'<button class="light" data-site-action="remove-appointment" data-item-id="'+esc(item.id)+'">刪除</button>':'')+'</div>').join('')||'<p class="muted">尚無預約事項</p>';
}
function projectSitePhotosHTML(day,itemId){
  const photos=itemId?day.photos.filter(photo=>day.checks.find(item=>item.id===itemId)?.photoIds.includes(photo.id)):day.photos;
  return photos.map(photo=>'<div class="site-photo"><button class="site-photo-preview" data-site-action="preview" data-photo-id="'+esc(photo.id)+'"><img data-daily-photo="'+esc(photo.id)+'" alt="現場照片"></button><input aria-label="照片簡短說明" data-site-caption="'+esc(photo.id)+'" value="'+esc(photo.description||'')+'" placeholder="簡短說明"><button class="light" data-site-action="remove-photo" data-photo-id="'+esc(photo.id)+'">刪除照片</button></div>').join('');
}
function projectSiteMessage(root,message){root?.querySelectorAll('[data-site-message]').forEach(el=>el.textContent=message);}
function bindProjectSite(project){
  for(const root of main.querySelectorAll('[data-site-project]')){
    root.addEventListener('click',projectSiteAction);
    root.addEventListener('change',projectSiteInput);
    root.addEventListener('input',event=>{if(event.target.matches('[data-site-caption]'))projectSiteInput(event);});
    root.addEventListener('keydown',event=>{
      if(event.target.matches('[data-site-new-check]')&&event.key==='Enter'&&!event.isComposing&&event.keyCode!==229){
        event.preventDefault();const text=event.target.value.trim();if(!text)return;
        try{projectSiteWriteDay(project,root.dataset.siteDate,day=>day.checks.push(projectSiteCheck(text)));event.target.value='';root.querySelector('[data-site-checks]').innerHTML=projectSiteChecksHTML(projectSiteDay(project,root.dataset.siteDate));}catch(error){projectSiteMessage(root,'尚未儲存：'+error.message);}
      }
    });
    root.addEventListener('submit',event=>{
      if(!event.target.matches('[data-site-appointment-form]'))return;event.preventDefault();
      const form=event.target,date=form.elements.date.value,text=form.elements.text.value.trim();if(!form.reportValidity()||!isCompleteScheduleDate(date)||!text)return;
      try{projectSiteUpdate(project,()=>{project.siteAppointments||=[];project.siteAppointments.push({id:dailyReportId(),date,text,generatedItemId:'',generatedDate:''});});ensureProjectSiteAppointments(project);form.elements.text.value='';refreshProjectSite(project);}catch(error){projectSiteMessage(root,'尚未儲存：'+error.message);}
    });
    loadDailyPhotoImages(projectSiteDay(project,root.dataset.siteDate),root);
  }
}
function refreshProjectSite(project){
  for(const root of main.querySelectorAll('[data-site-project]')){
    if(String(project.id)!==root.dataset.siteProject)continue;
    const day=projectSiteDay(project,root.dataset.siteDate),checks=root.querySelector('[data-site-checks]'),appointments=root.querySelector('[data-site-appointments]'),photos=root.querySelector('[data-site-photos]');
    if(checks)checks.innerHTML=projectSiteChecksHTML(day);if(appointments)appointments.innerHTML=projectSiteAppointmentsHTML(project);
    if(photos){photos.innerHTML=projectSitePhotosHTML(day);loadDailyPhotoImages(day,photos);}
  }
}
function projectSiteInput(event){
  const input=event.target,root=input.closest('[data-site-project]');if(!root)return;
  const project=dailyProject(root.dataset.siteProject),date=root.dataset.siteDate;if(!project)return;
  if(input.matches('[data-site-files],[data-site-camera]')){if(event.type==='change'){const files=Array.from(input.files);input.value='';addProjectSitePhotos(project,date,files,root.dataset.siteItem||'',root);}return;}
  try{
    if(input.hasAttribute('data-site-check')){projectSiteWriteDay(project,date,day=>{const item=day.checks.find(check=>check.id===input.dataset.siteCheck);if(item)item.done=input.checked;});const row=input.closest('.site-check-row');row.outerHTML=projectSiteChecksHTML({...projectSiteDay(project,date),checks:projectSiteDay(project,date).checks.filter(item=>item.id===input.dataset.siteCheck)});}
    if(input.hasAttribute('data-site-trade'))projectSiteWriteDay(project,date,day=>{day.trades=input.checked?[...new Set([...day.trades,input.dataset.siteTrade])]:day.trades.filter(trade=>trade!==input.dataset.siteTrade);});
    if(input.hasAttribute('data-site-caption'))projectSiteWriteDay(project,date,day=>{const photo=day.photos.find(photo=>photo.id===input.dataset.siteCaption);if(photo)photo.description=input.value;});
  }catch(error){if(input.type==='checkbox')input.checked=!input.checked;projectSiteMessage(root,'尚未儲存：'+error.message);}
}
async function projectSiteAction(event){
  const button=event.target.closest('[data-site-action]');if(!button)return;
  const root=button.closest('[data-site-project]'),project=dailyProject(root?.dataset.siteProject),date=root?.dataset.siteDate;if(!project)return;
  const action=button.dataset.siteAction;
  try{
    if(action==='detail')openProjectSiteItem(project.id,date,button.dataset.itemId);
    if(action==='upload'||action==='camera')root.querySelector(action==='camera'?'[data-site-camera]':'[data-site-files]').click();
    if(action==='remove-appointment'){projectSiteUpdate(project,()=>{project.siteAppointments=project.siteAppointments.filter(item=>item.id!==button.dataset.itemId||item.generatedItemId);});refreshProjectSite(project);}
    if(action==='remove-photo'){
      const day=projectSiteDay(project,date),photo=day.photos.find(photo=>photo.id===button.dataset.photoId);if(!photo)return;
      projectSiteWriteDay(project,date,day=>{day.photos=day.photos.filter(p=>p.id!==photo.id);day.checks.forEach(item=>item.photoIds=item.photoIds.filter(id=>id!==photo.id));});
      try{await removeDailyPhotoFiles(day,[photo]);}catch(error){/* 中繼資料已儲存；孤立照片可由瀏覽器清理。 */}
      refreshProjectSite(project);if(root.dataset.siteItem)renderProjectSiteItemPhotos(root,project,date);
    }
    if(action==='preview'){
      const day=projectSiteDay(project,date),photo=day.photos.find(photo=>photo.id===button.dataset.photoId),url=photo&&await dailyPhotoURL(day,photo);if(!url)throw new Error('找不到照片，請從備份還原。');
      const itemId=root.dataset.siteItem;
      openModal('<div class="project-site"><img class="daily-photo-full" src="'+esc(url)+'" alt="現場照片"><p>'+esc(photo.description)+'</p><button id="psPhotoBack">返回</button></div>');
      document.getElementById('psPhotoBack').onclick=()=>itemId?openProjectSiteItem(project.id,date,itemId):closeModal();
    }
    if(action==='generate'){
      if(projectSitePending)throw new Error('照片儲存中，請稍候再產生日報。');button.disabled=true;
      const report=await generateProjectSiteReport(project.id,date);viewProjectSiteReport(project.id,report.id);
    }
    if(action==='view-report')viewProjectSiteReport(project.id,button.dataset.reportId);
  }catch(error){projectSiteMessage(root,'未完成：'+error.message);}finally{button.disabled=false;}
}
function openProjectSiteItem(projectId,date,itemId){
  const project=dailyProject(projectId),day=projectSiteDay(project,date),item=day.checks.find(item=>item.id===itemId);if(!item)return;
  openModal('<div class="project-site" data-site-project="'+esc(projectId)+'" data-site-date="'+esc(date)+'" data-site-item="'+esc(itemId)+'"><h2>'+esc(item.text)+'</h2><label>備註<textarea data-site-note>'+esc(item.note)+'</textarea></label><label>處理狀態<select data-site-status>'+dailyOptions(SITE_STATUSES,item.status)+'</select></label><div class="site-actions"><button class="light" data-site-action="upload">上傳照片</button><button class="light" data-site-action="camera">拍照</button></div><input type="file" accept="image/*" multiple data-site-files hidden><input type="file" accept="image/*" capture="environment" data-site-camera hidden><div class="site-photos" data-site-item-photos>'+projectSitePhotosHTML(day,itemId)+'</div><div class="site-actions"><button class="light" data-site-convert '+(item.issueId?'disabled':'')+'>'+(item.issueId?'已轉為問題':'轉為問題')+'</button><button data-site-close>完成</button></div><p class="muted" data-site-message role="status">備註與狀態自動儲存</p></div>');
  const root=sheet.querySelector('[data-site-item]');root.addEventListener('click',projectSiteAction);root.addEventListener('change',projectSiteInput);
  root.addEventListener('input',event=>{if(event.target.matches('[data-site-caption]'))projectSiteInput(event);});
  const persist=()=>{try{projectSiteWriteDay(project,date,day=>{const item=day.checks.find(item=>item.id===itemId);item.note=root.querySelector('[data-site-note]').value;item.status=root.querySelector('[data-site-status]').value;});projectSiteMessage(root,'已儲存');return true;}catch(error){projectSiteMessage(root,'尚未儲存：'+error.message);return false;}};
  root.querySelector('[data-site-note]').addEventListener('input',persist);root.querySelector('[data-site-status]').addEventListener('change',persist);
  root.querySelector('[data-site-close]').onclick=()=>{if(!persist())return;closeModal();refreshProjectSite(project);};
  root.querySelector('[data-site-convert]').onclick=function(){
    if(!persist())return;
    try{convertProjectSiteIssue(project.id,date,itemId);this.disabled=true;this.textContent='已轉為問題';projectSiteMessage(root,'已加入原本「問題」頁');refreshProjectSite(project);}catch(error){projectSiteMessage(root,'尚未儲存：'+error.message);}
  };
  loadDailyPhotoImages(day,root);
}
function convertProjectSiteIssue(projectId,date,itemId){
  const project=dailyProject(projectId),item=projectSiteDay(project,date).checks.find(item=>item.id===itemId);if(!item)return;
  const existing=data.issues.find(issue=>issue.siteItemId===itemId&&String(issue.projectId)===String(projectId));if(item.issueId||existing)return item.issueId||existing.id;
  const id=dailyReportId(),oldIssues=data.issues,oldCount=project.issueCount;
  try{projectSiteUpdate(project,()=>{
    const current=project.siteDays[date].checks.find(item=>item.id===itemId);current.issueId=id;
    data.issues=[{id,title:current.text,note:[current.note,'來源：'+date+' 現場確認'+(current.photoIds.length?'（照片 '+current.photoIds.length+' 張，可於原事項查看）':'')].filter(Boolean).join('\n'),priority:'一般',status:current.status,project:project.name,projectId:project.id,date:date.replace(/-/g,'/'),siteItemId:itemId,siteDate:date},...data.issues];project.issueCount=(Number(project.issueCount)||0)+1;
  });}catch(error){data.issues=oldIssues;project.issueCount=oldCount;throw error;}return id;
}
async function addProjectSitePhotos(project,date,files,itemId,root){
  if(!files.length)return;projectSitePending++;projectSiteMessage(root,'照片儲存中…');
  let saved=0;
  try{
    for(const file of files){
      const photo={id:dailyReportId(),trade:'',description:'',originalName:file.name,storage:'pending'},record={...projectSiteDay(project,date),photos:[photo]},blob=await prepareDailyPhoto(file);
      await persistDailyPhotos({report:record,blobs:new Map([[photo.id,blob]])});
      try{projectSiteWriteDay(project,date,day=>{day.photos.push(photo);if(itemId){const item=day.checks.find(item=>item.id===itemId);if(item)item.photoIds.push(photo.id);}});}catch(error){await removeDailyPhotoFiles(record,[photo]).catch(()=>{});throw error;}saved++;
    }
    projectSiteMessage(root,'已儲存 '+saved+' 張照片');
  }catch(error){projectSiteMessage(root,'已儲存 '+saved+' 張；其餘未儲存：'+error.message);}
  finally{projectSitePending--;refreshProjectSite(project);if(root?.isConnected&&itemId)renderProjectSiteItemPhotos(root,project,date);}
}
function renderProjectSiteItemPhotos(root,project,date){const box=root.querySelector('[data-site-item-photos]');if(box){const day=projectSiteDay(project,date);box.innerHTML=projectSitePhotosHTML(day,root.dataset.siteItem);loadDailyPhotoImages(day,box);}}
async function generateProjectSiteReport(projectId,date=projectSiteDate()){
  const project=dailyProject(projectId);if(!project||!isCompleteScheduleDate(date))throw new Error('工程或日期無效');
  if(projectSitePending)throw new Error('請等待照片儲存完成');ensureProjectSiteAppointments(project,date);
  const day=projectSiteDay(project,date),report=JSON.parse(JSON.stringify({...day,id:dailyReportId(),projectName:project.name,client:project.client||'',createdAt:new Date().toISOString(),appointments:(project.siteAppointments||[]).filter(item=>item.date===date||item.generatedDate===date||(!item.generatedItemId&&item.date>date))}));
  // 日報為獨立快照，刪除今日照片或修改今日事項不會改掉已產生的正式報表。
  try{
    for(const photo of report.photos){if(photo.storage!=='indexeddb')continue;const blob=await dailyPhotoBlob(day,photo);if(!blob)throw new Error('找不到現場照片，請先還原照片備份');await dailyPhotoStore('readwrite',store=>store.put({key:dailyPhotoKey(project.id,report.id,photo.id),projectId:project.id,reportId:report.id,photoId:photo.id,blob}));}
    projectSiteUpdate(project,()=>{project.siteReports||=[];project.siteReports.push(report);});return report;
  }catch(error){await removeDailyPhotoFiles(report,report.photos).catch(()=>{});throw error;}
}
// 頁面持續開啟或手機回到前景時也處理到期預約；跨日不丟棄正在輸入的文字。
function checkProjectSiteRollover(){
  const root=main.querySelector('[data-site-project]');if(!root||projectSitePending||modal.style.display==='flex')return;
  if(main.contains(document.activeElement)&&document.activeElement.matches('input,textarea,select'))return;
  const project=dailyProject(root.dataset.siteProject);if(!project)return;
  try{if(root.dataset.siteDate!==projectSiteDate())openProject(project.id);else if(ensureProjectSiteAppointments(project))refreshProjectSite(project);}catch(error){projectSiteMessage(root,'到期事項尚未儲存：'+error.message);}
}
setInterval(checkProjectSiteRollover,60000);
window.addEventListener('focus',checkProjectSiteRollover);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkProjectSiteRollover();});
window.addEventListener('beforeunload',event=>{if(projectSitePending){event.preventDefault();event.returnValue='';}});
