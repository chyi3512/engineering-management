// Run with Node. All data and persistence are isolated in a VM.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
let serial=0,saved='',modal='',input={value:''};
const context=vm.createContext({
  data:{projects:[],issues:[{title:'existing issue'}]},main:{innerHTML:''},
  workflowId:()=>String(++serial),esc:s=>String(s||'').replaceAll('<','&lt;'),
  document:{getElementById:()=>input},openModal:html=>modal=html,
  closeModal(){},openProject(){},confirm:()=>true,alert(){},
  save:()=>{saved=JSON.stringify(context.data);}
});
vm.runInContext(fs.readFileSync(path.join(root,'js/checklists.js'),'utf8'),context);
const c=context;
assert.equal(c.checklistLibrary().length,5);
function edit(t,n,i,level,value){input.value=value;c.checklistSaveEditor(t,n,i,level);}
edit(0,-1,-1,'node','配管');
edit(0,0,-1,'item','確認高度');edit(0,0,-1,'item','確認尺寸');
const quickOpen=c.checklistQuickOpen;let quickArgs;
c.checklistQuickOpen=(...args)=>quickArgs=args;
c.checklistOpenEditor(0,0,0,'item');assert.deepEqual(quickArgs,[0,0,0,'item']);
c.checklistOpenEditor(0,0,-1,'node');assert.deepEqual(quickArgs,[0,0,-1,'node']);
c.checklistQuickOpen=quickOpen;
c.checklistOpenEditor(0,-1,-1,'trade');assert.ok(modal.includes('水電'));
edit(0,0,0,'item','現場確認高度');
c.checklistMove(0,0,1,-1);assert.equal(c.data.checklistLibrary[0].nodes[0].items[0].text,'確認尺寸');
c.checklistMove(0,0,0,-1);assert.equal(c.data.checklistLibrary[0].nodes[0].items.length,2);
edit(0,-1,-1,'node','驗收');c.checklistMove(0,1,-1,-1);
assert.equal(c.data.checklistLibrary[0].nodes[0].name,'驗收');
c.checklistMove(0,0,-1,1);
const node=()=>({name:'配管',trade:'水電',checklist:[{id:'old',text:'原有項目',done:true}]});
c.data.projects=[{id:1,workflow:{nodes:[node()]},steps:[node()]},{id:2,workflow:{nodes:[node()]},steps:[node()]}];
assert.equal(c.checklistBindTemplate(1,'workflow',0,0,0),true);
assert.equal(c.checklistBindTemplate(2,'workflow',0,0,0),true);
assert.equal(c.checklistBindTemplate(1,'step',0,0,0),true);
assert.equal(c.checklistBindTemplate(1,'workflow',0,0,0),false);
const a=c.data.projects[0].workflow.nodes[0],b=c.data.projects[1].workflow.nodes[0];
assert.equal(a.checklist.length,3);assert.equal(a.checklist[0].done,true);
c.checklistToggle(1,'workflow',0,1,true);
assert.equal(b.checklist[1].done,false);
assert.equal(c.data.projects[0].steps[0].checklist[1].done,false);
assert.equal(c.data.checklistLibrary[0].nodes[0].items[0].done,undefined);
assert.ok(c.checklistProgressButton(1,'workflow',0,a).includes('Checklist 2/3'));
c.workflowStatus=()=> '等待前置';
c.checklistToggle(1,'workflow',0,2,true);
assert.equal(a.checklist[2].done,false);
c.openNodeChecklist(1,'workflow',0);assert.ok(modal.includes('disabled onchange'));
delete c.workflowStatus;
// Records travel with their node when actual project steps are reordered.
c.data.projects[0].steps.push({name:'其他',trade:'油漆'});
c.data.projects[0].steps.reverse();
assert.equal(c.checklistProjectNode(1,'step',1).checklist.length,3);
assert.equal(c.checklistBindTemplate(1,'step',0,0,0),false);
edit(0,0,0,'item','修改模板不回寫工程');
assert.equal(a.checklist[1].text,'確認尺寸');
c.checklistDelete(0,0,0);c.checklistDelete(0,0,-1);c.checklistDelete(0,-1,-1);
assert.equal(a.checklist.length,3);assert.equal(b.checklist.length,3);
assert.equal(c.data.issues[0].title,'existing issue');
c.data=JSON.parse(saved);
assert.equal(c.data.projects[0].workflow.nodes[0].checklist[1].done,true);
assert.equal(c.data.projects[1].workflow.nodes[0].checklist[1].done,false);
assert.equal(c.data.projects[0].workflow.nodes[0].checklistBindings.length,1);
assert.equal(c.checklistTradeKey('木作工程'),'木工');
c.checklistHome();assert.ok(c.main.innerHTML.includes('問題追蹤'));
// Verify integration hooks remain present, without running production storage.
assert.ok(fs.readFileSync(path.join(root,'js/app.js'),'utf8').includes("checklistTabs('issues')"));
assert.ok(fs.readFileSync(path.join(root,'js/workflow.js'),'utf8').includes("checklistProgressButton(project.id,'workflow',index,node)"));
assert.ok(fs.readFileSync(path.join(root,'js/projects.js'),'utf8').includes("checklistProgressButton(id,'step',i,x)"));
for(const name of ['checklists','app','projects','workflow'])new vm.Script(fs.readFileSync(path.join(root,'js',name+'.js'),'utf8'));
console.log('PASS: template CRUD/order, edit values, binding, duplicate protection, project/node isolation, template deletion safety, persistence, progress and UI hooks.');


