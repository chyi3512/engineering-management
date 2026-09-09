/* 第一階段工程日報：只讀取 p.steps / actualSchedule，從不寫入任何工程工期。 */
const DAILY_ISSUE_TYPES=['現場問題','設計變更','待確認','材料','延誤','其他'];
const DAILY_DELAY_REASONS=['前工種未完成','材料未到','現場變更','業主變更','施工問題','其他'];
let dailyReportEditor=null;
let dailyPhotoViewURLs=[];
function dailyReportId(){return typeof crypto.randomUUID==='function'?crypto.randomUUID():'dr_'+Date.now()+'_'+Math.random().toString(36).slice(2);}
function dailyProject(projectId){return data.projects.find(p=>String(p.id)===String(projectId));}
function dailyReportsForProject(projectId){return (Array.isArray(data.dailyReports)?data.dailyReports:[]).filter(r=>String(r.projectId)===String(projectId)).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.createdAt).localeCompare(String(a.createdAt)));}
function findDailyReport(projectId,reportId){return dailyReportsForProject(projectId).find(r=>String(r.id)===String(reportId));}
function dailyTradeNames(){return [...new Set(libraryGroups().map(t=>String(t.name||'').trim()).filter(Boolean))];}
function dailyOptions(values,selected,empty){
  const all=[...new Set([...values,...(selected&&!values.includes(selected)?[selected]:[])])];
  return (empty===undefined?'':'<option value="">'+esc(empty)+'</option>')+all.map(value=>'<option value="'+esc(value)+'" '+(value===selected?'selected':'')+'>'+esc(value)+'</option>').join('');
}
function dailyButton(action,label,attributes='',light=true){return '<button type="button" '+(light?'class="light" ':'')+'data-daily-action="'+action+'" '+attributes+'>'+label+'</button>';}
function dailyReportProgressLabel(report){return report.progressStatus==='正常'?'正常':report.progressStatus+' '+(Number(report.progressDays)||0)+' 天';}
function dailyReportDelayLabel(report){return report.delayReason==='其他'?'其他：'+(report.delayReasonOther||''):report.delayReason||'';}
function dailyReportMessage(message){const el=document.getElementById('drStatusMessage');if(el){el.hidden=false;el.textContent=message;el.scrollIntoView({block:'nearest'});}}
function releaseDailyPhotoViews(){dailyPhotoViewURLs.forEach(url=>URL.revokeObjectURL(url));dailyPhotoViewURLs=[];}
function discardDailyReportEditor(){
  if(dailyReportEditor)dailyReportEditor.urls.forEach(url=>URL.revokeObjectURL(url));
  dailyReportEditor=null;
}
function dailyReportShell(projectId,content){
  releaseDailyPhotoViews();
  main.innerHTML='<section class="daily-reports" id="dailyReportsRoot" data-project-id="'+esc(projectId)+'">'+content+'<div id="drStatusMessage" class="hint" role="status" hidden></div></section>';
  const root=document.getElementById('dailyReportsRoot');
  root.addEventListener('click',dailyReportAction);
  root.addEventListener('input',dailyReportInput);
  root.addEventListener('change',dailyReportInput);
  root.addEventListener('submit',event=>{event.preventDefault();saveDailyReport();});
}
function openDailyReports(projectId){
  const project=dailyProject(projectId);if(!project)return;
  discardDailyReportEditor();
  const reports=dailyReportsForProject(projectId);
  dailyReportShell(projectId,dailyButton('project','← 返回工程')+'<div class="section"><div><h2>工程日報</h2><div class="muted">'+esc(project.name)+'</div></div>'+dailyButton('export','匯出 Excel')+'</div>'+dailyButton('new','＋ 新增今日日報','',false)+(reports.length?reports.map(report=>{
    const ref='data-report-id="'+esc(report.id)+'"';
    return '<article class="card daily-report-card"><button type="button" class="daily-report-open" data-daily-action="view" '+ref+'><b>'+esc(report.date.replace(/-/g,'/'))+'</b><div class="muted">'+esc((report.trades||[]).join('・')||'未選工種')+'</div><p>'+esc((report.workContent||'').slice(0,100))+'</p><span class="tag">'+esc(dailyReportProgressLabel(report))+'</span><div class="muted">照片 '+(report.photos||[]).length+' 張　｜　待處理 '+(report.issues||[]).filter(issue=>!issue.resolved).length+' 項</div></button><div class="daily-actions">'+dailyButton('edit','編輯',ref)+dailyButton('delete','刪除',ref)+'</div></article>';
  }).join(''):'<div class="empty">尚無日報，新增一篇記錄今天的施工情況。</div>'));
}
function editDailyReport(projectId,reportId){
  const project=dailyProject(projectId),existing=reportId?findDailyReport(projectId,reportId):null;
  if(!project||(reportId&&!existing))return;
  discardDailyReportEditor();
  const report=existing?JSON.parse(JSON.stringify(existing)):{id:dailyReportId(),projectId:project.id,date:localDateISO(new Date()),trades:[],workContent:'',photos:[],issues:[],progressStatus:'正常',progressDays:0,delayReason:'',delayReasonOther:'',nextTrade:'',nextTradeDate:'',checklist:[],createdAt:new Date().toISOString(),updatedAt:''};
  dailyReportEditor={report,original:existing?JSON.stringify(existing):null,blobs:new Map(),urls:new Map(),dirty:false,busy:false,pendingPhotoIssue:null};
  const trades=[...new Set([...dailyTradeNames(),...(report.trades||[])])];
  dailyReportShell(projectId,dailyButton('cancel','← 返回日報列表')+'<form id="dailyReportForm"><fieldset id="dailyReportFields"><div class="card"><h2>'+(existing?'編輯工程日報':'新增工程日報')+'</h2><div class="muted">'+esc(project.name)+'</div><label for="drDate">日期</label><input id="drDate" data-report-field="date" type="date" required value="'+esc(report.date)+'"></div>'+
    '<div class="card"><h3>1. 今日工種</h3><div class="daily-trades">'+(trades.length?trades.map(trade=>'<label class="daily-check"><input type="checkbox" data-daily-trade="'+esc(trade)+'" '+(report.trades.includes(trade)?'checked':'')+'>'+esc(trade)+'</label>').join(''):'<div class="muted">工種庫尚無工種，可先記錄施工內容。</div>')+'</div></div>'+
    '<div class="card"><h3>2. 今天工作內容</h3><label for="drWork" class="muted">記錄今天完成的施工內容</label><textarea id="drWork" data-report-field="workContent" required rows="5" placeholder="例如：客廳天花封板完成">'+esc(report.workContent)+'</textarea>'+dailyButton('schedule','＋ 從今日工程進度加入')+'<div class="hint">依日報所選日期讀取現場預定施工項目。</div></div>'+
    '<div class="card"><h3>3. 現場照片</h3><div class="daily-actions">'+dailyButton('upload','＋ 上傳照片')+dailyButton('camera','＋ 拍照')+'</div><input id="drPhotoFiles" type="file" accept="image/*" multiple hidden><input id="drCameraFile" type="file" accept="image/*" capture="environment" hidden><div id="drPhotos" class="daily-photos"></div></div>'+
    '<div class="card"><h3>4. 特記事項</h3><div id="drIssues"></div>'+dailyButton('add-issue','＋ 新增特記事項')+'</div>'+
    '<div class="card"><h3>5. 今日進度</h3><div class="daily-trades">'+['正常','提前','延誤'].map(status=>'<label class="daily-check"><input type="radio" name="drProgress" data-report-field="progressStatus" value="'+status+'" '+(report.progressStatus===status?'checked':'')+'>'+status+'</label>').join('')+'</div><div id="drProgressDetails"><label for="drDays" id="drDaysLabel">影響天數</label><input id="drDays" data-report-field="progressDays" type="number" min="0.5" step="0.5" value="'+(report.progressDays||'')+'"><div id="drDelayFields"><label for="drDelayReason">延誤原因</label><select id="drDelayReason" data-report-field="delayReason">'+dailyOptions(DAILY_DELAY_REASONS,report.delayReason,'請選擇')+'</select><div id="drOtherReason"><label for="drDelayOther">其他原因</label><textarea id="drDelayOther" data-report-field="delayReasonOther">'+esc(report.delayReasonOther)+'</textarea></div></div></div></div>'+
    '<div class="card"><h3>6. 下一個工種</h3><label for="drNextTrade">下一工種</label><select id="drNextTrade" data-report-field="nextTrade">'+dailyOptions(dailyTradeNames(),report.nextTrade,'未設定')+'</select><label for="drNextDate">預計進場日期</label><input id="drNextDate" type="date" data-report-field="nextTradeDate" value="'+esc(report.nextTradeDate)+'"><h3>進場前確認</h3><div id="drChecklist"></div><label for="drNewCheck">新增確認項目</label><input id="drNewCheck" placeholder="例如：材料到場">'+dailyButton('add-check','＋ 新增確認項目')+'</div><div class="daily-actions daily-save"><button type="submit">儲存今日工程日報</button>'+dailyButton('cancel','取消')+'</div></fieldset></form>');
  renderDailyPhotos();renderDailyIssues();renderDailyChecklist();updateDailyProgressFields();
}
function updateDailyProgressFields(){
  const report=dailyReportEditor?.report;if(!report)return;
  const status=report.progressStatus,details=document.getElementById('drProgressDetails'),delay=document.getElementById('drDelayFields'),other=document.getElementById('drOtherReason');
  details.hidden=status==='正常';delay.hidden=status!=='延誤';other.hidden=report.delayReason!=='其他';
  document.getElementById('drDaysLabel').textContent=status==='提前'?'提前約幾天':'延誤影響約幾天';
  const days=document.getElementById('drDays'),reason=document.getElementById('drDelayReason'),text=document.getElementById('drDelayOther');
  days.disabled=status==='正常';days.required=status!=='正常';reason.disabled=status!=='延誤';reason.required=status==='延誤';text.disabled=status!=='延誤'||report.delayReason!=='其他';text.required=!text.disabled;
}
function dailyReportInput(event){
  const editor=dailyReportEditor,el=event.target;if(!editor||editor.busy)return;
  if(el.id==='drPhotoFiles'||el.id==='drCameraFile'){if(event.type==='change'){const files=Array.from(el.files);el.value='';addDailyReportPhotos(files,editor.pendingPhotoIssue);}return;}
  const report=editor.report;
  if(el.dataset.reportField){report[el.dataset.reportField]=el.value;editor.dirty=true;if(['progressStatus','delayReason'].includes(el.dataset.reportField))updateDailyProgressFields();}
  if(el.hasAttribute('data-daily-trade')){report.trades=Array.from(document.querySelectorAll('[data-daily-trade]:checked')).map(input=>input.dataset.dailyTrade);editor.dirty=true;}
  if(el.dataset.photoField){const photo=report.photos.find(p=>p.id===el.dataset.photoId);if(photo){photo[el.dataset.photoField]=el.value;editor.dirty=true;}}
  if(el.dataset.issueField){const issue=report.issues.find(i=>i.id===el.dataset.issueId);if(issue){issue[el.dataset.issueField]=el.dataset.issueField==='resolved'?el.checked:el.value;editor.dirty=true;}}
  if(el.hasAttribute('data-issue-photo')){const issue=report.issues.find(i=>i.id===el.dataset.issueId);if(issue){issue.photoIds=el.checked?[...new Set([...issue.photoIds,el.dataset.issuePhoto])]:issue.photoIds.filter(id=>id!==el.dataset.issuePhoto);editor.dirty=true;}}
  if(el.dataset.checkId){const item=report.checklist.find(i=>i.id===el.dataset.checkId);if(item){item[el.type==='checkbox'?'done':'text']=el.type==='checkbox'?el.checked:el.value;editor.dirty=true;}}
}
async function dailyReportAction(event){
  const button=event.target.closest('[data-daily-action]');if(!button)return;
  event.preventDefault();
  const projectId=document.getElementById('dailyReportsRoot')?.dataset.projectId,reportId=button.dataset.reportId,action=button.dataset.dailyAction;
  if(dailyReportEditor?.busy)return;
  switch(action){
    case 'project':releaseDailyPhotoViews();openProject(dailyProject(projectId).id);break;
    case 'new':editDailyReport(projectId);break;
    case 'edit':editDailyReport(projectId,reportId);break;
    case 'view':viewDailyReport(projectId,reportId);break;
    case 'cancel':cancelDailyReport();break;
    case 'list':openDailyReports(projectId);break;
    case 'delete':confirmDeleteDailyReport(projectId,reportId);break;
    case 'export':exportDailyReportsExcel(projectId,button);break;
    case 'schedule':openDailySchedulePicker();break;
    case 'upload':case 'camera':dailyReportEditor.pendingPhotoIssue=button.dataset.issueId||null;document.getElementById(action==='camera'?'drCameraFile':'drPhotoFiles').click();break;
    case 'preview':previewDailyReportPhoto(projectId,button.dataset.reportId,button.dataset.photoId);break;
    case 'remove-photo':removeDailyReportPhoto(button.dataset.photoId);break;
    case 'add-issue':dailyReportEditor.report.issues.push({id:dailyReportId(),type:'現場問題',content:'',trade:'',resolved:false,photoIds:[]});dailyReportEditor.dirty=true;renderDailyIssues();break;
    case 'remove-issue':dailyReportEditor.report.issues=dailyReportEditor.report.issues.filter(i=>i.id!==button.dataset.issueId);dailyReportEditor.dirty=true;renderDailyIssues();break;
    case 'add-check':{const input=document.getElementById('drNewCheck'),text=input.value.trim();if(text){dailyReportEditor.report.checklist.push({id:dailyReportId(),text,done:false});dailyReportEditor.dirty=true;input.value='';renderDailyChecklist();}break;}
    case 'remove-check':dailyReportEditor.report.checklist=dailyReportEditor.report.checklist.filter(i=>i.id!==button.dataset.checkId);dailyReportEditor.dirty=true;renderDailyChecklist();break;
  }
}
function renderDailyIssues(){
  const report=dailyReportEditor?.report,box=document.getElementById('drIssues');if(!report||!box)return;
  box.innerHTML=report.issues.map((issue,index)=>{
    const ref='data-issue-id="'+esc(issue.id)+'"',prefix='drIssue_'+index;
    return '<div class="daily-subcard"><div class="section"><b>特記事項 '+(index+1)+'</b>'+dailyButton('remove-issue','刪除',ref)+'</div><label for="'+prefix+'Type">類型</label><select id="'+prefix+'Type" data-issue-field="type" '+ref+'>'+dailyOptions(DAILY_ISSUE_TYPES,issue.type)+'</select><label for="'+prefix+'Content">內容</label><textarea id="'+prefix+'Content" data-issue-field="content" '+ref+' required>'+esc(issue.content)+'</textarea><label for="'+prefix+'Trade">負責工種</label><select id="'+prefix+'Trade" data-issue-field="trade" '+ref+'>'+dailyOptions(dailyTradeNames(),issue.trade,'未設定')+'</select><label class="daily-check"><input type="checkbox" data-issue-field="resolved" '+ref+' '+(issue.resolved?'checked':'')+'>已處理（未勾選為未處理）</label><details><summary>附加現場照片（'+(issue.photoIds||[]).length+' 張）</summary>'+report.photos.map((photo,i)=>'<label class="daily-check"><input type="checkbox" data-issue-photo="'+esc(photo.id)+'" '+ref+' '+(issue.photoIds.includes(photo.id)?'checked':'')+'>照片 '+(i+1)+' '+esc(photo.description||photo.trade||'')+'</label>').join('')+dailyButton('upload','＋ 上傳附加照片',ref)+'</details></div>';
  }).join('');
}
function renderDailyChecklist(){
  const box=document.getElementById('drChecklist');if(!box||!dailyReportEditor)return;
  box.innerHTML=dailyReportEditor.report.checklist.map((item,i)=>'<div class="daily-check-row"><input type="checkbox" aria-label="確認 '+esc(item.text)+'" data-check-id="'+esc(item.id)+'" '+(item.done?'checked':'')+'><input aria-label="確認項目 '+(i+1)+'" data-check-id="'+esc(item.id)+'" value="'+esc(item.text)+'" required>'+dailyButton('remove-check','刪除','data-check-id="'+esc(item.id)+'"')+'</div>').join('');
}
function setDailyReportBusy(busy){
  if(dailyReportEditor)dailyReportEditor.busy=busy;
  const fields=document.getElementById('dailyReportFields');if(fields)fields.disabled=busy;
}
async function addDailyReportPhotos(fileList,issueId){
  const editor=dailyReportEditor;if(!editor||editor.busy)return;
  const files=Array.from(fileList||[]);if(!files.length)return;
  setDailyReportBusy(true);dailyReportMessage('正在處理照片…');
  const errors=[];
  for(const file of files){
    try{
      const blob=await prepareDailyPhoto(file);if(dailyReportEditor!==editor)return;
      const photo={id:dailyReportId(),trade:editor.report.trades[0]||'',description:'',storage:'pending',originalName:file.name};
      editor.report.photos.push(photo);editor.blobs.set(photo.id,blob);editor.urls.set(photo.id,URL.createObjectURL(blob));
      const issue=editor.report.issues.find(i=>i.id===issueId);if(issue)issue.photoIds.push(photo.id);
      editor.dirty=true;
    }catch(error){errors.push(file.name+'：'+(error.message||'無法讀取照片，請改用 JPG／PNG。'));}
  }
  if(dailyReportEditor!==editor)return;
  setDailyReportBusy(false);editor.pendingPhotoIssue=null;renderDailyPhotos();renderDailyIssues();dailyReportMessage(errors.length?errors.join('\n'):'照片已加入，請填寫工種與說明後儲存日報。');
}
function renderDailyPhotos(){
  const editor=dailyReportEditor,box=document.getElementById('drPhotos');if(!editor||!box)return;
  box.innerHTML=editor.report.photos.map((photo,i)=>{
    const ref='data-photo-id="'+esc(photo.id)+'"';
    return '<div class="daily-photo"><button type="button" class="daily-photo-preview" data-daily-action="preview" '+ref+'><img alt="照片 '+(i+1)+'" data-daily-photo="'+esc(photo.id)+'"></button><label for="drPhotoTrade_'+i+'">照片工種</label><select id="drPhotoTrade_'+i+'" data-photo-field="trade" '+ref+'>'+dailyOptions(dailyTradeNames(),photo.trade,'未設定')+'</select><label for="drPhotoNote_'+i+'">照片說明</label><textarea id="drPhotoNote_'+i+'" data-photo-field="description" '+ref+'>'+esc(photo.description)+'</textarea>'+dailyButton('remove-photo','刪除照片',ref)+'</div>';
  }).join('');
  loadDailyPhotoImages(editor.report,box,editor);
}
async function dailyPhotoURL(report,photo,editor){
  if(editor?.urls.has(photo.id))return editor.urls.get(photo.id);
  const cloud=dailyCloudPhotoURL(photo);if(cloud)return cloud;
  const blob=editor?.blobs.get(photo.id)||await dailyPhotoBlob(report,photo);
  if(!blob)return '';
  const url=URL.createObjectURL(blob);
  if(editor&&dailyReportEditor===editor)editor.urls.set(photo.id,url);else dailyPhotoViewURLs.push(url);
  return url;
}
async function loadDailyPhotoImages(report,container,editor){
  for(const img of container.querySelectorAll('[data-daily-photo]')){
    const photo=report.photos.find(p=>p.id===img.dataset.dailyPhoto);
    try{const url=await dailyPhotoURL(report,photo,editor);if(img.isConnected){if(url)img.src=url;else img.alt='找不到照片，請從備份還原';}}
    catch(error){if(img.isConnected)img.alt='照片暫時無法讀取';}
  }
}
async function previewDailyReportPhoto(projectId,reportId,photoId){
  const report=reportId?findDailyReport(projectId,reportId):dailyReportEditor?.report,photo=report?.photos.find(p=>p.id===photoId);if(!photo)return;
  try{const url=await dailyPhotoURL(report,photo,reportId?null:dailyReportEditor);if(!url)throw new Error('找不到照片，請從備份還原。');openModal('<div class="daily-reports"><h2>照片預覽</h2><img class="daily-photo-full" src="'+esc(url)+'" alt="'+esc(photo.description||'現場照片')+'"><p>'+esc(photo.trade)+'｜'+esc(photo.description)+'</p><button type="button" onclick="closeModal()">關閉</button></div>');}catch(error){dailyReportMessage(error.message);}
}
function removeDailyReportPhoto(photoId){
  const editor=dailyReportEditor;if(!editor)return;
  editor.report.photos=editor.report.photos.filter(photo=>photo.id!==photoId);
  editor.report.issues.forEach(issue=>issue.photoIds=issue.photoIds.filter(id=>id!==photoId));
  if(editor.urls.has(photoId)){URL.revokeObjectURL(editor.urls.get(photoId));editor.urls.delete(photoId);}
  editor.blobs.delete(photoId);editor.dirty=true;renderDailyPhotos();renderDailyIssues();
}
function dailyScheduledItems(projectId,date){
  const project=dailyProject(projectId);if(!project||!isCompleteScheduleDate(date))return [];
  // 只取顯示用的欄位值，不把進度工項物件放進日報草稿。
  return (project.actualSchedule||project.steps||[]).filter(step=>{
    const start=step.start||step.end,end=step.end||step.start;
    return isCompleteScheduleDate(start)&&isCompleteScheduleDate(end)&&start<=date&&end>=date;
  }).map(step=>({name:step.name,trade:step.trade,start:step.start,end:step.end}));
}
function openDailySchedulePicker(){
  const editor=dailyReportEditor;if(!editor)return;
  const date=editor.report.date;
  if(!isCompleteScheduleDate(date)){dailyReportMessage('請先填寫完整的日報日期。');return;}
  const items=dailyScheduledItems(editor.report.projectId,date);
  openModal('<div class="daily-reports"><h2>加入預定施工內容</h2><div class="muted">'+esc(date)+'</div><div id="drScheduleChoices">'+(items.length?items.map((item,i)=>'<label class="daily-check"><input type="checkbox" value="'+i+'"><span>'+esc(item.trade)+'｜'+esc(item.name)+'</span></label>').join(''):'<div class="empty">這一天沒有排定施工項目。</div>')+'</div><div class="daily-actions"><button type="button" class="light" onclick="closeModal()">取消</button><button type="button" id="drApplySchedule">加入工作內容</button></div></div>');
  document.getElementById('drApplySchedule').addEventListener('click',()=>{
    if(dailyReportEditor!==editor)return;
    const selected=Array.from(document.querySelectorAll('#drScheduleChoices input:checked')).map(input=>items[Number(input.value)]);
    if(selected.length){const text=selected.map(item=>item.trade+'｜'+item.name).join('\n');editor.report.workContent=[editor.report.workContent,text].filter(Boolean).join('\n');document.getElementById('drWork').value=editor.report.workContent;editor.dirty=true;}
    closeModal();
  });
}
function cancelDailyReport(){
  const editor=dailyReportEditor;if(!editor||editor.busy)return;
  if(!editor.dirty){openDailyReports(editor.report.projectId);return;}
  openModal('<div class="daily-reports"><h2>放棄尚未儲存的日報修改？</h2><div class="daily-actions"><button class="light" onclick="closeModal()">繼續填寫</button><button id="drDiscard">放棄修改</button></div></div>');
  document.getElementById('drDiscard').addEventListener('click',()=>{closeModal();openDailyReports(editor.report.projectId);});
}
function commitDailyReports(reports){
  const had=Object.prototype.hasOwnProperty.call(data,'dailyReports'),previous=data.dailyReports;
  data.dailyReports=reports;
  try{save();}catch(error){if(had)data.dailyReports=previous;else delete data.dailyReports;throw error;}
}
async function saveDailyReport(){
  const editor=dailyReportEditor,form=document.getElementById('dailyReportForm');if(!editor||editor.busy||!form)return false;
  if(!form.reportValidity())return false;
  const report=editor.report;
  if(!dailyProject(report.projectId))return false;
  if(!isCompleteScheduleDate(report.date)||(report.nextTradeDate&&!isCompleteScheduleDate(report.nextTradeDate))||!report.workContent.trim()){dailyReportMessage('請填寫有效日期與今天工作內容。');return false;}
  if(report.issues.some(issue=>!issue.content.trim())||report.checklist.some(item=>!item.text.trim())){dailyReportMessage('請填寫特記事項及確認項目的內容，或刪除空白項目。');return false;}
  if(report.progressStatus!=='正常'&&(!Number.isFinite(Number(report.progressDays))||Number(report.progressDays)<=0)){dailyReportMessage('請填寫有效的提前／延誤天數。');return false;}
  if(report.progressStatus==='延誤'&&(!report.delayReason||(report.delayReason==='其他'&&!report.delayReasonOther.trim()))){dailyReportMessage('請填寫延誤原因。');return false;}
  setDailyReportBusy(true);dailyReportMessage('正在儲存日報與照片…');
  try{
    await persistDailyPhotos(editor);
    const current=findDailyReport(report.projectId,report.id);
    if(editor.original&&JSON.stringify(current)!==editor.original)throw new Error('日報已被其他操作修改，請重新開啟後再編輯。');
    const saved=JSON.parse(JSON.stringify(report));saved.updatedAt=new Date().toISOString();saved.workContent=saved.workContent.trim();
    saved.progressDays=saved.progressStatus==='正常'?0:Number(saved.progressDays);
    if(saved.progressStatus!=='延誤'){saved.delayReason='';saved.delayReasonOther='';}else if(saved.delayReason!=='其他')saved.delayReasonOther='';
    const reports=Array.isArray(data.dailyReports)?data.dailyReports:[];
    commitDailyReports([...reports.filter(r=>!(String(r.projectId)===String(saved.projectId)&&r.id===saved.id)),saved]);
    const removed=(current?.photos||[]).filter(photo=>!saved.photos.some(p=>p.id===photo.id));
    try{await removeDailyPhotoFiles(saved,removed);}catch(error){/* 日報已儲存；刪除暫存照片失敗不回滾有效紀錄。 */}
    editor.dirty=false;setDailyReportBusy(false);openDailyReports(saved.projectId);return true;
  }catch(error){setDailyReportBusy(false);dailyReportMessage('尚未儲存：'+(error.message||'儲存空間不足，請備份後釋放空間再重試。'));return false;}
}
function viewDailyReport(projectId,reportId){
  const project=dailyProject(projectId),report=findDailyReport(projectId,reportId);if(!project||!report)return;
  discardDailyReportEditor();const ref='data-report-id="'+esc(report.id)+'"';
  dailyReportShell(projectId,dailyButton('list','← 返回日報列表')+'<div class="card"><h2>'+esc(report.date.replace(/-/g,'/'))+' 工程日報</h2><div class="muted">'+esc(project.name)+'</div><p>'+esc(report.trades.join('・'))+'</p><div class="daily-actions">'+dailyButton('edit','編輯日報',ref)+dailyButton('delete','刪除日報',ref)+'</div></div><div class="card"><h3>今天工作內容</h3><p class="daily-text">'+esc(report.workContent)+'</p></div><div class="card"><h3>現場照片（'+report.photos.length+' 張）</h3><div class="daily-photos">'+report.photos.map((photo,i)=>'<div class="daily-photo">'+dailyButton('preview','<img data-daily-photo="'+esc(photo.id)+'" alt="照片 '+(i+1)+'">',ref+' data-photo-id="'+esc(photo.id)+'"')+'<p class="daily-text">'+esc(photo.trade||'未設定工種')+'｜'+esc(photo.description)+'</p></div>').join('')+'</div></div><div class="card"><h3>特記事項</h3>'+(report.issues.length?report.issues.map(issue=>'<div class="daily-subcard"><b>'+esc(issue.type)+'｜'+(issue.resolved?'已處理':'未處理')+'</b><p class="daily-text">'+esc(issue.content)+'</p><div class="muted">負責工種：'+esc(issue.trade||'未設定')+'</div><div class="daily-actions">'+(issue.photoIds||[]).map(id=>dailyButton('preview','查看附加照片',ref+' data-photo-id="'+esc(id)+'"')).join('')+'</div></div>').join(''):'<div class="muted">無</div>')+'</div><div class="card"><h3>今日進度</h3><b>'+esc(dailyReportProgressLabel(report))+'</b>'+(report.progressStatus==='延誤'?'<p>'+esc(dailyReportDelayLabel(report))+'</p>':'')+'</div><div class="card"><h3>下一個工種</h3><p>'+esc(report.nextTrade||'未設定')+'｜'+esc(report.nextTradeDate||'日期未設定')+'</p><h3>進場前確認</h3>'+report.checklist.map(item=>'<div class="daily-check">'+(item.done?'☑':'☐')+' '+esc(item.text)+'</div>').join('')+'</div>');
  loadDailyPhotoImages(report,document.getElementById('dailyReportsRoot'));
}
function confirmDeleteDailyReport(projectId,reportId){
  const report=findDailyReport(projectId,reportId);if(!report)return;
  openModal('<div class="daily-reports"><h2>確認刪除這篇工程日報？</h2><p>'+esc(report.date)+'｜'+esc(dailyProject(projectId).name)+'</p><p>將刪除此篇日報紀錄與本機照片。</p><div class="daily-actions"><button class="light" onclick="closeModal()">取消</button><button id="drConfirmDelete">確認刪除</button></div><div id="drDeleteMessage" role="status"></div></div>');
  document.getElementById('drConfirmDelete').addEventListener('click',async function(){
    this.disabled=true;
    try{commitDailyReports(data.dailyReports.filter(r=>!(String(r.projectId)===String(projectId)&&r.id===reportId)));try{await removeDailyPhotoFiles(report,report.photos);}catch(error){}closeModal();openDailyReports(projectId);}
    catch(error){this.disabled=false;document.getElementById('drDeleteMessage').textContent='刪除未儲存：'+error.message;}
  });
}
window.addEventListener('beforeunload',event=>{if(dailyReportEditor?.dirty){event.preventDefault();event.returnValue='';}});

