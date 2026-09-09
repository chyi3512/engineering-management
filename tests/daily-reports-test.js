/* Integration runner: ONLY use a dedicated test origin and fresh browser profile. */
setTimeout(async()=>{
  const results=[],assert=(name,value)=>{if(!value)throw new Error(name);results.push('PASS '+name);};
  const fire=(el,type)=>el.dispatchEvent(new Event(type,{bubbles:true}));
  const fill=(selector,value)=>{const el=document.querySelector(selector);if(!el)throw Error('Missing '+selector);el.value=value;fire(el,'input');fire(el,'change');return el;};
  const click=selector=>{const el=document.querySelector(selector);if(!el)throw Error('Missing '+selector);el.click();};
  const action=name=>click('[data-daily-action="'+name+'"]');
  const waitFor=async fn=>{for(let i=0;i<250;i++){if(fn())return;await new Promise(resolve=>setTimeout(resolve,30));}throw Error('Timed out');};
  const phase=new URLSearchParams(location.search).get('phase')||'create';
  const addTestImage=async()=>{
    const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=1200;const ctx=canvas.getContext('2d');ctx.fillStyle='#bbb';ctx.fillRect(0,0,1800,1200);ctx.fillStyle='#222';ctx.fillRect(120,120,1560,200);ctx.fillStyle='#fff';ctx.font='100px sans-serif';ctx.fillText('SITE PHOTO',180,260);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.95)),file=new File([blob],'site-photo.jpg',{type:'image/jpeg'}),transfer=new DataTransfer();transfer.items.add(file);
    const input=document.getElementById('drPhotoFiles');input.files=transfer.files;fire(input,'input');fire(input,'change');await waitFor(()=>!dailyReportEditor.busy);
  };
  const createProject=name=>{newProject();document.querySelector('.projectTrade').click();document.querySelectorAll('.projectTrade')[1].click();document.getElementById('projectName').value=name;document.getElementById('projectStart').value=localDateISO(new Date());saveProject();return data.projects.at(-1);};
  try{
    assert('all application scripts initialize without errors',dailyTestErrors.length===0);
    if(phase==='create'){
      const today=localDateISO(new Date());
      data={trades:[{name:'木作',items:[['客廳天花封板',['板材確認'],'',today,today]]},{name:'水電',items:[['插座確認',['試電'],'',today,today]]}],projects:[],issues:[],methods:[],scheduleGroups:[]};libData=[{name:'空調',items:[['冷氣安裝',[],'']]}];save();saveLib();
      const p=createProject('日報測試工程 A');const schedules=JSON.stringify({steps:p.steps,baseline:p.baselineSchedule,trades:data.trades,library:libData});sessionStorage.setItem('dailyScheduleBefore',schedules);
      openProject(p.id);click('button[onclick^="report("]');assert('existing project entry opens report history',main.textContent.includes('尚無日報'));
      action('new');assert('date defaults to local today',document.getElementById('drDate').value===today);assert('project name is automatic',main.textContent.includes(p.name));
      assert('trade options come from both library sources',document.querySelectorAll('[data-daily-trade]').length===3);
      document.querySelector('[data-daily-trade="木作"]').click();document.querySelector('[data-daily-trade="水電"]').click();assert('two trades can be selected',dailyReportEditor.report.trades.length===2);
      fill('#drWork','客廳天花封板完成\n主臥施工約 80%');action('schedule');document.querySelector('#drScheduleChoices input').click();click('#drApplySchedule');assert('schedule picker appends selected work',dailyReportEditor.report.workContent.includes('木作｜客廳天花封板'));
      const pickerDraft=dailyReportEditor.report.workContent;fill('#drDate','2020-01-01');action('schedule');assert('schedule picker uses edited report date',document.querySelector('#sheet').textContent.includes('沒有排定'));closeModal();fill('#drDate',today);assert('picker does not discard typed work',dailyReportEditor.report.workContent===pickerDraft);
      await addTestImage();assert('file input processes actual image',dailyReportEditor.report.photos.length===1);const firstPhoto=dailyReportEditor.report.photos[0];assert('large image is resized before persistence',dailyReportEditor.blobs.get(firstPhoto.id).size<100000);
      fill('[data-photo-field="trade"]','木作');fill('[data-photo-field="description"]','客廳天花封板完成照片');action('preview');await waitFor(()=>document.querySelector('.daily-photo-full'));assert('photo preview opens',!!document.querySelector('.daily-photo-full'));closeModal();
      action('add-issue');fill('[data-issue-field="type"]','材料');fill('[data-issue-field="content"]','板材補料到場後確認');fill('[data-issue-field="trade"]','木作');click('[data-issue-field="resolved"]');click('[data-issue-photo]');assert('issue processed status and photo attachment stored in draft',dailyReportEditor.report.issues[0].resolved&&dailyReportEditor.report.issues[0].photoIds[0]===firstPhoto.id);
      click('input[name="drProgress"][value="延誤"]');fill('#drDays','1.5');fill('#drDelayReason','其他');fill('#drDelayOther','板材運送延遲');assert('delay fields conditionally expand',!document.getElementById('drDelayFields').hidden&&!document.getElementById('drOtherReason').hidden);
      fill('#drNextTrade','水電');fill('#drNextDate',shiftScheduleDate(today,2));fill('#drNewCheck','插座位置確認');action('add-check');click('#drChecklist input[type=checkbox]');assert('entry checklist check and uncheck works',dailyReportEditor.report.checklist[0].done);click('#drChecklist input[type=checkbox]');assert('checklist can be unchecked',!dailyReportEditor.report.checklist[0].done);click('#drChecklist input[type=checkbox]');
      const draftId=dailyReportEditor.report.id;click('#dailyReportForm button[type=submit]');await waitFor(()=>!dailyReportEditor);const r=findDailyReport(p.id,draftId);assert('submit saves report and returns to history',!!r&&main.textContent.includes('延誤 1.5 天'));assert('report is scoped by projectId and reportId',r.projectId===p.id&&r.id===draftId);
      assert('localStorage contains photo metadata without Base64',!localStorage.getItem(KEY).includes('data:image'));assert('compressed photo persists in IndexedDB',(await dailyPhotoBlob(r,r.photos[0])) instanceof Blob);
      assert('report changes never write project schedule or library',schedules===JSON.stringify({steps:p.steps,baseline:p.baselineSchedule,trades:data.trades,library:libData}));
      const backup=await collectDailyReportPhotoBackup();assert('backup includes local photo bytes',backup.length===1&&backup[0].data.startsWith('data:image/jpeg;base64,'));await removeDailyPhotoFiles(r,r.photos);assert('local photo removal is scoped',!(await dailyPhotoBlob(r,r.photos[0])));await restoreDailyReportPhotoBackup(backup,data);assert('photo backup restores IndexedDB',!!(await dailyPhotoBlob(r,r.photos[0])));
      viewDailyReport(p.id,r.id);await waitFor(()=>document.querySelector('[data-daily-photo]')?.complete&&document.querySelector('[data-daily-photo]')?.naturalWidth>0);assert('saved photo remains viewable',document.querySelector('[data-daily-photo]').naturalWidth>0);
      editDailyReport(p.id,r.id);fill('#drWork','取消的修改');action('cancel');click('#drDiscard');assert('cancel does not mutate saved report',findDailyReport(p.id,r.id).workContent!== '取消的修改');
      assert('no runtime errors after create flow',dailyTestErrors.length===0);
    }else if(phase==='edit'){
      const p=data.projects.find(p=>p.name==='日報測試工程 A'),r=dailyReportsForProject(p.id)[0];
      assert('report survives full browser restart',!!r);assert('all main fields survive restart',r.trades.length===2&&r.progressDays===1.5&&r.delayReasonOther==='板材運送延遲'&&r.nextTrade==='水電'&&r.checklist[0].done&&r.issues[0].resolved);
      assert('photo metadata and bytes survive restart',r.photos[0].trade==='木作'&&r.photos[0].description==='客廳天花封板完成照片'&&!!(await dailyPhotoBlob(r,r.photos[0])));
      editDailyReport(p.id,r.id);fill('#drWork','更新後：天花及主臥施工完成');fill('[data-photo-field="description"]','更新後照片說明');fill('[data-issue-field="content"]','補料已到場並驗收');fill('#drNextTrade','空調');click('input[name=drProgress][value="提前"]');fill('#drDays','2');assert('ahead hides delay reason but retains day field',document.getElementById('drDelayFields').hidden&&!document.getElementById('drProgressDetails').hidden);click('input[name=drProgress][value="正常"]');assert('normal hides and disables extra validation',document.getElementById('drProgressDetails').hidden&&document.getElementById('drDelayReason').disabled);click('input[name=drProgress][value="延誤"]');fill('#drDays','1');fill('#drDelayReason','材料未到');
      action('add-issue');fill('[data-issue-field="content"]:last-of-type','');action('remove-issue'); // Removing a draft issue must never write the saved record.
      assert('draft issue removal does not mutate stored issues',findDailyReport(p.id,r.id).issues[0].content==='板材補料到場後確認');
      // Restore one complete issue after exercising deletion.
      dailyReportEditor.report.issues=[{id:dailyReportId(),type:'材料',content:'補料已到場並驗收',trade:'木作',resolved:true,photoIds:[r.photos[0].id]}];renderDailyIssues();
      const savedBefore=JSON.stringify(findDailyReport(p.id,r.id)),realSave=save;save=()=>{throw new Error('test quota exceeded');};assert('storage failure returns false',!(await saveDailyReport()));assert('failed save preserves last stored report',JSON.stringify(findDailyReport(p.id,r.id))===savedBefore&&dailyReportEditor!==null);save=realSave;
      assert('edited report saves successfully',await saveDailyReport());assert('editing keeps same report ID',dailyReportsForProject(p.id).length===1&&dailyReportsForProject(p.id)[0].id===r.id);
    }else if(phase==='verify'||phase==='mobile'){
      const p=data.projects.find(p=>p.name==='日報測試工程 A'),r=dailyReportsForProject(p.id)[0];
      assert('edited content persists after second restart',r.workContent==='更新後：天花及主臥施工完成'&&r.photos[0].description==='更新後照片說明'&&r.nextTrade==='空調'&&r.progressDays===1&&r.delayReason==='材料未到');
      assert('issue and checklist edits persist',r.issues[0].resolved&&r.issues[0].content==='補料已到場並驗收'&&r.checklist[0].done);
      let second=data.projects.find(p=>p.name==='日報測試工程 B');if(!second)second=createProject('日報測試工程 B');report(second.id);assert('second project starts with independent report history',dailyReportsForProject(second.id).length===0);
      editDailyReport(second.id);fill('#drWork','第二個工程工作');assert('second project report saves',await saveDailyReport());assert('project lists never mix records',dailyReportsForProject(p.id).length===1&&dailyReportsForProject(second.id).length===1&&dailyReportsForProject(second.id)[0].workContent==='第二個工程工作');
      const scheduleSnapshot=JSON.stringify({steps:p.steps,baseline:p.baselineSchedule});
      openDailyReports(p.id);const exported=await exportDailyReportsExcel(p.id,document.querySelector('[data-daily-action=export]'));assert('Excel download generated real xlsx',exported&&exported.filename.includes('日報測試工程 A_工程日報_'));
      const bytes=await exported.blob.arrayBuffer(),book=new ExcelJS.Workbook();await book.xlsx.load(bytes);assert('xlsx can be reopened with two required sheets',book.worksheets.length===2&&book.getWorksheet('工程日報總表')&&book.getWorksheet('照片紀錄'));
      const total=book.getWorksheet('工程日報總表'),photoSheet=book.getWorksheet('照片紀錄');assert('Excel exports only current project with numeric days and date',total.rowCount===2&&total.getCell('C2').value===r.workContent&&total.getCell('G2').value===1&&total.getCell('A2').value instanceof Date);
      assert('Excel includes local thumbnail and photo notes',photoSheet.getImages().length===1&&photoSheet.getCell('C2').value===r.photos[0].description);await fetch('/__daily_test_artifact',{method:'POST',body:bytes});
      assert('Excel export does not change any schedule',scheduleSnapshot===JSON.stringify({steps:p.steps,baseline:p.baselineSchedule}));
      const backupBefore=await collectDailyReportPhotoBackup();assert('backup remains scoped with multiple projects',backupBefore.length===1&&backupBefore[0].projectId===p.id);
      viewDailyReport(second.id,dailyReportsForProject(second.id)[0].id);action('delete');assert('deletion waits for confirmation',dailyReportsForProject(second.id).length===1);closeModal();assert('cancel delete keeps report',dailyReportsForProject(second.id).length===1);action('delete');click('#drConfirmDelete');await waitFor(()=>dailyReportsForProject(second.id).length===0);assert('confirmed deletion only affects selected project',dailyReportsForProject(p.id).length===1);
      editDailyReport(p.id,r.id);await waitFor(()=>document.querySelector('[data-daily-photo]')?.naturalWidth>0);assert('photo file and camera controls are available',document.getElementById('drPhotoFiles').multiple&&document.getElementById('drCameraFile').getAttribute('capture')==='environment');
      assert('form does not overflow viewport',document.documentElement.scrollWidth<=window.innerWidth+1);const touch=Array.from(document.querySelectorAll('#dailyReportsRoot button')).filter(el=>el.getClientRects().length);assert('visible buttons have 44px touch targets',touch.every(el=>el.getBoundingClientRect().height>=44));
      const check=document.querySelector('#drChecklist input[type=checkbox]'),original=check.checked;check.click();check.click();assert('mobile checkbox is clickable without state reset',check.checked===original);
      assert('no duplicate IDs on report editor',new Set(Array.from(document.querySelectorAll('[id]')).map(el=>el.id)).size===document.querySelectorAll('[id]').length);
      dailyReportEditor.dirty=false;
      assert('no console JavaScript errors',dailyTestErrors.length===0);
    }
  }catch(error){results.push('FAIL '+error.stack);}
  if(dailyReportEditor)dailyReportEditor.dirty=false;
  const output=document.getElementById('dailyTestResults');output.textContent=results.join('\n');if(phase==='mobile')output.hidden=true;
  document.title=results.some(line=>line.startsWith('FAIL'))?'FAIL':'PASS';
},400);
