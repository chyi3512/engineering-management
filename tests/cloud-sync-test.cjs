const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/cloud-sync.js'),'utf8');
const copy=x=>JSON.parse(JSON.stringify(x));
const payload=(name='local')=>({version:1,construction:{trades:[],projects:[{id:123,name,steps:[],baselineSchedule:[],workflow:{nodes:[]},siteDays:{}}],issues:[],dailyReports:[],checklistLibrary:[]},library:[],quotes:{items:[],vendors:[]},equipmentQuotes:{items:[{id:'equipment',quotes:[{unitPrice:5,qty:2,total:10}]}],vendors:[]}});
const owner='11111111-1111-4111-8111-111111111111';
const auth={access_token:'access',refresh_token:'refresh',expires_at:9999999999,user:{id:owner,email:'test@example.test'}};
const keys=['construction_v2','engineering_library_v1','quote_management_v1','equipment_quotes_v1'];
function fixture({local=payload(),row=null,store=new Map(),failure='',signedIn=true}={}){
  let writes=0,remote=copy(row),mode=failure;
  if(signedIn&&!store.has('buildflow_cloud_session_v1'))store.set('buildflow_cloud_session_v1',JSON.stringify(auth));
  const state={textContent:''},modal={style:{display:''}};
  const c={data:copy(local.construction),libData:copy(local.library),quoteData:copy(local.quotes),equipmentQuoteData:copy(local.equipmentQuotes),crypto:crypto.webcrypto,TextEncoder,URL,AbortController,Date,JSON,console,
    setTimeout:()=>1,clearTimeout(){},initializeProjectSchedules(){},home(){},
    document:{baseURI:'https://buildflow.test/',activeElement:null,addEventListener(){},getElementById:id=>id==='buildflowCloudStatus'?state:id==='modal'?modal:null},addEventListener(){}};
  c.window=c;
  const backups=new Map();
  c.indexedDB={open(){const request={};queueMicrotask(()=>{request.result={close(){},transaction(){const tx={};tx.objectStore=()=>({get(key){const r={};queueMicrotask(()=>{r.result=backups.get(key);r.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.());});return r;},put(value,key){backups.set(key,copy(value));queueMicrotask(()=>tx.oncomplete?.());}});return tx;}};request.onsuccess();});return request;}};
  c.localStorage={getItem:k=>store.get(k)??null,setItem(k,v){store.set(k,String(v));c.buildFlowCloudChanged?.(k);},removeItem:k=>store.delete(k)};
  keys.forEach((k,i)=>store.set(k,JSON.stringify([local.construction,local.library,local.quotes,local.equipmentQuotes][i])));
  c.fetch=async(url,options={})=>{
    url=String(url);
    if(url.endsWith('api/cloud-config'))return {ok:true,json:async()=>({url:'https://fixture.supabase.co',key:'sb_publishable_test'})};
    if(mode==='offline')throw Error('offline');
    if(mode==='missing')return {ok:false,json:async()=>({code:'PGRST205',message:'table missing'})};
    if(url.includes('/auth/v1/token'))return {ok:true,json:async()=>({...auth,expires_in:3600})};
    if(url.includes('/rpc/')){
      const body=JSON.parse(options.body);
      if(mode==='race'||(remote?body.p_expected_revision!==remote.revision:body.p_expected_revision!==null))return {ok:false,json:async()=>({message:'BF_REVISION_CONFLICT'})};
      remote={payload:body.p_payload,revision:(remote?.revision||0)+1};writes++;
      if(mode==='lost')throw Error('receipt lost');
      return {ok:true,json:async()=>remote.revision};
    }
    return {ok:true,json:async()=>remote?[copy(remote)]:[]};
  };
  vm.createContext(c);vm.runInContext(source,c);
  return {c,store,state,backups,get row(){return remote;},get writes(){return writes;},mode:value=>mode=value,remote:value=>remote=copy(value),change(name){c.data.projects[0].name=name;c.localStorage.setItem(keys[0],JSON.stringify(c.data));}};
}
(async()=>{
  let f=fixture();await f.c.buildFlowCloud.initialize();assert.equal(f.row.payload.construction.projects[0].name,'local');assert.equal(f.writes,1);assert.equal(f.row.payload.equipmentQuotes.items[0].quotes[0].total,10);assert.ok(f.backups.has('initial:'+owner));
  console.log('PASS empty cloud uploads all four datasets and preserves initial local snapshot');
  f.change('edited');await f.c.buildFlowCloud.sync();assert.equal(f.row.payload.construction.projects[0].name,'edited');assert.equal(f.row.revision,2);
  console.log('PASS successful local saves upload snapshot');
  let phone=fixture({local:payload('phone-local'),row:f.row});await phone.c.buildFlowCloud.initialize();assert.equal(phone.c.data.projects[0].name,'edited');assert.equal(phone.writes,0);assert.equal(phone.backups.get('initial:'+owner).payload.construction.projects[0].name,'phone-local');
  console.log('PASS second device downloads cloud and preserves its previous local data');
  phone.mode('offline');phone.change('offline-edit');await phone.c.buildFlowCloud.sync();assert.match(phone.state.textContent,/同步失敗/);assert.equal(phone.c.data.projects[0].name,'offline-edit');
  const reloaded=fixture({local:{...payload(),construction:copy(phone.c.data)},row:phone.row,store:phone.store});await reloaded.c.buildFlowCloud.initialize();assert.equal(reloaded.row.payload.construction.projects[0].name,'offline-edit');
  console.log('PASS offline edit survives restart and uploads when connection returns');
  reloaded.change('stale-local');reloaded.remote({payload:payload('new-remote'),revision:20});await reloaded.c.buildFlowCloud.sync();assert.equal(reloaded.c.data.projects[0].name,'stale-local');assert.equal(reloaded.row.payload.construction.projects[0].name,'new-remote');assert.match(reloaded.state.textContent,/同步失敗/);
  console.log('PASS stale device cannot overwrite newer remote snapshot');
  f=fixture({failure:'missing'});await f.c.buildFlowCloud.initialize();assert.equal(f.c.data.projects[0].name,'local');assert.match(f.state.textContent,/SQL/);assert.equal(f.writes,0);
  console.log('PASS missing SQL/table retains local data with setup error');
  f=fixture({row:{payload:{version:1},revision:1}});await f.c.buildFlowCloud.initialize();assert.equal(f.c.data.projects[0].name,'local');assert.match(f.state.textContent,/格式/);
  console.log('PASS invalid remote payload is rejected');
  f=fixture({failure:'lost'});await f.c.buildFlowCloud.initialize();f.mode('');await f.c.buildFlowCloud.sync();assert.equal(f.writes,1);assert.match(f.state.textContent,/已同步/);
  console.log('PASS lost upload response retries without duplicate overwrite');
  f=fixture({failure:'race'});await f.c.buildFlowCloud.initialize();assert.equal(f.writes,0);assert.match(f.state.textContent,/停止覆蓋/);
  console.log('PASS atomic initial-insert race is surfaced without data loss');
  f=fixture();await f.c.buildFlowCloud.initialize();f.remote({payload:{...payload(),construction:{trades:[],projects:[],issues:[]}},revision:2});await f.c.buildFlowCloud.sync();assert.equal(f.c.data.projects.length,0);assert.equal(f.c.buildFlowCloud.authoritative,true);
  console.log('PASS existing intentionally empty cloud snapshot is authoritative');
  const localPhotos=payload();localPhotos.construction.projects[0].siteDays={'2026-09-10':{photos:[{id:'p',storage:'indexeddb'}]}};localPhotos.library=[{photos:[{id:'base64',data:'data:image/png;base64,AAAA'},{id:'drive',data:'https://drive.google.com/example',storage:'google-drive'}]}];
  f=fixture({local:localPhotos});await f.c.buildFlowCloud.initialize();assert.deepEqual(f.row.payload,localPhotos);
  console.log('PASS existing photo references/Base64 remain unchanged; no Storage/photo-DB operations');
  f=fixture({signedIn:false});await f.c.buildFlowCloud.initialize();assert.equal(f.writes,0);assert.match(f.state.textContent,/尚未登入/);
  console.log('PASS signed-out local fallback');
  f=fixture();await f.c.buildFlowCloud.initialize();
  const originalFetch=f.c.fetch;let duringUpload=true;
  f.c.fetch=async(url,options)=>{const response=await originalFetch(url,options);if(String(url).includes('/rpc/')&&duringUpload){duringUpload=false;f.change('saved-during-upload');}return response;};
  f.change('first-edit');await f.c.buildFlowCloud.sync();assert.equal(f.row.payload.construction.projects[0].name,'first-edit');assert.equal(JSON.parse(f.store.get('buildflow_cloud_meta_v1')).dirty,true);await f.c.buildFlowCloud.sync();assert.equal(f.row.payload.construction.projects[0].name,'saved-during-upload');
  console.log('PASS edits during upload remain pending and upload next');
  f=fixture();await f.c.buildFlowCloud.initialize();const oldPage=payload('old-page-save');const restarted=fixture({local:oldPage,row:f.row,store:f.store});await restarted.c.buildFlowCloud.initialize();assert.equal(restarted.row.payload.construction.projects[0].name,'old-page-save');
  console.log('PASS old-page/restore changes detected from content fingerprint on startup');
  f=fixture({row:{payload:payload('remote'),revision:1}});const originalSet=f.c.localStorage.setItem;
  f.c.localStorage.setItem=(k,v)=>{if(k==='engineering_library_v1'&&JSON.parse(f.store.get('construction_v2')).projects[0].name==='remote')throw Error('QuotaExceededError');originalSet(k,v);};
  await f.c.buildFlowCloud.initialize();assert.equal(f.c.data.projects[0].name,'local');assert.equal(JSON.parse(f.store.get('construction_v2')).projects[0].name,'local');assert.match(f.state.textContent,/同步失敗/);
  console.log('PASS partial cache write failure rolls back original memory and storage');
  f=fixture({row:{payload:payload('remote'),revision:1}});f.c.indexedDB.open=()=>{const request={error:Error('backup blocked')};queueMicrotask(()=>request.onerror());return request;};await f.c.buildFlowCloud.initialize();assert.equal(f.c.data.projects[0].name,'local');assert.match(f.state.textContent,/backup blocked/);
  console.log('PASS failed local safety backup prevents cloud replacement');
  const expired=new Map([['buildflow_cloud_session_v1',JSON.stringify({...auth,expires_at:0})]]);f=fixture({store:expired});await f.c.buildFlowCloud.initialize();assert.equal(f.writes,1);assert.ok(JSON.parse(f.store.get('buildflow_cloud_session_v1')).expires_at>Date.now()/1000);
  console.log('PASS expired access token refreshed before snapshot access');
  const differentServer=new Map([['buildflow_cloud_meta_v1',JSON.stringify({owner,server:'https://another.supabase.co',dirty:true})]]);f=fixture({store:differentServer});await f.c.buildFlowCloud.initialize();await f.c.buildFlowCloud.sync();assert.equal(f.writes,0);assert.match(f.state.textContent,/專案與本機綁定不同/);
  console.log('PASS server binding enforced on repeated sync attempts');
})().catch(error=>{console.error(error);process.exitCode=1;});
