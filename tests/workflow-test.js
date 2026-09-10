/* 只在 tests/workflow-test.html 的隔離儲存空間執行。 */
setTimeout(()=>{
  const results=[],assert=(name,value)=>{if(!value)throw Error(name);results.push('PASS '+name);};
  const node=(id,name,dependsOn=[],holdPoint=false)=>({id,name,trade:'測試工種',dependsOn,linkedTrades:[],scheduleItemName:name,checklist:holdPoint?[{id:id+'_check',text:'必要確認',done:false}]:[],notes:['測試注意事項'],holdPoint,holdConfirmed:false,status:'未開始'});
  try{
    const template={nodes:[node('a','節點 A'),node('b','節點 B',['a']),node('hold','確認節點',['b'],true),node('d','節點 D',['hold']),node('hold2','第二確認節點',['d'],true),node('f','節點 F',['hold2'])]};
    data={trades:[{name:'測試工種',items:[['節點 A',[],'','2026-01-05','2026-01-05'],['節點 B',[],'','2026-01-06','2026-01-06'],['確認節點',[],'','2026-01-07','2026-01-07'],['節點 D',[],'','2026-01-08','2026-01-08'],['第二確認節點',[],'','2026-01-09','2026-01-09'],['節點 F',[],'','2026-01-10','2026-01-10']],workflow:template}],projects:[],issues:[],methods:[]};libData=[];save();
    const steps=data.trades[0].items.map(item=>({name:item[0],trade:'測試工種',start:item[3],end:item[4],notes:[],done:false}));
    const project={id:99,name:'Workflow 測試工程',client:'',status:'進行中',steps,baselineSchedule:JSON.parse(JSON.stringify(steps)),workflow:buildProjectWorkflow([{g:{source:'2022',ti:0,customIndex:-1}}],steps)};data.projects.push(project);initializeProjectSchedules();
    libraryTradeDetail('測試工種','2022',0,0);
    assert('trade library exposes inline workflow controls',!!main.querySelector('[onclick*="editWorkflowTemplateNode"]')&&!!main.querySelector('[onclick*="setLibraryTradeNoteFilter"]'));
    openWorkflowTemplate('2022',0);
    assert('template displays every workflow node vertically',main.querySelectorAll('.workflow-node').length===6);
    editWorkflowTemplateNode('2022',0,'hold');
    assert('template editor supports dependency, linked trade, Hold Point, note category and checklist controls',!!document.getElementById('workflowLinkedTrades')&&!!document.getElementById('workflowHoldPoint')&&!!document.getElementById('workflowNoteCategory')&&document.querySelectorAll('#workflowEditorChecks button').length>=4);
    closeModal();
    assert('template creates independent project workflow copy',project.workflow.nodes!==template.nodes&&project.workflow.nodes[0]!==template.nodes[0]);
    assert('all workflow nodes keep progress-table mapping',project.workflow.nodes.every(item=>steps.some(step=>step.name===item.scheduleItemName)));
    assert('initial vertical flow has one available node',workflowStatus(project,project.workflow.nodes[0])==='可施工'&&workflowStatus(project,project.workflow.nodes[1])==='等待前置');
    project.workflow.nodes[0].status='已完成';project.workflow.nodes[1].status='已完成';project.workflow.nodes[2].status='已完成';
    assert('incomplete Hold Point keeps next node waiting',workflowStatus(project,project.workflow.nodes[2])==='等待驗收'&&workflowStatus(project,project.workflow.nodes[3])==='等待前置');
    project.workflow.nodes[2].checklist[0].done=true;project.workflow.nodes[2].holdConfirmed=true;
    assert('completed Hold Point opens next node',workflowStatus(project,project.workflow.nodes[2])==='已完成'&&workflowStatus(project,project.workflow.nodes[3])==='可施工');
    project.workflow.nodes[0].linkedTrades.push('工程內修改');
    assert('project linked trade change does not write back template',template.nodes[0].linkedTrades.length===0);
    const scheduleBefore=JSON.stringify(project.steps);openProject(project.id);
    assert('detail page renders simple vertical workflow',main.textContent.includes('施工流程 / Workflow')&&main.querySelectorAll('.workflow-node').length===6);

    const mapped=Array.from(main.querySelectorAll('.workflow-node-open')).some(button=>button.textContent.includes('節點 D')&&button.textContent.includes('1/8 ～ 1/8'));
    assert('workflow reads dates directly from current progress table',mapped);
    project.steps[3].start='2026-02-02';project.steps[3].end='2026-02-03';openProject(project.id);
    assert('editing progress dates is reflected in workflow without a second date copy',Array.from(main.querySelectorAll('.workflow-node-open')).some(button=>button.textContent.includes('節點 D')&&button.textContent.includes('2/2 ～ 2/3')));
    assert('workflow never rewrites progress entries',JSON.stringify(project.steps)!==scheduleBefore&&project.steps[3].start==='2026-02-02');
    assert('detail page replaces daily confirmation and attendance sections',main.textContent.includes('下次現場確認')&&main.textContent.includes('現場問題／溝通事項')&&!main.textContent.includes('現在建議處理')&&!main.textContent.includes('今日到場'));
    const persistent=nextSiteConfirmation(project);persistent.checks.push(projectSiteCheck('持續確認事項'));projectSiteUpdate(project,()=>{project.communicationItems=[{id:'communication-test',text:'聯絡業主',note:'',done:false}];});openProject(project.id);
    assert('next site confirmation is stored outside daily site data',project.nextSiteConfirmation.checks.some(item=>item.text==='持續確認事項')&&main.textContent.includes('持續確認事項'));
    assert('communication items are independently stored and rendered',project.communicationItems.length===1&&main.textContent.includes('聯絡業主'));
    openProjectData(project.id);
    assert('project data page exposes all requested sections',main.textContent.includes('基本資料')&&main.textContent.includes('工進表')&&main.textContent.includes('業主報價單')&&main.textContent.includes('工程成本／廠商報價')&&main.textContent.includes('工程文件'));    const legacy={id:100,name:'舊工程',client:'',status:'進行中',steps:[]};data.projects.push(legacy);openProject(legacy.id);
    assert('legacy project without workflow opens with initialization button',main.textContent.includes('從工種庫建立施工流程'));
    save();const stored=JSON.parse(localStorage.getItem(KEY)),storedWorkflow=stored.projects.find(item=>item.id===99).workflow;
    assert('project workflow persists with independent checklist state',storedWorkflow.nodes.length===6&&storedWorkflow.nodes[2].checklist[0].done&&storedWorkflow.nodes[0].linkedTrades.includes('工程內修改'));
    assert('no runtime errors',workflowTestErrors.length===0);document.title='PASS';
  }catch(error){results.push('FAIL '+error.message+'\n'+error.stack);document.title='FAIL';}
  document.getElementById('workflowTestResults').textContent=results.join('\n');
},350);
