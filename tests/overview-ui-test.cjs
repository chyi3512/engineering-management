// Isolated render/storage regression: never accesses user data or cloud.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let serial=0,modalCalls=0,saves=0;
const project={id:1,name:'test',steps:[{id:'step1',name:'放樣',trade:'木作',checklist:[{id:'c',label:'位置確認',checked:true}]}],siteDays:{},siteAppointments:[],nextSiteConfirmation:{checks:[{id:'old',text:'保留歷史',done:true}]}};
const c=vm.createContext({console,data:{projects:[project]},window:{addEventListener(){}},document:{addEventListener(){}},setInterval(){},main:{querySelectorAll(){return []}},
  localDateISO:()=> '2026-09-18',esc:x=>String(x??''),fmtDate:x=>x,dailyOptions:()=>'',dailyReportId:()=>String(++serial),dailyProject:()=>project,
  save(){saves++},openModal(){modalCalls++},openProject(){},prepareDailyPhoto:async f=>f,persistDailyPhotos:async()=>{},removeDailyPhotoFiles:async()=>{},
  projectSitePending:0});
vm.runInContext(fs.readFileSync('js/projects.js','utf8'),c);
vm.runInContext(fs.readFileSync('js/project-site.js','utf8'),c);
const before=JSON.stringify(project);
const html=c.projectDailyOverviewHTML(project,'2026-09-18');
for(const title of ['今天施工','現場確認','工程照片'])assert.ok(!html.includes('<b>'+title+'</b>'),title);
assert.ok(html.includes('現場紀錄')&&html.includes('data-site-action="generate"'));
assert.equal(JSON.stringify(project),before,'render does not mutate data');
const photoHTML=c.projectNodePhotosHTML(Array.from({length:5},(_,i)=>({day:{date:'2026-09-18'},photo:{id:String(i),description:'note'}})));
assert.equal((photoHTML.match(/data-step-photo=/g)||[]).length,5,'no three-photo truncation');
assert.ok(photoHTML.includes('node-photo-grid')&&photoHTML.includes('data-site-caption'));
const appointments=c.projectSiteAppointmentsHTML({siteAppointments:[{id:'a',date:'2026-09-18',text:'磁磚發包',category:'廠商'}]},true);
assert.ok(/<details[^>]*>[\s\S]*edit-appointment[\s\S]*remove-appointment[\s\S]*<\/details>/.test(appointments));
const root={dataset:{siteStepIndex:'0'},querySelectorAll(){return []},isConnected:false};
c.openProject=()=>{};
(async()=>{
  await c.openProjectSitePhotoUpload(project,'2026-09-18',[{name:'one.jpg'},{name:'two.jpg'}],'',root);
  assert.equal(modalCalls,0,'quick upload must not open a modal');
  assert.equal(project.siteDays['2026-09-18'].photos.length,2);
  assert.equal(project.steps[0].projectPhotos.length,2);
  assert.equal(project.siteDays['2026-09-18'].photos[0].stepId,'step1');
  assert.equal(project.siteDays['2026-09-18'].photos[0].description,'');
  assert.equal(c.projectStepPhotos(project,0).length,2);
  const photo=project.siteDays['2026-09-18'].photos[0];
  c.projectSiteWriteDay(project,'2026-09-18',day=>day.photos.find(p=>p.id===photo.id).description='放樣完成');
  const reloaded=JSON.parse(JSON.stringify(project));
  assert.equal(reloaded.siteDays['2026-09-18'].photos[0].description,'放樣完成');
  assert.equal(reloaded.nextSiteConfirmation.checks[0].id,'old');
  assert.ok(saves>=3);
  console.log('PASS overview duplicate sections, non-mutating render, complete photo grid, action menus, direct multi-upload without modal, original step association, caption persistence and historical data');
})().catch(error=>{console.error(error);process.exitCode=1;});
