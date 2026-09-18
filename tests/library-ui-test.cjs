// Isolated fixtures only: no user storage, database or network.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const legacy=['防水',['養護時間'],'next','2026-09-17','2026-09-18',{},[{id:'check1',text:'試水',done:true},{id:'check2',text:'清潔'}]];
legacy[10]={checklistId:'source1',photos:[{id:'p1',data:'data:image/png;base64,AA',note:'old'}]};
const custom=['插座',['注意管線'],'',null,null,null,[{id:'c1',text:'高度',done:true},{id:'c2',text:'位置'}]];
const project={id:'project1',steps:[{id:'node1',checklist:[{id:'pcheck',text:'高度',done:true}]}]};
const elements={libraryGroupList:{innerHTML:''},libraryItemName:{value:''},libraryItemTrade:{value:'0'}};
let answer='',saved='',writes=0,notices=0;
const c=vm.createContext({console,window:{},data:{trades:[{name:'泥作',items:[legacy]}],projects:[project]},libData:[{name:'水電',items:[custom,['燈具',[]]]},{name:'木作',items:[]}],LIBKEY:'test',
  localStorage:{setItem(key,value){saved=value;writes++;}},save(){writes++;},
  main:{innerHTML:''},document:{getElementById:id=>elements[id]},nav(){},esc:x=>String(x??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;'),
  prompt:()=>answer,confirm:()=>true,alert(){notices++;},openModal(){},closeModal(){}});
for(const file of ['photos','trades','schedule'])vm.runInContext(fs.readFileSync('js/'+file+'.js','utf8'),c);
const original=JSON.stringify(c.data),legacySchedule=JSON.stringify(c.scheduleItems());
c.library();
assert.match(elements.libraryGroupList.innerHTML,/泥作/);
assert.match(elements.libraryGroupList.innerHTML,/防水/);
assert.match(elements.libraryGroupList.innerHTML,/<details /);
c.renderLibraryGroups('插座');
assert.match(elements.libraryGroupList.innerHTML,/水電/);assert.doesNotMatch(elements.libraryGroupList.innerHTML,/泥作/);
c.renderLibraryGroups('泥作');assert.match(elements.libraryGroupList.innerHTML,/防水/);
c.renderLibraryGroups('不存在');assert.match(elements.libraryGroupList.innerHTML,/找不到/);
c.exampleLibraryItemDetail(0,0);
assert.match(c.main.innerHTML,/工程 Checklist/);assert.doesNotMatch(c.main.innerHTML,/onchange="toggleLibraryCheck|type="checkbox"/);
assert.equal(JSON.stringify(c.data),original,'viewing library must not write template completion or project data');
answer='新版高度';c.libraryContentAction('custom',0,0,'check',0,'edit');
assert.equal(custom[6][0].text,answer);assert.equal(custom[6][0].id,'c1');assert.equal(custom[6][0].done,true);
c.libraryContentAction('custom',0,0,'check',0,'down');assert.equal(custom[6][1].id,'c1');
assert.equal(JSON.parse(saved)[0].items[0][6][1].id,'c1');
c.libraryContentAction('custom',0,0,'check',0,'delete');assert.equal(custom[6].length,1);
const event=text=>({preventDefault(){},currentTarget:{elements:{text:{value:text}}}});
c.addLibraryContent(event('補充'), 'custom',0,0,'note');assert.equal(custom[1][1],'補充');
answer='修改筆記';c.libraryContentAction('custom',0,0,'note',1,'edit');assert.equal(custom[1][1],answer);
c.libraryContentAction('custom',0,0,'note',1,'delete');assert.equal(custom[1].length,1);
c.moveLibrarySourceItem('custom',0,0,1);assert.equal(c.libData[0].items[1],custom);
elements.libraryItemName.value='新插座';elements.libraryItemTrade.value='1';c.saveLibrarySourceItem(0,1);
assert.equal(c.libData[1].items[0],custom);assert.equal(custom[0],'新插座');assert.equal(custom[6][0].id,'c1');
answer='新說明';c.editLibraryItemPhoto('2022',0,0,0);assert.equal(legacy[10].photos[0].note,answer);assert.equal(legacy[10].photos[0].id,'p1');
c.editLibrarySourceItem('2022',0,0);c.deleteLibrarySourceItem('2022',0,0);c.moveLibrarySourceItem('2022',0,0,1);
assert.equal(notices,3,'shared schedule edits must wait for the metadata decision');
assert.equal(JSON.stringify(c.scheduleItems()),legacySchedule,'schedule fields and order unchanged');
assert.equal(JSON.stringify(c.data.projects),JSON.stringify([project]));
assert.ok(writes>0);
console.log('PASS library search/render, template isolation, custom item edit/move, checklist and note CRUD/order, photo caption/ID, persistence and shared-schedule safeguards');
