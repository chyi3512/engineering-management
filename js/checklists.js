/* Checklist templates live in the existing backup; project nodes own their records. */
function checklistLibrary(){
  if(!Array.isArray(data.checklistLibrary))data.checklistLibrary=['水電','泥作','木工','油漆','設備'].map(name=>({id:workflowId(),name,nodes:[]}));
  return data.checklistLibrary;
}
function checklistTabs(active){return '<div class="checklist-tabs" role="group" aria-label="問題頁分類"><button class="light" aria-pressed="'+(active==='issues')+'" onclick="issues()">問題追蹤</button><span>｜</span><button class="light" aria-pressed="'+(active==='checklist')+'" onclick="checklistHome()">Checklist</button></div>';}
function checklistControls(t,n,i,index,length){
  const args=[t,n,i].join(',');
  return '<details class="checklist-menu"><summary aria-label="更多操作">⋯</summary><div><button onclick="checklistOpenEditor('+args+',\''+(i>=0?'item':'node')+'\')">編輯</button><button onclick="checklistDelete('+args+')">刪除</button><button '+(index===0?'disabled':'')+' onclick="checklistMove('+args+',-1)">上移</button><button '+(index===length-1?'disabled':'')+' onclick="checklistMove('+args+',1)">下移</button></div></details>';
}
function checklistNumber(i){return i<20?String.fromCodePoint(0x2460+i):i<35?String.fromCodePoint(0x3251+i-20):i<50?String.fromCodePoint(0x32b1+i-35):'('+(i+1)+')';}
function checklistHome(){
  main.innerHTML=checklistTabs('checklist')+'<div class="section"><b>Checklist 資料庫</b></div>'+checklistLibrary().map((trade,t)=>'<section class="checklist-trade" data-checklist-trade="'+t+'"><h3>'+esc(trade.name)+'</h3>'+trade.nodes.map((node,n)=>'<section class="checklist-template-node" data-checklist-node="'+n+'"><div class="checklist-node-heading"><b>'+checklistNumber(n)+' '+esc(node.name)+'</b><span class="muted">'+node.items.length+'項</span>'+checklistControls(t,n,-1,n,trade.nodes.length)+'</div><div data-node-editor></div><div class="checklist-binding muted">對應工程節點：<button class="light" onclick="checklistTargetOpen('+t+','+n+',this)">'+esc(node.target?.nodeId?node.target.name:'未綁定')+'</button></div>'+node.items.map((item,i)=>'<div class="checklist-template-item" data-checklist-item="'+i+'"><span>'+esc(item.text)+'</span>'+checklistControls(t,n,i,i,node.items.length)+'</div>').join('')+'<div data-item-editor><button class="light" onclick="checklistQuickOpen('+t+','+n+')">＋ 新增一項</button></div></section>').join('')+'<div data-checklist-editor><button class="light" onclick="checklistQuickOpen('+t+')">＋ 新增節點</button></div></section>').join('');
}
// A missing index creates the next level; existing indices edit that record.
function checklistEdit(t,n,i){
  const trade=checklistLibrary()[t],node=trade?.nodes[n],item=node?.items[i];
  const level=item?'item':node?(i===-1?'item':'node'):trade?(n===-1?'node':'trade'):'trade';
  checklistOpenEditor(t,n,i,level,item?.text||'');
}
function checklistOpenEditor(t,n,i,level,value){
  if(level==='node'||level==='item'){checklistQuickOpen(t,n,i,level);return;}
  const trade=checklistLibrary()[t],node=trade?.nodes[n];
  if(level==='item')value=node?.items[i]?.text||'';
  if(level==='trade')value=trade?.name||'';
  if(level==='node')value=node?.name||'';
  const title={trade:'工種',node:'工程節點',item:'Checklist 項目'}[level];
  openModal('<h2>'+title+'</h2><label>'+title+'<input id="checklistValue" value="'+esc(value)+'" autofocus></label><div class="actions"><button class="light" onclick="closeModal()">取消</button><button onclick="checklistSaveEditor('+t+','+n+','+i+',\''+level+'\')">儲存</button></div>');
}
function checklistSaveEditor(t,n,i,level){
  const value=document.getElementById('checklistValue').value.trim();if(!value)return;
  const trades=checklistLibrary(),trade=trades[t],node=trade?.nodes[n];
  const list=level==='trade'?trades:level==='node'?trade?.nodes:node?.items;
  if(!list)return;
  const index=level==='trade'?t:level==='node'?n:i,key=level==='item'?'text':'name';
  if(level!=='item'&&list.some((entry,j)=>j!==index&&entry.name===value)){alert('名稱已存在。');return;}
  if(list[index])list[index][key]=value;
  else list.push({id:workflowId(),[key]:value,...(level==='trade'?{nodes:[]}:level==='node'?{items:[]}: {})});
  save();closeModal();checklistHome(level==='trade'?-1:t,n);
}
function checklistList(t,n,i){return i>=0?checklistLibrary()[t]?.nodes[n]?.items:n>=0?checklistLibrary()[t]?.nodes:checklistLibrary();}
function checklistMove(t,n,i,direction){
  const list=checklistList(t,n,i),index=i>=0?i:n>=0?n:t,next=index+direction;
  if(!list||index<0||next<0||next>=list.length)return;
  [list[index],list[next]]=[list[next],list[index]];save();checklistHome(n<0?-1:t,n);
}
function checklistDelete(t,n,i){
  const list=checklistList(t,n,i),index=i>=0?i:n>=0?n:t;
  if(!list?.[index]||!confirm('刪除此模板'+(i<0?'及其下所有項目':'')+'？已套用的工程紀錄會保留。'))return;
  list.splice(index,1);save();checklistHome(n<0?-1:t,n);
}
function checklistProjectNode(pid,kind,index){const project=data.projects.find(p=>String(p.id)===String(pid));return kind==='workflow'?project?.workflow?.nodes[index]:kind==='step'?project?.steps[index]:null;}
function checklistProgressButton(pid,kind,index,node){
  checklistAutoBind(pid,kind,index);
  const items=node.checklist||[];
  return '<details class="checklist-project" onclick="event.stopPropagation()"><summary>Checklist '+items.filter(item=>item.done).length+'/'+items.length+'</summary><div>'+(items.map((item,i)=>'<label class="workflow-check"><input type="checkbox" '+(item.done?'checked':'')+' '+(checklistCanToggle(pid,kind,index)?'':'disabled')+' onchange="checklistInlineToggle('+pid+',\''+kind+'\','+index+','+i+',this)">'+esc(item.text)+'</label>').join('')||'<span class="muted">尚無對應 Checklist。</span>')+'</div></details>';
}
function checklistTradeKey(name){return String(name||'').replace(/^\d+[.、\s]*/, '').replace(/工程$/, '').trim().replace(/^木作$/, '木工');}
function checklistMatchingTemplates(node){return checklistLibrary().flatMap((trade,t)=>trade.nodes.map((template,n)=>({trade,template,t,n})).filter(({template})=>template.target?.nodeId||checklistTradeKey(trade.name)===checklistTradeKey(node.trade)));}
function checklistCanToggle(pid,kind,index){
  const project=data.projects.find(p=>String(p.id)===String(pid)),node=checklistProjectNode(pid,kind,index);
  return !!node&&(kind!=='workflow'||typeof workflowStatus!=='function'||workflowStatus(project,node)!=='等待前置');
}
function openNodeChecklist(pid,kind,index){
  checklistAutoBind(pid,kind,index);
  const node=checklistProjectNode(pid,kind,index);if(!node)return;
  const canToggle=checklistCanToggle(pid,kind,index);
  const args=pid+',\''+kind+'\','+index,items=node.checklist||[],templates=checklistMatchingTemplates(node);
  openModal('<h2>'+esc(node.name)+'</h2><p class="muted">'+esc(node.trade)+' · Checklist '+items.filter(item=>item.done).length+'/'+items.length+'</p>'+(!canToggle?'<p class="muted">等待前置節點完成後即可勾選。</p>':'')+'<div class="checklist-records">'+(items.map((item,i)=>'<label class="workflow-check"><input type="checkbox" '+(item.done?'checked':'')+' '+(canToggle?'':'disabled')+' onchange="checklistToggle('+args+','+i+',this.checked)">'+esc(item.text)+'</label>').join('')||'<p class="muted">尚未綁定 Checklist。</p>')+'</div><label>綁定 Checklist 模板<select id="checklistTemplate"><option value="">選擇對應工程節點</option>'+templates.map(({template,t,n})=>'<option value="'+t+':'+n+'" '+((node.checklistBindings||[]).includes(template.id)||!template.items.length?'disabled':'')+'>'+esc(template.name)+'（'+template.items.length+' 項）'+((node.checklistBindings||[]).includes(template.id)?' · 已套用':'')+'</option>').join('')+'</select></label>'+(!templates.length?'<p class="muted">請先到「問題 → Checklist」新增此工種的節點模板。</p>':'')+'<p class="muted">套用時加入獨立副本，保留目前項目與勾選紀錄。勾選即儲存。</p><div class="actions"><button class="light" onclick="closeModal();openProject('+pid+')">完成</button><button onclick="checklistBindSelected('+args+')">套用模板</button></div>');
}
function checklistBindTemplate(pid,kind,index,t,n){
  const node=checklistProjectNode(pid,kind,index),trade=checklistLibrary()[t],template=trade?.nodes[n];
  if(!node||!template?.items.length||(template.target?!checklistTargetMatches(template.target,node,kind,pid):checklistTradeKey(node.trade)!==checklistTradeKey(trade.name)))return false;
  const bound=(node.checklistBindings||[]).includes(template.id);
  const previousItems=node.checklist,previousBindings=node.checklistBindings,previousSources=node.checklistTemplateItems;
  // Old snapshots lack item provenance. Keep their records and baseline IDs once.
  if(bound&&!node.checklistTemplateItems?.[template.id]){
    node.checklistTemplateItems={...node.checklistTemplateItems,[template.id]:template.items.map(item=>item.id)};
    try{save();}catch(error){node.checklistTemplateItems=previousSources;throw error;}return false;
  }
  const seen=node.checklistTemplateItems?.[template.id]||[],added=template.items.filter(item=>!seen.includes(item.id));
  if(!added.length)return false;
  node.checklist=(node.checklist||[]).concat(added.map(item=>({id:workflowId(),text:item.text,done:false})));
  node.checklistBindings=bound?node.checklistBindings:[...(node.checklistBindings||[]),template.id];
  node.checklistTemplateItems={...node.checklistTemplateItems,[template.id]:[...seen,...added.map(item=>item.id)]};
  try{save();}catch(error){node.checklist=previousItems;node.checklistBindings=previousBindings;node.checklistTemplateItems=previousSources;throw error;}return true;
}
function checklistBindSelected(pid,kind,index){
  const value=document.getElementById('checklistTemplate').value;if(!value)return;
  const [t,n]=value.split(':').map(Number);if(checklistBindTemplate(pid,kind,index,t,n)){openProject(pid);openNodeChecklist(pid,kind,index);}
}
function checklistToggle(pid,kind,index,i,checked){
  const node=checklistProjectNode(pid,kind,index);if(!node?.checklist?.[i]||!checklistCanToggle(pid,kind,index))return;
  node.checklist[i].done=!!checked;save();openProject(pid);openNodeChecklist(pid,kind,index);
}