// Stable ID binding: duplicate names must not cross-bind; project copies stay independent.
c.data={trades:[{name:'水電',items:[['配管']],workflow:{nodes:[{id:'pipe',name:'配管',trade:'水電'},{id:'other',name:'配管',trade:'水電'}]}}],projects:[{id:1,workflow:{nodes:[{id:'pipe',name:'配管',trade:'水電'}]},steps:[]},{id:2,workflow:{nodes:[{id:'pipe',name:'配管',trade:'水電'}]},steps:[]}],checklistLibrary:[{id:'trade',name:'水電',nodes:[{id:'template',name:'配管完成',target:{kind:'workflow',nodeId:'pipe',name:'配管'},items:[{id:'one',text:'試壓'},{id:'two',text:'通水'}]}]}]};
const targets=c.checklistExistingTargets('水電');
assert.equal(targets.filter(t=>t.kind==='workflow').length,2);
assert.ok(targets.every(t=>t.nodeId));
assert.equal(c.checklistTargetMatches(c.data.checklistLibrary[0].nodes[0].target,{id:'other',name:'配管'},'workflow'),false);
assert.equal(c.checklistTargetMatches({kind:'workflow',name:'配管'},{id:'pipe',name:'配管'},'workflow'),false);
const first=c.data.projects[0].workflow.nodes[0],second=c.data.projects[1].workflow.nodes[0];
first.name='重新命名';
assert.ok(c.checklistProgressButton(1,'workflow',0,first).includes('Checklist 0/2'));
assert.ok(c.checklistProgressButton(2,'workflow',0,second).includes('Checklist 0/2'));
const summary={textContent:''};
c.checklistInlineToggle(1,'workflow',0,0,{checked:true,closest:()=>({querySelector:()=>summary})});
assert.equal(summary.textContent,'Checklist 1/2');assert.equal(second.checklist[0].done,false);
c.checklistAutoBind(1,'workflow',0);assert.equal(first.checklist.length,2);
c.data=JSON.parse(saved);assert.equal(c.data.projects[0].workflow.nodes[0].checklist[0].done,true);
assert.equal(c.data.projects[1].workflow.nodes[0].checklist[0].done,false);
const source=c.checklistExistingTargets('水電').find(t=>t.kind==='step');
c.data.checklistLibrary[0].nodes[0].target=source;
c.data.projects.forEach(p=>p.steps=[{trade:'水電',name:'配管',libraryTrade:'水電',libraryItem:'配管',librarySource:'2022'}]);
c.checklistAutoBind(1,'step',0);c.checklistAutoBind(2,'step',0);
assert.equal(c.data.projects[0].steps[0].checklist.length,2);
assert.equal(c.data.projects[1].steps[0].checklist.length,2);
c.data.trades[0].items[0][0]='工種庫已改名';c.data.projects[0].steps[0].name='工程已改名';
c.checklistAutoBind(1,'step',0);assert.equal(c.data.projects[0].steps[0].checklist.length,2);
assert.equal(c.data.projects[0].steps[0].checklistSourceId,source.nodeId);
c.data.projects[0].steps.push({id:'different',name:'工程已改名',trade:'水電'});
c.checklistAutoBind(1,'step',1);assert.equal(c.data.projects[0].steps[1].checklist,undefined);
const before=first.checklist[0].done;c.save=()=>{throw Error('storage full');};
const toggle={checked:false,closest:()=>({querySelector:()=>summary})};
c.checklistInlineToggle(1,'workflow',0,0,toggle);assert.equal(toggle.checked,true);
c.checklistHome();assert.ok(c.main.innerHTML.includes('①'));assert.ok(c.main.innerHTML.includes('checklist-menu'));
assert.equal(c.checklistNumber(20),'㉑');assert.equal(c.checklistNumber(35),'㊱');
console.log('PASS: ID binding, same-name isolation, rename stability, legacy source migration, independent reload, save rollback.');
