/* 施工流程：工種庫儲存範本，工程只保存深複製後的獨立節點。 */
const WORKFLOW_STATUSES=['未開始','等待前置','可施工','施工中','等待驗收','已完成','需要修改'];
const WORKFLOW_NOTE_CATEGORIES=['施工前','設計尺寸','施工中','驗收','經驗'];
let workflowEditor=null;
function workflowId(){return typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'?crypto.randomUUID():'wf_'+Date.now()+'_'+Math.random().toString(36).slice(2);}
function workflowTrade(source,index){return source==='2022'?data.trades[index]:libData[index];}
function workflowTemplateNodes(trade){return Array.isArray(trade?.workflow?.nodes)?trade.workflow.nodes:[];}
function workflowTemplateAllNodes(){return libraryGroups().flatMap(group=>workflowTemplateNodes(workflowTrade(group.source,group.source==='2022'?group.ti:group.customIndex)).map(node=>({node,trade:group.name,source:group.source,index:group.source==='2022'?group.ti:group.customIndex})));}
function workflowClone(value){return JSON.parse(JSON.stringify(value));}
function workflowNewNode(trade){return {id:workflowId(),name:'',trade,dependsOn:[],linkedTrades:[],scheduleItemName:'',checklist:[],notes:[],noteCategory:'施工前',holdPoint:false,holdConfirmed:false,status:'未開始'};}
function workflowNormalizeNode(node,trade){
  node.id=node.id||workflowId();node.name=String(node.name||'未命名節點');node.trade=String(node.trade||trade||'未分類');
  node.dependsOn=Array.isArray(node.dependsOn)?node.dependsOn.filter(Boolean):[];node.linkedTrades=Array.isArray(node.linkedTrades)?node.linkedTrades.filter(Boolean):[];
  node.scheduleItemName=String(node.scheduleItemName||'');node.checklist=Array.isArray(node.checklist)?node.checklist.map(item=>typeof item==='string'?{id:workflowId(),text:item,done:false}:{id:item.id||workflowId(),text:String(item.text||''),done:!!item.done}):[];
  node.notes=Array.isArray(node.notes)?node.notes.map(String).filter(Boolean):[];node.noteCategory=WORKFLOW_NOTE_CATEGORIES.includes(node.noteCategory)?node.noteCategory:'施工前';node.holdPoint=!!node.holdPoint;node.holdConfirmed=!!node.holdConfirmed;
  node.status=WORKFLOW_STATUSES.includes(node.status)?node.status:'未開始';return node;
}
function workflowProjectNodes(project){return Array.isArray(project?.workflow?.nodes)?project.workflow.nodes:[];}
function workflowNodeById(project,id){return workflowProjectNodes(project).find(node=>node.id===id);}
function workflowStatus(project,node,seen=new Set()){
  workflowNormalizeNode(node,node.trade);
  // 範本可跨工種選前置節點；遇到循環設定時安全地保留為等待前置，不遞迴失敗。
  if(seen.has(node.id))return '等待前置';
  seen.add(node.id);
  if(node.status==='需要修改')return node.status;
  // 即使舊資料或其他入口曾把 Hold Point 寫成完成，仍不可開放後續節點。
  if(node.status==='已完成')return workflowHoldReady(node)?'已完成':'等待驗收';
  const prerequisites=node.dependsOn.map(id=>workflowNodeById(project,id));
  if(prerequisites.some(node=>!node||workflowStatus(project,node,new Set(seen))!=='已完成'))return '等待前置';
  if(node.status==='施工中'||node.status==='等待驗收')return node.status;
  return '可施工';
}
function workflowHoldReady(node){return !node.holdPoint||(node.holdConfirmed&&node.checklist.every(item=>item.done));}
function workflowNodeLabel(project,id){const node=workflowNodeById(project,id);return node?node.trade+'｜'+node.name:'已移除的前置節點';}
function workflowTemplateNodeLabel(id){const match=workflowTemplateAllNodes().find(item=>item.node.id===id);return match?match.trade+'｜'+match.node.name:'已移除的前置節點';}
function workflowDependencyText(project,node){return node.dependsOn.length?node.dependsOn.map(id=>esc(workflowNodeLabel(project,id))).join('、'):'無';}
function workflowTemplateDependencyText(node){return node.dependsOn.length?node.dependsOn.map(id=>esc(workflowTemplateNodeLabel(id))).join('、'):'無';}

function workflowTemplateSummary(trade,source,index){
  const nodes=workflowTemplateNodes(trade).map(node=>workflowNormalizeNode(node,trade.name));
  const nodeHTML=nodes.map((node,i)=>'<details class="card workflow-node"><summary style="display:flex;gap:10px;align-items:center"><span class="workflow-number">'+(i+1)+'</span><span style="flex:1"><b>'+esc(node.name)+'</b><small class="muted">'+esc(node.trade)+'　｜　'+esc(node.status)+(node.holdPoint?'　◆ Hold Point':'')+'</small></span><span class="tag">'+node.checklist.filter(item=>item.done).length+'/'+node.checklist.length+'</span></summary><div style="padding-top:12px"><div class="section"><b>Checklist</b></div>'+(node.checklist.length?node.checklist.map(item=>'<label class="workflow-check"><input type="checkbox" disabled '+(item.done?'checked':'')+'>'+esc(item.text)+'</label>').join(''):'<div class="muted">尚無 Checklist。</div>')+'<div class="hint">前置節點：'+workflowTemplateDependencyText(node)+'<br>連動工種：'+esc((node.linkedTrades||[]).join('、')||'未設定')+'<br>Hold Point：'+(node.holdPoint?'是':'否')+'</div><div class="actions"><button class="orderbtn" onclick="moveWorkflowTemplateNode(\''+esc(source)+'\','+index+',\''+esc(node.id)+'\',-1)">↑</button><button class="orderbtn" onclick="moveWorkflowTemplateNode(\''+esc(source)+'\','+index+',\''+esc(node.id)+'\',1)">↓</button><button class="light" onclick="editWorkflowTemplateNode(\''+esc(source)+'\','+index+',\''+esc(node.id)+'\')">編輯</button><button class="light" onclick="deleteWorkflowTemplateNode(\''+esc(source)+'\','+index+',\''+esc(node.id)+'\')">刪除</button></div></div></details>'+(i<nodes.length-1?'<div class="muted" style="padding:2px 0 2px 12px">↓</div>':'')).join('');
  return '<div class="section"><b>施工流程</b><button onclick="editWorkflowTemplateNode(\''+esc(source)+'\','+index+')">＋ 新增施工節點</button></div><div class="workflow-list">'+(nodeHTML||'<div class="card muted">尚未設定施工流程。</div>')+'</div>';
}
function openWorkflowTemplate(source,index){
  const trade=workflowTrade(source,index);if(!trade)return library();
  const nodes=workflowTemplateNodes(trade).map(node=>workflowNormalizeNode(node,trade.name));
  main.innerHTML='<button class="back" onclick="libraryTradeDetail(\''+esc(trade.name)+'\',\''+esc(source)+'\','+index+','+index+')">← 返回工種</button><div class="card"><span class="tag">'+esc(trade.name)+'</span><h2>施工流程 / Workflow</h2><div class="muted">此頁是工種庫範本；套用到工程後會建立獨立副本。</div></div><div class="section"><b>流程節點</b><button onclick="editWorkflowTemplateNode(\''+esc(source)+'\','+index+')">＋ 新增節點</button></div><div class="workflow-list">'+(nodes.length?nodes.map((node,i)=>workflowTemplateNodeHTML(node,i,source,index)).join(''):'<div class="empty">尚未設定節點。</div>')+'</div>';
}
function workflowTemplateNodeHTML(node,index,source,tradeIndex){return '<article class="card workflow-node"><div class="workflow-number">'+(index+1)+'</div><div style="flex:1"><b>'+esc(node.name)+'</b><div class="muted">'+esc(node.trade)+'　｜　'+esc(node.status)+'</div><div class="muted">前置：'+workflowTemplateDependencyText(node)+'</div><div class="muted">工進表：'+esc(node.scheduleItemName||'未對應')+'　｜　'+(node.holdPoint?'Hold Point':'一般節點')+'</div></div><button class="orderbtn" onclick="moveWorkflowTemplateNode(\''+esc(source)+'\','+tradeIndex+',\''+esc(node.id)+'\',-1)">↑</button><button class="orderbtn" onclick="moveWorkflowTemplateNode(\''+esc(source)+'\','+tradeIndex+',\''+esc(node.id)+'\',1)">↓</button><button class="light" onclick="editWorkflowTemplateNode(\''+esc(source)+'\','+tradeIndex+',\''+esc(node.id)+'\')">編輯</button><button class="light" onclick="deleteWorkflowTemplateNode(\''+esc(source)+'\','+tradeIndex+',\''+esc(node.id)+'\')">刪除</button></article>';}
function editWorkflowTemplateNode(source,index,nodeId){
  const trade=workflowTrade(source,index);if(!trade)return;
  const existing=nodeId?workflowTemplateNodes(trade).find(node=>node.id===nodeId):null;
  workflowEditor={kind:'template',source,index,node:workflowNormalizeNode(workflowClone(existing||workflowNewNode(trade.name)),trade.name)};
  renderWorkflowTemplateEditor();
}
function renderWorkflowTemplateEditor(){
  const editor=workflowEditor,node=editor.node,all=workflowTemplateAllNodes().filter(item=>item.node.id!==node.id);
  openModal('<div class="workflow-editor"><h2>'+esc(node.name||'新增施工節點')+'</h2><label>節點名稱<input id="workflowNodeName" value="'+esc(node.name)+'" required></label><label>所屬工種<input id="workflowNodeTrade" value="'+esc(node.trade)+'" required></label><label>預設連動工種 <span class="muted">用逗號分隔</span><input id="workflowLinkedTrades" value="'+esc(node.linkedTrades.join('、'))+'" placeholder="例如：下一工種"></label><label>對應工程進度表項目<input id="workflowScheduleItem" value="'+esc(node.scheduleItemName)+'" placeholder="可留空"></label><label>注意事項 <span class="muted">每行一項</span><textarea id="workflowNodeNotes">'+esc(node.notes.join('\n'))+'</textarea></label><label>注意事項分類<select id="workflowNoteCategory">'+WORKFLOW_NOTE_CATEGORIES.map(category=>'<option '+(category===node.noteCategory?'selected':'')+'>'+category+'</option>').join('')+'</select></label><label class="workflow-check"><input id="workflowHoldPoint" type="checkbox" '+(node.holdPoint?'checked':'')+'> Hold Point（完成前須完成檢查與確認）</label><label>範本狀態<select id="workflowDefaultStatus">'+WORKFLOW_STATUSES.map(status=>'<option '+(status===node.status?'selected':'')+'>'+status+'</option>').join('')+'</select></label><div class="section"><b>前置節點</b></div><div class="workflow-dependencies">'+(all.length?all.map(item=>'<label class="workflow-check"><input type="checkbox" data-workflow-dependency="'+esc(item.node.id)+'" '+(node.dependsOn.includes(item.node.id)?'checked':'')+'>'+esc(item.trade+'｜'+item.node.name)+'</label>').join(''):'<div class="muted">尚無其他流程節點。</div>')+'</div><div class="section"><b>Checklist</b><button class="light" onclick="workflowAddEditorCheck()">＋ 新增</button></div><div id="workflowEditorChecks">'+workflowEditorChecklistHTML(node.checklist)+'</div><div class="actions"><button class="light" onclick="closeModal()">取消</button><button onclick="saveWorkflowTemplateNode()">儲存範本</button></div></div>');
}
function workflowEditorChecklistHTML(checks){return checks.length?checks.map((item,index)=>'<div class="workflow-check-row"><span>'+esc(item.text)+'</span><button class="orderbtn" onclick="workflowEditEditorCheck('+index+')">編輯</button><button class="orderbtn" onclick="workflowMoveEditorCheck('+index+',-1)">↑</button><button class="orderbtn" onclick="workflowMoveEditorCheck('+index+',1)">↓</button><button class="light" onclick="workflowDeleteEditorCheck('+index+')">刪除</button></div>').join(''):'<div class="muted">尚無 Checklist。</div>';}
function workflowRenderEditorChecks(){const box=document.getElementById('workflowEditorChecks');if(box)box.innerHTML=workflowEditorChecklistHTML(workflowEditor.node.checklist);}
function workflowAddEditorCheck(){const text=prompt('Checklist 項目');if(text?.trim()){workflowEditor.node.checklist.push({id:workflowId(),text:text.trim(),done:false});workflowRenderEditorChecks();}}
function workflowEditEditorCheck(index){const item=workflowEditor.node.checklist[index],text=prompt('修改 Checklist',item?.text);if(text?.trim()){item.text=text.trim();workflowRenderEditorChecks();}}
function workflowDeleteEditorCheck(index){workflowEditor.node.checklist.splice(index,1);workflowRenderEditorChecks();}
function workflowMoveEditorCheck(index,direction){const checks=workflowEditor.node.checklist,next=index+direction;if(next<0||next>=checks.length)return;[checks[index],checks[next]]=[checks[next],checks[index]];workflowRenderEditorChecks();}
function saveWorkflowTemplateNode(){
  const editor=workflowEditor,trade=workflowTrade(editor.source,editor.index);if(!editor||!trade)return;
  const name=document.getElementById('workflowNodeName').value.trim(),node=editor.node;if(!name)return;
  node.name=name;node.trade=document.getElementById('workflowNodeTrade').value.trim()||trade.name;node.linkedTrades=document.getElementById('workflowLinkedTrades').value.split(/[、,，]/).map(value=>value.trim()).filter(Boolean);node.scheduleItemName=document.getElementById('workflowScheduleItem').value.trim();node.notes=document.getElementById('workflowNodeNotes').value.split('\n').map(value=>value.trim()).filter(Boolean);node.noteCategory=document.getElementById('workflowNoteCategory').value;node.holdPoint=document.getElementById('workflowHoldPoint').checked;node.status=document.getElementById('workflowDefaultStatus').value;node.dependsOn=Array.from(document.querySelectorAll('[data-workflow-dependency]:checked')).map(input=>input.dataset.workflowDependency);
  trade.workflow||={nodes:[]};const nodes=trade.workflow.nodes,index=nodes.findIndex(item=>item.id===node.id);if(index>=0)nodes[index]=workflowClone(node);else nodes.push(workflowClone(node));
  if(editor.source==='2022')save();else saveLib();closeModal();libraryTradeDetail(trade.name,editor.source,editor.index,editor.index);
}
function moveWorkflowTemplateNode(source,index,nodeId,direction){
  const trade=workflowTrade(source,index),nodes=workflowTemplateNodes(trade),position=nodes.findIndex(node=>node.id===nodeId),next=position+direction;
  if(position<0||next<0||next>=nodes.length)return;
  [nodes[position],nodes[next]]=[nodes[next],nodes[position]];
  if(source==='2022')save();else saveLib();libraryTradeDetail(trade.name,source,index,index);
}
function deleteWorkflowTemplateNode(source,index,nodeId){
  const trade=workflowTrade(source,index);if(!trade||!confirm('刪除此流程節點？'))return;
  trade.workflow={nodes:workflowTemplateNodes(trade).filter(node=>node.id!==nodeId)};
  let changed2022=source==='2022',changedCustom=source==='custom';
  data.trades.forEach(item=>workflowTemplateNodes(item).forEach(node=>{const before=(node.dependsOn||[]).length;node.dependsOn=(node.dependsOn||[]).filter(id=>id!==nodeId);changed2022||=before!==node.dependsOn.length;}));
  libData.forEach(item=>workflowTemplateNodes(item).forEach(node=>{const before=(node.dependsOn||[]).length;node.dependsOn=(node.dependsOn||[]).filter(id=>id!==nodeId);changedCustom||=before!==node.dependsOn.length;}));
  if(changed2022)save();if(changedCustom)saveLib();libraryTradeDetail(trade.name,source,index,index);
}

function buildProjectWorkflow(selected,steps){
  const groups=[...new Map(selected.map(item=>[item.g.source+':'+(item.g.source==='2022'?item.g.ti:item.g.customIndex),item.g])).values()];
  const nodes=groups.flatMap(group=>workflowTemplateNodes(workflowTrade(group.source,group.source==='2022'?group.ti:group.customIndex)).map(node=>workflowClone(node)));
  const present=new Set(nodes.map(node=>node.id));
  return {nodes:nodes.map(node=>{workflowNormalizeNode(node,node.trade);node.dependsOn=node.dependsOn.filter(id=>present.has(id));node.checklist.forEach(item=>item.done=false);node.holdConfirmed=false;node.status='未開始';if(!node.scheduleItemName&&steps.some(step=>step.name===node.name))node.scheduleItemName=node.name;return node;})};
}
function buildProjectWorkflowFromLibrary(project){
  const selected=[];const names=[...new Set((project.steps||[]).map(step=>step.trade).filter(Boolean))];
  libraryGroups().forEach(group=>{if(names.includes(group.name))selected.push({g:group});});
  return buildProjectWorkflow(selected,project.steps||[]);
}
function workflowProjectHTML(project){
  const nodes=workflowProjectNodes(project);
  if(!nodes.length)return '<div class="section"><b>施工流程 / Workflow</b></div><div class="card"><div class="muted">此工程尚未建立施工流程。</div><button style="margin-top:10px" onclick="createProjectWorkflow('+project.id+')">從工種庫建立施工流程</button></div>';
  return '<div class="section"><b>施工流程 / Workflow</b><button class="light" onclick="createProjectWorkflow('+project.id+',true)">重新從範本建立</button></div><div class="workflow-list">'+nodes.map((node,index)=>workflowProjectNodeHTML(project,node,index)).join('')+'</div>';
}
function workflowProjectNodeHTML(project,node,index){
  const status=workflowStatus(project,node),step=(project.steps||[]).find(item=>item.name===node.scheduleItemName),blocked=status==='等待前置'||(node.holdPoint&&status==='等待驗收'&&!workflowHoldReady(node));
  return '<article class="card workflow-node '+(blocked?'workflow-blocked':'')+'"><div class="workflow-number">'+(index+1)+'</div><button class="workflow-node-open" onclick="openProjectWorkflowNode('+project.id+',\''+esc(node.id)+'\')"><b>'+esc(node.name)+'</b><div class="muted">'+esc(node.trade)+'　｜　'+esc(status)+'</div><div class="muted">前置：'+workflowDependencyText(project,node)+'</div><div class="muted">工進表：'+esc(step?fmtDate(step.start)+' ～ '+fmtDate(step.end):node.scheduleItemName||'未對應')+'</div>'+((node.holdPoint)?'<div class="muted">Hold Point：'+(workflowHoldReady(node)?'已確認':'待確認')+'</div>':'')+'</button>'+(typeof checklistProgressButton==='function'?checklistProgressButton(project.id,'workflow',index,node):'')+'<span class="tag">'+esc(status)+'</span></article>';
}
function createProjectWorkflow(projectId,replace){
  const project=data.projects.find(item=>item.id===projectId);if(!project)return;
  if(project.workflow?.nodes?.length&&replace&&!confirm('重新建立會以目前工種庫範本覆蓋此工程的 Workflow，是否繼續？'))return;
  const workflow=buildProjectWorkflowFromLibrary(project);
  if(!workflow.nodes.length){alert('目前工程所使用的工種庫尚未設定 Workflow 範本。');return;}
  project.workflow=workflow;save();openProject(projectId);
}
function openProjectWorkflowNode(projectId,nodeId){
  const project=data.projects.find(item=>item.id===projectId),node=workflowNodeById(project,nodeId);if(!project||!node)return;
  const status=workflowStatus(project,node),canEdit=status!=='等待前置';
  openModal('<div class="workflow-editor"><h2>'+esc(node.name)+'</h2><div class="muted">'+esc(node.trade)+'　｜　目前狀態：'+esc(status)+'</div><label>工程內連動工種 <span class="muted">用逗號分隔</span><input id="projectWorkflowLinked" value="'+esc(node.linkedTrades.join('、'))+'"></label><label>對應工程進度表<select id="projectWorkflowStep"><option value="">未對應</option>'+(project.steps||[]).map(step=>'<option '+(step.name===node.scheduleItemName?'selected':'')+'>'+esc(step.name)+'</option>').join('')+'</select></label><div class="section"><b>Checklist</b><button class="light" onclick="workflowProjectAddCheck('+projectId+',\''+esc(node.id)+'\')">＋ 新增</button></div><div id="projectWorkflowChecks">'+workflowProjectChecklistHTML(project,node,canEdit)+'</div>'+(node.holdPoint?'<label class="workflow-check"><input id="projectWorkflowHold" type="checkbox" '+(node.holdConfirmed?'checked':'')+' '+(canEdit?'':'disabled')+'> Hold Point 必要確認</label>':'')+'<label>狀態<select id="projectWorkflowStatus" '+(canEdit?'':'disabled')+'>'+WORKFLOW_STATUSES.map(value=>'<option '+(value===status?'selected':'')+'>'+value+'</option>').join('')+'</select></label>'+(node.notes.length?'<div class="hint">注意事項：'+node.notes.map(esc).join('、')+'</div>':'')+'<div id="projectWorkflowMessage" class="hint" hidden></div><div class="actions"><button class="light" onclick="closeModal()">取消</button><button '+(canEdit?'':'disabled')+' onclick="saveProjectWorkflowNode('+projectId+',\''+esc(node.id)+'\')">儲存</button></div></div>');
}
function workflowProjectChecklistHTML(project,node,canEdit){return node.checklist.length?node.checklist.map((item,index)=>'<div class="workflow-check-row"><label class="workflow-check"><input type="checkbox" data-project-workflow-check="'+esc(item.id)+'" '+(item.done?'checked':'')+' '+(canEdit?'':'disabled')+'>'+esc(item.text)+'</label><button class="orderbtn" '+(canEdit?'':'disabled')+' onclick="workflowProjectEditCheck('+project.id+',\''+esc(node.id)+'\','+index+')">編輯</button><button class="orderbtn" '+(canEdit?'':'disabled')+' onclick="workflowProjectMoveCheck('+project.id+',\''+esc(node.id)+'\','+index+',-1)">↑</button><button class="orderbtn" '+(canEdit?'':'disabled')+' onclick="workflowProjectMoveCheck('+project.id+',\''+esc(node.id)+'\','+index+',1)">↓</button><button class="light" '+(canEdit?'':'disabled')+' onclick="workflowProjectDeleteCheck('+project.id+',\''+esc(node.id)+'\','+index+')">刪除</button></div>').join(''):'<div class="muted">尚無 Checklist。</div>';}
function workflowProjectRefreshModal(projectId,nodeId){openProjectWorkflowNode(projectId,nodeId);}
function workflowProjectAddCheck(projectId,nodeId){const text=prompt('Checklist 項目');const node=workflowNodeById(data.projects.find(p=>p.id===projectId),nodeId);if(text?.trim()&&node){node.checklist.push({id:workflowId(),text:text.trim(),done:false});save();workflowProjectRefreshModal(projectId,nodeId);}}
function workflowProjectEditCheck(projectId,nodeId,index){const node=workflowNodeById(data.projects.find(p=>p.id===projectId),nodeId),text=prompt('修改 Checklist',node?.checklist[index]?.text);if(text?.trim()){node.checklist[index].text=text.trim();save();workflowProjectRefreshModal(projectId,nodeId);}}
function workflowProjectDeleteCheck(projectId,nodeId,index){const node=workflowNodeById(data.projects.find(p=>p.id===projectId),nodeId);if(node){node.checklist.splice(index,1);save();workflowProjectRefreshModal(projectId,nodeId);}}
function workflowProjectMoveCheck(projectId,nodeId,index,direction){const node=workflowNodeById(data.projects.find(p=>p.id===projectId),nodeId),next=index+direction;if(!node||next<0||next>=node.checklist.length)return;[node.checklist[index],node.checklist[next]]=[node.checklist[next],node.checklist[index]];save();workflowProjectRefreshModal(projectId,nodeId);}
function saveProjectWorkflowNode(projectId,nodeId){
  const project=data.projects.find(item=>item.id===projectId),node=workflowNodeById(project,nodeId);if(!project||!node)return;
  const status=workflowStatus(project,node);if(status==='等待前置'){return;}
  node.linkedTrades=document.getElementById('projectWorkflowLinked').value.split(/[、,，]/).map(value=>value.trim()).filter(Boolean);node.scheduleItemName=document.getElementById('projectWorkflowStep').value;node.checklist.forEach(item=>{const input=document.querySelector('[data-project-workflow-check="'+CSS.escape(item.id)+'"]');if(input)item.done=input.checked;});if(node.holdPoint)node.holdConfirmed=document.getElementById('projectWorkflowHold').checked;
  const wanted=document.getElementById('projectWorkflowStatus').value;
  if(wanted==='已完成'&&!workflowHoldReady(node)){const message=document.getElementById('projectWorkflowMessage');message.hidden=false;message.textContent='Hold Point 的 Checklist 與必要確認完成後，才能完成此節點並開放下一節點。';return;}
  node.status=wanted;save();closeModal();openProject(projectId);
}
