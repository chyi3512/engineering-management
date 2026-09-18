// Exercises the actual delegated submit handler without touching user storage.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let saved='',serial=0;
const project={id:1,siteAppointments:[],siteDays:{}},listeners={},list={innerHTML:''};
const root={dataset:{siteProject:'1',siteDate:'2026-09-17',siteOverviewRecords:'true'},
  addEventListener(type,handler){listeners[type]=handler;},querySelectorAll(){return [];},
  querySelector(selector){return selector==='[data-site-appointments]'?list:null;}};
const c=vm.createContext({console,window:{addEventListener(){}},document:{addEventListener(){}},setInterval(){},
  main:{querySelectorAll:()=>[root]},localDateISO:()=> '2026-09-18',dailyReportId:()=>String(++serial),dailyProject:()=>project,
  esc:x=>String(x??''),fmtDate:x=>x,dailyOptions:()=>'',isCompleteScheduleDate:x=>/^\d{4}-\d{2}-\d{2}$/.test(x),
  save(){saved=JSON.stringify(project);},loadDailyPhotoImages(){},openProject(){},data:{projects:[project]}});
vm.runInContext(fs.readFileSync('js/project-site.js','utf8'),c);
c.projectSiteConfirmationAccordion=()=>{};c.projectSiteNotesAccordion=()=>{};
c.bindProjectSite(project);
function form(selector,values,kind){
  return {hidden:false,dataset:{recordKind:kind},elements:Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{value}])),
    matches:s=>s===selector,reportValidity:()=>true,reset(){for(const input of Object.values(this.elements))input.value='';}};
}
const coordination=form('[data-site-appointment-form]',{category:'業主',text:'確認浴室磁磚顏色',date:'2026-09-18',status:'待確認'});
c.refreshProjectSite(project);assert.match(list.innerHTML,/尚無待確認/);
listeners.submit({target:coordination,preventDefault(){}});
assert.equal(project.siteAppointments.length,1,'actual handler saves one original record');
assert.equal(project.siteAppointments[0].category,'業主');
assert.match(list.innerHTML,/確認浴室磁磚顏色/,'future due date must not hide an unfinished coordination item');
assert.doesNotMatch(list.innerHTML,/尚無待確認/);
assert.equal(coordination.hidden,true,'successful submit closes the form');
assert.equal(coordination.elements.date.value,'2026-09-17','reset date follows selected page date');
const failed=form('[data-site-appointment-form]',{category:'業主',text:'不可遺失的草稿',date:'2026-09-18',status:'待確認'});
const saveOK=c.save;c.save=()=>{throw Error('storage full');};
listeners.submit({target:failed,preventDefault(){}});
assert.equal(project.siteAppointments.length,1,'failed save rolls back the original source');
assert.equal(failed.hidden,false,'failed save keeps form open');
assert.equal(failed.elements.text.value,'不可遺失的草稿');
c.save=saveOK;
const reloaded=JSON.parse(saved);
assert.match(c.projectDailyOverviewHTML(reloaded,'2026-09-17'),/確認浴室磁磚顏色/,'reload uses same saved source and filter');
for(const kind of ['處理','待辦']){
  const entry=form('[data-daily-record-form]',{text:kind+' test',due:'2026-09-19'},kind);
  listeners.submit({target:entry,preventDefault(){}});
  assert.ok(project.siteDays['2026-09-17'].records.some(record=>record.kind===kind&&record.text===kind+' test'));
}
project.siteAppointments[0].done=true;project.siteAppointments[0].completedAt='2026-09-17';
c.refreshProjectSite(project);assert.match(list.innerHTML,/確認浴室磁磚顏色/,'completion remains on selected completion date');
root.dataset.siteDate='2026-09-19';c.refreshProjectSite(project);assert.match(list.innerHTML,/尚無待確認/);
console.log('PASS actual coordination submit, immediate display, reload, empty state, selected date, handling/todo add and completed date filtering');