// IDs survive project reordering and workflow copies; names are display labels only.
function checklistExistingTargets(tradeName){
  const found=new Map();let changed=false,customChanged=false;
  function add(node,kind,trade,project,custom){
    if(checklistTradeKey(node.trade||trade)!==checklistTradeKey(tradeName))return;
    if(!node.id){node.id=workflowId();changed=true;customChanged||=!!custom;}
    const ref={kind,nodeId:node.checklistSourceId||node.id,name:node.name,trade:node.trade||trade};
    if(project&&kind==='step'&&!node.checklistSourceId)ref.projectId=project.id;
    const key=JSON.stringify([kind,ref.projectId??'',ref.nodeId]);
    if(!found.has(key))found.set(key,{...ref,label:(project?project.name||'工程 '+project.id:'工種庫')+' ｜ '+node.name});
  }
  (data.trades||[]).forEach(trade=>(trade.workflow?.nodes||[]).forEach(node=>add(node,'workflow',trade.name)));
  (typeof libData==='undefined'?[]:libData).forEach(trade=>(trade.workflow?.nodes||[]).forEach(node=>add(node,'workflow',trade.name,null,true)));
  function addItems(trade,source){
    if(checklistTradeKey(trade.name)!==checklistTradeKey(tradeName))return;
    (trade.items||[]).forEach(item=>{
      const id=checklistSourceId(item,source);
      add({id,name:item[0]},'step',trade.name);
    });
  }
  (data.trades||[]).forEach(trade=>addItems(trade,'2022'));
  (typeof libData==='undefined'?[]:libData).forEach(trade=>addItems(trade,'custom'));
  (data.projects||[]).forEach(project=>{
    (project.workflow?.nodes||[]).forEach(node=>add(node,'workflow',node.trade,project));
    (project.steps||[]).forEach(node=>{checklistResolveSource(node);add(node,'step',node.trade,project);});
  });
  if(changed)save();if(customChanged&&typeof saveLib==='function')saveLib();
  return [...found.values()];
}
// Slot 10 is Checklist metadata; array properties would be lost in JSON backups.
function checklistSourceId(item,source){
  if(!item[10]?.checklistId){item[10]={...(item[10]||{}),checklistId:workflowId()};if(source==='custom'&&typeof saveLib==='function')saveLib();else save();}
  return item[10].checklistId;
}
function checklistResolveSource(node){
  if(node.checklistSourceId||!node.librarySource||!node.libraryTrade||!node.libraryItem)return;
  const trades=node.librarySource==='2022'?(data.trades||[]):(typeof libData==='undefined'?[]:libData);
  const matches=trades.filter(trade=>trade.name===node.libraryTrade).flatMap(trade=>(trade.items||[]).filter(item=>item[0]===node.libraryItem));
  // One-time migration using explicit legacy provenance, never guess ambiguous names.
  if(matches.length===1){node.checklistSourceId=checklistSourceId(matches[0],node.librarySource);save();}
}
function checklistTargetOpen(t,n,button){
  const node=checklistLibrary()[t].nodes[n],targets=checklistExistingTargets(checklistLibrary()[t].name);
  const select=document.createElement('select');select.setAttribute('aria-label','對應工程節點');
  select.innerHTML='<option value="">'+(targets.length?'選擇工程節點':'目前沒有工程節點')+'</option>'+targets.map((ref,i)=>'<option value="'+i+'" '+(node.target?.nodeId===ref.nodeId&&node.target?.projectId===ref.projectId?'selected':'')+'>'+esc(ref.label)+'</option>').join('');
  select.onchange=()=>{const previous=node.target;node.target=select.value===''?null:{...targets[Number(select.value)]};try{save();}catch(error){node.target=previous;alert('尚未儲存：'+error.message);return;}checklistHome();};
  button.replaceWith(select);select.focus();
}
function checklistQuickOpen(t,n=-1,i=-1,level){
  level=level||(n<0?'node':'item');
  const trade=checklistLibrary()[t],node=trade?.nodes[n];if(!trade)return;
  const root=main.querySelector('[data-checklist-trade="'+t+'"]');if(!root)return;
  const nodeRoot=n>=0?root.querySelector('[data-checklist-node="'+n+'"]'):null;
  const editing=level==='item'?i>=0:n>=0;
  const host=level==='item'?(editing?nodeRoot.querySelector('[data-checklist-item="'+i+'"]'):nodeRoot.querySelector('[data-item-editor]')):editing?nodeRoot.querySelector('[data-node-editor]'):root.querySelector('[data-checklist-editor]');
  const value=editing?(level==='item'?node.items[i].text:node.name):'';
  host.innerHTML='<form class="checklist-inline"><span>＋</span><input aria-label="'+(level==='item'?'Checklist 項目':'節點名稱')+'" placeholder="'+(level==='item'?'輸入 Checklist 項目…':'輸入節點名稱…')+'" value="'+esc(value)+'" enterkeyhint="done"><button type="submit" class="light" aria-label="儲存">✓</button><button type="button" class="light" aria-label="取消" onclick="checklistHome()">×</button><small role="status"></small></form>';
  const form=host.querySelector('form'),input=form.querySelector('input');let composing=false;
  input.addEventListener('compositionstart',()=>composing=true);input.addEventListener('compositionend',()=>composing=false);
  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.isComposing||event.keyCode===229))event.preventDefault();if(event.key==='Escape')checklistHome();});
  form.onsubmit=event=>{
    event.preventDefault();if(composing)return;
    const text=input.value.trim();if(!text)return;
    const list=level==='item'?node.items:trade.nodes,index=level==='item'?i:n,key=level==='item'?'text':'name';
    if(level==='node'&&list.some((entry,j)=>j!==index&&entry.name===text)){form.querySelector('small').textContent='名稱已存在。';return;}
    const previous=editing?list[index][key]:null;
    if(editing)list[index][key]=text;else list.push({id:workflowId(),[key]:text,...(level==='node'?{items:[]}: {})});
    try{save();}catch(error){if(editing)list[index][key]=previous;else list.pop();form.querySelector('small').textContent='尚未儲存：'+error.message;return;}
    checklistHome();if(!editing)checklistQuickOpen(t,n);
  };
  input.focus();
}
function checklistTargetMatches(target,node,kind,pid){return !!target?.nodeId&&target.kind===kind&&target.nodeId===(node.checklistSourceId||node.id)&&(target.projectId==null||String(target.projectId)===String(pid));}
function checklistAutoBind(pid,kind,index){
  const node=checklistProjectNode(pid,kind,index);if(!node)return;
  if(kind==='step')checklistResolveSource(node);
  checklistMatchingTemplates(node).forEach(({template,t,n})=>{if(checklistTargetMatches(template.target,node,kind,pid))checklistBindTemplate(pid,kind,index,t,n);});
}
function checklistInlineToggle(pid,kind,index,i,input){
  const node=checklistProjectNode(pid,kind,index);if(!node?.checklist?.[i]||!checklistCanToggle(pid,kind,index))return;
  const item=node.checklist[i],previous=item.done;item.done=!!input.checked;
  try{save();}catch(error){item.done=previous;input.checked=previous;alert('勾選尚未儲存：'+error.message);return;}
  input.closest('details').querySelector('summary').textContent='Checklist '+node.checklist.filter(item=>item.done).length+'/'+node.checklist.length;
}
