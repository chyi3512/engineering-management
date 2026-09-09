/* Dedicated test origin/profile only. Never run against user storage. */
setTimeout(async()=>{
  const results=[],assert=(name,value)=>{if(!value)throw Error(name);results.push('PASS '+name);};
  const fire=(el,type)=>el.dispatchEvent(new Event(type,{bubbles:true}));
  const fill=(selector,value)=>{const el=document.querySelector(selector);if(!el)throw Error('Missing '+selector);el.value=value;fire(el,'input');fire(el,'change');return el;};
  const click=selector=>{const el=document.querySelector(selector);if(!el)throw Error('Missing '+selector);el.click();};
  const waitFor=async fn=>{for(let i=0;i<300;i++){if(fn())return;await new Promise(resolve=>setTimeout(resolve,30));}throw Error('Timed out');};
  const phase=new URLSearchParams(location.search).get('phase')||'create';
  const today=projectSiteDate(),snapshot=p=>JSON.stringify({steps:p.steps,baseline:p.baselineSchedule,trades:data.trades,library:libData,quotes:quoteData});
  const enter=text=>{const el=fill('[data-site-new-check]',text);el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));};
  const upload=async(selector,count)=>{
    const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=700;const context=canvas.getContext('2d');context.fillStyle='#ddd';context.fillRect(0,0,1000,700);context.fillStyle='#222';context.font='54px sans-serif';context.fillText('FIELD / SITE PHOTO',80,180);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg'));
    const transfer=new DataTransfer();for(let i=0;i<count;i++)transfer.items.add(new File([blob],'現場-'+i+'.jpg',{type:'image/jpeg'}));
    const input=document.querySelector(selector);input.files=transfer.files;fire(input,'input');fire(input,'change');await waitFor(()=>projectSitePending===0);
  };
  try{
    assert('all production scripts load without console errors',dailyTestErrors.length===0);
    if(phase==='create'){
      data={trades:[{name:'木作',items:[['天花板',['材料確認'],'',today,today]]},{name:'水電',items:[['插座',['試電'],'',today,today]]}],projects:[],issues:[],methods:[],scheduleGroups:[]};libData=[];save();saveLib();recoverPhotos();
      newProject();document.querySelector('.projectTrade').click();document.querySelectorAll('.projectTrade')[1].click();fill('#projectName','現場日報測試 A');fill('#projectStart',today);saveProject();
      const p=data.projects[0];window.siteTestProjectId=p.id;sessionStorage.setItem('siteScheduleSnapshot',snapshot(p));openProject(p.id);
      assert('new project still creates schedule and baseline',p.steps.length===2&&p.baselineSchedule.length===2);
      assert('opening detail does not create empty persisted day records',!p.siteDays);
      const headings=Array.from(main.querySelectorAll('.section>b')).map(el=>el.textContent),order=['現場確認（今日）','今日到場','工程進度表','工程檢視','現場實際施工流程','預約／後續事項','今日照片','產生今日工程日報'];
      assert('requested sections retain order',order.every((name,i)=>headings.indexOf(name)>=0&&(i===0||headings.indexOf(name)>headings.indexOf(order[i-1]))));
      assert('old suggested work, issue, history entrypoints retained',!!main.querySelector('button[onclick^="completeStep"]')&&!!main.querySelector('button[onclick^="newIssue"]')&&!!main.querySelector('button[onclick^="report"]'));
      const input=fill('[data-site-new-check]','中文輸入中');input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true}));assert('IME confirmation does not prematurely create an item',!p.siteDays);
      enter('核對拆除圖面');enter('浴室牆面確認');assert('Enter creates exactly one item per entry',projectSiteDay(p).checks.length===2);
      assert('no add button in today checklist',!main.querySelector('[data-site-new-check]').parentElement.querySelector('button:not([data-site-action=detail])'));
      click('[data-site-check]');assert('completed item remains visible and checked',projectSiteDay(p).checks[0].done&&main.querySelectorAll('[data-site-check]').length===2&&main.querySelector('[data-site-check]').checked);
      click('[data-site-check]');assert('can uncheck completed item',!projectSiteDay(p).checks[0].done);click('[data-site-check]');
      openProject(p.id);assert('rerender preserves completed status',main.querySelector('[data-site-check]').checked);
      click('[data-site-trade="木作"]');click('[data-site-trade="水電"]');assert('attendance uses actual trade names and saves selections',projectSiteDay(p).trades.join(',')==='木作,水電');
      click('[data-site-action=detail]');fill('[data-site-note]','核對圖面完成\n現場牆面發現滲水');fill('[data-site-status]','待處理');
      await upload('#sheet [data-site-files]',1);assert('item photo uploaded with independent metadata',projectSiteDay(p).photos.length===1&&projectSiteDay(p).checks[0].photoIds.length===1);
      fill('#sheet [data-site-caption]','牆面滲水痕跡');click('[data-site-convert]');const issueId=projectSiteDay(p).checks[0].issueId;
      assert('conversion creates issue in existing issue storage',data.issues.length===1&&data.issues[0].id===issueId&&data.issues[0].note.includes('現場牆面發現滲水'));
      convertProjectSiteIssue(p.id,today,projectSiteDay(p).checks[0].id);assert('conversion is idempotent',data.issues.length===1&&p.issueCount===1);
      click('[data-site-close]');issues();assert('converted issue appears in original issue page',main.textContent.includes('核對拆除圖面'));openProject(p.id);
      const form=main.querySelector('[data-site-appointment-form]');form.elements.date.value=today;form.elements.text.value='材料進場確認';form.requestSubmit();
      assert('appointment due today added automatically',projectSiteDay(p).checks.length===3&&p.siteAppointments[0].generatedDate===today);
      for(let i=0;i<3;i++)openProject(p.id);assert('repeated rerender does not duplicate appointment',projectSiteDay(p).checks.length===3);
      const nextDate=shiftScheduleDate(today,1),next=main.querySelector('[data-site-appointment-form]');next.elements.date.value=nextDate;next.elements.text.value='水電試壓預約';next.requestSubmit();
      assert('future appointment stays out of today checklist',projectSiteDay(p).checks.length===3&&!p.siteAppointments[1].generatedItemId);
      await upload('main [data-site-files]',2);fill('main [data-site-caption]','牆面滲水痕跡');
      assert('multi-upload stores three photos including item attachment',projectSiteDay(p).photos.length===3);
      assert('new photos stored in IndexedDB, not Base64 project storage',!JSON.stringify(JSON.parse(localStorage.getItem(KEY)).projects).includes('data:image')&&!!await dailyPhotoBlob(projectSiteDay(p),projectSiteDay(p).photos[0]));
      const before=snapshot(p);click('[data-site-action=generate]');await waitFor(()=>!!document.getElementById('psReportRoot'));
      const report=p.siteReports[0];assert('generate button stores formal report and opens preview',!!report&&main.textContent.includes('工程日報'));
      assert('report automatically includes checks attendance appointments photos',report.checks.length===3&&report.trades.length===2&&report.appointments.length===2&&report.photos.length===3);
      assert('report excludes invented progress and next trade sections',!main.textContent.includes('今日進度正常')&&!main.textContent.includes('下一個工種')&&!('progressStatus' in report));
      assert('generated report has no shared mutable references',report.checks!==projectSiteDay(p).checks&&report.checks[0]!==projectSiteDay(p).checks[0]&&report.photos!==projectSiteDay(p).photos);
      await waitFor(()=>main.querySelector('.site-report-photos img')?.naturalWidth>0);
      assert('report photo preview renders saved bytes',main.querySelectorAll('.site-report-photos img').length===3);
      const book=await buildProjectSiteWorkbook(report),bytes=await book.xlsx.writeBuffer(),roundtrip=new ExcelJS.Workbook();await roundtrip.xlsx.load(bytes);const sheet=roundtrip.worksheets[0];
      assert('Excel reopens with one formal report sheet',roundtrip.worksheets.length===1&&sheet.getCell('A1').value==='工程日報');
      assert('Excel print setup is A4 portrait one page',sheet.pageSetup.paperSize===9&&sheet.pageSetup.orientation==='portrait'&&sheet.pageSetup.fitToWidth===1&&sheet.pageSetup.fitToHeight===1&&sheet.pageSetup.fitToPage);
      assert('Excel embeds all local photos',sheet.getImages().length===3);
      assert('Excel includes full notes and appointments',JSON.stringify(sheet.model).includes('現場牆面發現滲水')&&JSON.stringify(sheet.model).includes('水電試壓預約'));
      await fetch('/__site_artifact',{method:'POST',body:bytes});
      const urls=await projectSiteReportPhotoURLs(report),html=projectSiteReportBody(report,urls);
      assert('PDF source includes all photos and excludes prohibited content',(html.match(/<img /g)||[]).length===3&&!html.includes('下一個工種')&&!html.includes('今日進度正常'));
      assert('PDF declares A4 portrait',PROJECT_SITE_PRINT_CSS.includes('size:A4 portrait'));
      assert('generation/export never changes schedules or library',before===snapshot(p));
      const backup=await collectDailyReportPhotoBackup();assert('backup includes day photo and independent report snapshot bytes',backup.length===6);
      await removeDailyPhotoFiles(report,report.photos);await restoreDailyReportPhotoBackup(backup,data);assert('restore understands new daily and report photo records',!!await dailyPhotoBlob(report,report.photos[0]));
      projectSiteWriteDay(p,today,day=>day.checks[0].note='現場紀錄後續修改');assert('editing source leaves generated report notes untouched',report.checks[0].note.includes('現場牆面發現滲水'));
      const current=projectSiteDay(p),first=current.photos[0];projectSiteWriteDay(p,today,day=>{day.photos=day.photos.filter(photo=>photo.id!==first.id);day.checks.forEach(item=>item.photoIds=item.photoIds.filter(id=>id!==first.id));});await removeDailyPhotoFiles(current,[first]);
      assert('deleting source photo leaves report photo intact',!!await dailyPhotoBlob(report,report.photos[0]));
      const saved=JSON.stringify(p.siteDays),originalSave=save;save=()=>{throw Error('test quota');};let failed=false;try{projectSiteWriteDay(p,today,day=>day.checks.push(projectSiteCheck('不可儲存')));}catch(error){failed=true;}finally{save=originalSave;}
      assert('storage failure rolls back daily mutation',failed&&JSON.stringify(p.siteDays)===saved);
      const b={id:p.id+1,name:'舊工程 B',client:'',status:'進行中',steps:[]};data.projects.push(b);save();openProject(b.id);assert('legacy project without site fields opens safely',main.textContent.includes('現場確認（今日）')&&!b.siteDays&&!b.siteReports);
      enter('B 工程獨立事項');click('[data-site-check]');assert('different projects remain independent',projectSiteDay(b).checks.length===1&&projectSiteDay(p).checks.length===3);
      assert('all original schedule and quote data remain unchanged',snapshot(p)===sessionStorage.getItem('siteScheduleSnapshot'));
      openProject(p.id);
    }else{
      const p=data.projects.find(project=>project.name==='現場日報測試 A'),b=data.projects.find(project=>project.name==='舊工程 B');window.siteTestProjectId=p.id;openProject(p.id);
      assert('check completion survives browser reload',projectSiteDay(p).checks[0].done&&main.querySelector('[data-site-check]').checked);
      assert('notes status attendance and issues persist',projectSiteDay(p).checks[0].note==='現場紀錄後續修改'&&projectSiteDay(p).checks[0].status==='待處理'&&projectSiteDay(p).trades.length===2&&data.issues.length===1);
      assert('appointment does not repeat after reload',projectSiteDay(p).checks.length===3&&p.siteAppointments.length===2);
      assert('day and report photos both survive reload',!!await dailyPhotoBlob(projectSiteDay(p),projectSiteDay(p).photos[0])&&!!await dailyPhotoBlob(p.siteReports[0],p.siteReports[0].photos[0]));
      assert('old project remains independent after reload',projectSiteDay(b).checks.length===1&&projectSiteDay(b).checks[0].done);
      const tomorrow=shiftScheduleDate(today,1);ensureProjectSiteAppointments(p,tomorrow);ensureProjectSiteAppointments(p,tomorrow);
      assert('next day gets due appointment exactly once',projectSiteDay(p,tomorrow).checks.length===1&&p.siteAppointments[1].generatedDate===tomorrow);
      assert('new day does not copy yesterday completion or attendance',!projectSiteDay(p,tomorrow).checks[0].done&&projectSiteDay(p,tomorrow).trades.length===0);
      openProject(p.id);const note=fill('[data-site-new-check]','尚在輸入');refreshProjectSite(p);assert('refresh leaves input text intact',note.value==='尚在輸入');note.value='';
      click('[data-site-action=detail]');assert('notes and status dialog opens on small screen',!!sheet.querySelector('[data-site-note]')&&sheet.querySelector('[data-site-status]').value==='待處理');click('[data-site-close]');
      assert('detail page fits viewport',document.documentElement.scrollWidth<=window.innerWidth+1);
      assert('checkbox label touch target is at least 44px',Array.from(main.querySelectorAll('.site-check')).every(el=>el.getBoundingClientRect().height>=44&&el.getBoundingClientRect().width>=44));
      assert('photo upload supports multiple files and camera',main.querySelector('[data-site-files]').multiple&&main.querySelector('[data-site-camera]').getAttribute('capture')==='environment');
      assert('new input IDs do not overwrite any functions',typeof projectSiteMessage==='function'&&typeof viewProjectSiteReport==='function'&&typeof dailyReportMessage==='function');
      assert('original schedule/quote snapshot still matches after reload',snapshot(p)===sessionStorage.getItem('siteScheduleSnapshot'));
      const ids=Array.from(document.querySelectorAll('[id]')).map(el=>el.id);assert('no duplicate DOM IDs',new Set(ids).size===ids.length);
    }
    assert('no console errors or unhandled rejections',dailyTestErrors.length===0);document.title='PASS';
  }catch(error){results.push('FAIL '+error.message+'\n'+error.stack);document.title='FAIL';}
  document.getElementById('dailyTestResults').textContent=results.join('\n');
},350);
