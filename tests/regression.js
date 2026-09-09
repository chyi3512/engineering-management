/* Run only on tests/regression.html in an isolated browser profile. */
setTimeout(async()=>{
  const results=[],assert=(label,condition)=>{if(!condition)throw new Error(label);results.push('PASS '+label);};
  const field=(id,value)=>{document.getElementById(id).value=value;};
  const fire=(el,type)=>el.dispatchEvent(new Event(type,{bubbles:true}));
  const sourceFixture=[{name:'泥作',notes:['原有提醒'],items:[['防水',['試水'],'貼磚','2026-09-06','2026-09-07'],['貼磚',['排版'],'','2026-09-08','2026-09-10']]},{name:'水電',items:[['配管',['試壓'],'','2026-09-06','2026-09-08']]}];
  try{
    assert('all scripts initialize without JavaScript errors',!testErrors.length);
    if(new URLSearchParams(location.search).has('visual')){newProject();document.querySelector('.projectTrade').click();document.querySelector('#newProjectForm button[aria-controls]').click();document.getElementById('results').hidden=true;return;}
    if(new URLSearchParams(location.search).has('reload')){
      const p=data.projects.find(p=>p.name==='回歸工程');
      assert('project survives reload',!!p);
      assert('site confirmation survives reload',p.steps[0].siteConfirmed===true);
      assert('note checkbox survives reload',p.steps[0].noteChecks[0]===true);
      assert('baseline survives reload independently',p.baselineSchedule[0].name==='防水'&&p.steps[0].name==='現場防水');
      assert('baseline refrozen after reload',Object.isFrozen(p.baselineSchedule[0].notes));
      assert('trade notes persist independently',data.trades[0].notes.includes('修改後提醒')&&!data.trades[1].notes);
      assert('custom library notes persist',libData[0].notes[0]==='自訂提醒');
      assert('quote edits survive startup',quoteData.items.some(x=>x.id==='regression-quote'));
      openProject(p.id);assert('render uses saved site confirmation',document.querySelector('.project-check input').checked);
    }else{
      data={trades:structuredClone(sourceFixture),projects:[],issues:[],methods:[],scheduleGroups:[]};
      libData=[{name:'泥作',items:[['自訂地坪',['自訂注意'],'']]}];
      const before=JSON.stringify(data.trades);libraryGroups();libraryGroups();assert('library grouping never mutates example data',JSON.stringify(data.trades)===before);
      const alerts=[];window.alert=text=>alerts.push(text);
      assert('date validator rejects partial and impossible dates',!isCompleteScheduleDate('2')&&!isCompleteScheduleDate('2026-02-30')&&isCompleteScheduleDate('2024-02-29'));
      exampleSchedule();
      assert('three views use one schedule',document.querySelectorAll('[data-example-tab]').length===3&&document.querySelectorAll('[data-example-view]').length===3);
      const dateInput=document.querySelector('input[type=date]');dateInput.value='0002-09-06';fire(dateInput,'input');fire(dateInput,'change');
      assert('typing partial year does not validate or save',alerts.length===0&&data.trades[0].items[0][3]==='2026-09-06');
      updateScheduleDateInline(0,0,'start','2');assert('partial date is ignored',alerts.length===0&&data.trades[0].items[0][3]==='2026-09-06');
      updateScheduleDateInline(0,0,'end','2026-09-05');assert('complete reversed dates rejected without mutation',alerts.length===1&&data.trades[0].items[0][4]==='2026-09-07');
      const endInput=document.querySelectorAll('input[type=date]')[1];endInput.value='2026-09-09';fire(endInput,'blur');
      assert('complete date blur updates timeline',data.trades[0].items[0][4]==='2026-09-09'&&document.querySelector('.schedule-timeline-scroll').innerHTML.includes('9/9'));
      updateScheduleItemGroup(0,0,'水電');
      let timeline=document.querySelector('.schedule-timeline-scroll');let row=Array.from(timeline.querySelectorAll('[title]')).find(el=>el.title.startsWith('防水')).parentElement.parentElement;
      assert('category change moves actual timeline bar',row.firstElementChild.textContent.includes('水電'));
      updateScheduleItemGroup(0,0,'泥作');
      row=Array.from(document.querySelectorAll('.schedule-timeline-scroll [title]')).find(el=>el.title.startsWith('防水')).parentElement.parentElement;
      assert('correcting category moves bar back',row.firstElementChild.textContent.includes('泥作'));
      editScheduleItem(0,0);field('ein','防水修正');document.querySelector('#sheet .actions button:last-child').click();
      assert('item name edit refreshes timeline',document.querySelector('.schedule-timeline-scroll').textContent.includes('防水修正'));
      editScheduleGroup(0);field('scheduleGroupNameEdit','泥作修正');
      // Use the form's actual field names, also exercising the real modal save button.
      document.querySelector('#sheet .actions button:last-child').click();
      assert('group name edit refreshes timeline',document.querySelector('.schedule-timeline-scroll').textContent.includes('泥作修正'));
      setExampleScheduleView('week');assert('weekly tab shows spanning final week',!document.querySelector('[data-example-view=week]').hidden&&document.querySelector('[data-example-view=week]').textContent.includes('Week 2'));
      const weekly=renderWeeklyStages([{ti:0,j:0,trade:'泥作',name:'跨週測試',start:'2026-09-06',end:'2026-09-07'}]);assert('Sunday to Monday item appears in both weeks',(weekly.match(/跨週測試/g)||[]).length>=4);
      setExampleScheduleView('trade');assert('trade tab lists items and dates',document.querySelector('[data-example-view=trade]').textContent.includes('防水修正'));
      data.trades=structuredClone(sourceFixture);data.scheduleGroups=[];
      newProject();const parent=document.querySelector('.projectTrade');parent.click();
      assert('parent checkbox selects every child',document.querySelectorAll('.libItem:checked').length===2);
      const expand=document.querySelector('#newProjectForm button[aria-controls]');expand.click();expand.click();assert('folding is independent of selection',parent.checked&&document.querySelectorAll('.libItem:checked').length===2);
      document.querySelector('.libItem').click();assert('partial selection is represented',parent.indeterminate&&!parent.checked);parent.click();
      field('projectName','回歸工程');field('projectStart','2026-10-01');field('projectClient','測試業主');
      const submit=document.querySelector('#newProjectForm button[type=submit]');assert('create button enabled',!submit.disabled);submit.click();
      assert('form submit creates one project',data.projects.length===1&&modal.style.display==='none');
      saveProject();assert('duplicate submit cannot create twice',data.projects.length===1);
      const p=data.projects[0],baseline=JSON.stringify(p.baselineSchedule);
      assert('schedule dates shift from example',p.steps[0].start==='2026-10-01'&&p.steps[1].start==='2026-10-03');
      assert('baseline and actual are deeply independent',p.steps!==p.baselineSchedule&&p.steps[0].notes!==p.baselineSchedule[0].notes&&p.actualSchedule===p.steps&&Object.isFrozen(p.baselineSchedule));
      openProject(p.id);document.querySelector('.project-check input').click();assert('site checkbox can be checked',p.steps[0].siteConfirmed===true);document.querySelector('.project-check input').click();assert('site checkbox can be unchecked',p.steps[0].siteConfirmed===false);document.querySelector('.project-check input').click();document.querySelectorAll('.project-check input')[1].click();openProject(p.id);assert('confirmation persists after rendering',document.querySelector('.project-check input').checked);
      stepDetail(p.id,0);field('ss','2026-11-01');field('se','2026-10-01');saveStepEdit(p.id,0);assert('rejected actual dates leave all saved state intact',p.steps[0].start==='2026-10-01');
      field('sn','現場防水');field('st','現場泥作');field('ss','2026-10-02');field('se','2026-10-04');saveStepEdit(p.id,0);
      assert('editing actual leaves baseline untouched',JSON.stringify(p.baselineSchedule)===baseline&&p.steps[0].name==='現場防水');
      openProjectSchedule(p.id,'baseline');assert('baseline UI is read only',!main.querySelector('input,textarea,select')&&!main.textContent.includes('現場防水'));
      moveProjectStep(p.id,0,1);assert('reordering actual does not change baseline',JSON.stringify(p.baselineSchedule)===baseline);moveProjectStep(p.id,1,-1);closeModal();
      library();const details=main.querySelector('details');details.open=true;fire(details,'toggle');addLibraryTradeNote('2022',0,true);field('tradeNoteText','新增提醒');document.querySelector('#sheet .actions button:last-child').click();assert('trade note add saves correct source',data.trades[0].notes.includes('新增提醒')&&!data.trades[1].notes);
      editLibraryTradeNote('2022',0,1,true);field('tradeNoteText','修改後提醒');saveLibraryTradeNote('2022',0,1,true);assert('trade note edit',data.trades[0].notes[1]==='修改後提醒');
      removeLibraryTradeNote('2022',0,0,true);document.querySelector('#sheet .actions button:last-child').click();assert('trade note delete',data.trades[0].notes.length===1&&data.trades[0].notes[0]==='修改後提醒');
      addLibraryTradeNote('custom',0,true);field('tradeNoteText','自訂提醒');saveLibraryTradeNote('custom',0,-1,true);assert('same name custom trade keeps independent notes',libData[0].notes[0]==='自訂提醒'&&data.trades[0].notes[0]==='修改後提醒');
      exampleLibraryItemDetail(0,0);assert('example details missing helper fixed',main.textContent.includes('前置條件'));
      openLibraryTrade('2022',0);assert('existing photo section still available',main.textContent.includes('照片參考'));
      home();projects();issues();methods();quoteHome();assert('existing navigation renders',main.textContent.includes('報價管理'));
      const count=data.projects.length;newProject();field('projectName','   ');saveProject();assert('blank project name is visibly rejected',data.projects.length===count&&!document.getElementById('projectFormError').hidden);
      field('projectName','空選工程');field('projectStart','2026-10-01');saveProject();const empty=data.projects.at(-1);assert('no trades selected still creates independent default schedules',empty.steps.length===1&&empty.steps[0].name==='現場確認'&&empty.steps!==empty.baselineSchedule);
      newProject();document.querySelectorAll('.projectTrade')[2].click();field('projectName','自訂工期');field('projectStart','2026-10-01');saveProject();assert('undated custom item defaults to one day',data.projects.at(-1).steps[0].start==='2026-10-01'&&data.projects.at(-1).steps[0].end==='2026-10-01');
      data.projects.push({id:1,name:'舊空工程',steps:[],status:'進行中',legacyField:'keep'});const legacy=JSON.stringify(data.projects.at(-1));initializeProjectSchedules();assert('old project data is unchanged',JSON.stringify(data.projects.at(-1))===legacy);openProject(1);assert('old empty project opens safely',main.textContent.includes('目前沒有工項'));
      quoteData.items.push({id:'regression-quote',name:'保留報價',category:'其他',vendors:{}});qsave();save();saveLib();
      assert('no runtime event errors',!testErrors.length);
    }
  }catch(e){results.push('FAIL '+e.stack);}
  document.getElementById('results').textContent=results.join('\n');
  document.title=results.some(x=>x.startsWith('FAIL'))?'FAIL':'PASS';
},300);
