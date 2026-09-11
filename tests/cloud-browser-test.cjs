// Real Chrome + isolated local origin/profile. Supabase requests are mocked locally.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {spawn,execFileSync}=require('node:child_process'),assert=require('node:assert/strict');
const baseline=process.argv.includes('--baseline'),legacy=baseline||process.argv.includes('--legacy');
const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'buildflow-sync-'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let row=null,offline=false,child,ws,sequence=0;const pending=new Map(),failures=[];
const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const json=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
  if(pathname==='/api/cloud-config')return json(200,{url:'https://fixture.supabase.co',key:'sb_publishable_test'});
  if(pathname.startsWith('/mock/')){
    if(offline)return json(503,{message:'Simulated offline'});
    if(pathname.includes('/auth/v1/token'))return json(200,{access_token:'access',refresh_token:'refresh',expires_in:3600,user:{id:'11111111-1111-4111-8111-111111111111',email:'owner@example.test'}});
    if(pathname.includes('/rpc/')){
      let raw='';for await(const part of req)raw+=part;const body=JSON.parse(raw);
      if(row?body.p_expected_revision!==row.revision:body.p_expected_revision!==null)return json(409,{message:'BF_REVISION_CONFLICT'});
      row={payload:body.p_payload,revision:(row?.revision||0)+1};return json(200,row.revision);
    }
    return json(200,row?[row]:[]);
  }
  if(pathname==='/blank'){res.end('<title>blank</title>');return;}
  const file=path.resolve(root,'.'+decodeURIComponent(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
  if(baseline&&['/js/data.js','/js/app.js','/js/init.js'].includes(pathname)){
    res.writeHead(200,{'Content-Type':mime['.js']});res.end(execFileSync('git',['show','HEAD:'+pathname.slice(1)],{cwd:root,maxBuffer:10*1024*1024}));return;
  }
  fs.readFile(file,(error,body)=>{res.writeHead(error?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(error?'missing':body);});
});
function cdp(method,params={}){const id=++sequence;return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Timeout '+method)),30000);pending.set(id,{resolve:r=>{clearTimeout(timeout);resolve(r);},reject});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function until(expression){for(let i=0;i<200;i++){try{if(await evaluate(expression))return;}catch(_){}await sleep(100);}throw Error('Timeout '+expression);}
async function navigate(url){await cdp('Page.navigate',{url});await until("document.readyState==='complete'");}
async function check(expression,label){assert.equal(await evaluate(expression),true,label);console.log('PASS '+label);}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  child=spawn(process.argv.slice(2).find(arg=>!arg.startsWith('--'))||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless','--no-sandbox','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  const portFile=path.join(profile,'DevToolsActivePort');for(let i=0;i<100&&!fs.existsSync(portFile);i++)await sleep(100);
  const port=fs.readFileSync(portFile,'utf8').split('\n')[0],pages=await(await fetch('http://127.0.0.1:'+port+'/json')).json();
  ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);ws.onmessage=event=>{const message=JSON.parse(event.data),p=pending.get(message.id);if(p){pending.delete(message.id);message.error?p.reject(Error(JSON.stringify(message.error))):p.resolve(message.result);}};
  await new Promise(r=>ws.onopen=r);await cdp('Page.enable');await cdp('Runtime.enable');
  await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`window.cloudTestErrors=[];addEventListener('error',event=>cloudTestErrors.push(event.message));addEventListener('unhandledrejection',event=>cloudTestErrors.push(String(event.reason)));const nativeFetch=window.fetch.bind(window);window.fetch=(url,options)=>nativeFetch(String(url).replace('https://fixture.supabase.co',location.origin+'/mock'),options);`});
  if(!legacy){
  await navigate(base+'/');await until("document.getElementById('buildflowCloudStatus')?.textContent.includes('尚未登入')");
  await evaluate("data.projects=[{id:123,name:'電腦工程',client:'owner',status:'進行中',steps:[{name:'施工',trade:'水電',notes:[],done:false}]}];save();equipmentQuoteData.items.push({id:'eq',name:'設備測試',quotes:[]});equipmentQuoteSave();document.getElementById('buildflowCloudAccount').click();document.querySelector('#bfLogin [name=email]').value='owner@example.test';document.querySelector('#bfLogin [name=password]').value='test-only';document.getElementById('bfLogin').requestSubmit();");
  await until("document.getElementById('buildflowCloudStatus').textContent.startsWith('已同步')");assert.equal(row.payload.construction.projects[0].name,'電腦工程');assert.equal(row.payload.equipmentQuotes.items[0].id,'eq');
  console.log('PASS real login UI, four-key save hooks and first upload');
  await check("localStorage.getItem('construction_v2').includes('電腦工程')",'existing local cache retained');
  offline=true;await evaluate("data.projects[0].name='離線編輯';save();");await until("document.getElementById('buildflowCloudStatus').textContent.includes('同步失敗')");
  await navigate(base+'/');await until("document.getElementById('buildflowCloudStatus').textContent.includes('同步失敗')");await check("data.projects[0].name==='離線編輯'&&main.textContent.includes('離線編輯')",'offline restart renders local home without blank screen');
  offline=false;await evaluate('buildFlowCloud.sync()');assert.equal(row.payload.construction.projects[0].name,'離線編輯');
  await evaluate("document.getElementById('buildflowCloudAccount').click();document.getElementById('bfSignOut').click()");
  await check("!localStorage.getItem('buildflow_cloud_session_v1')&&data.projects[0].name==='離線編輯'",'logout retains user data');
  // Only this disposable browser profile/origin is cleared to simulate a fresh phone.
  await navigate(base+'/blank');await evaluate('localStorage.clear()');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await navigate(base+'/');await until("document.getElementById('buildflowCloudStatus')?.textContent.includes('尚未登入')");
  await evaluate("document.getElementById('buildflowCloudAccount').click();document.querySelector('#bfLogin [name=email]').value='owner@example.test';document.querySelector('#bfLogin [name=password]').value='test-only';document.getElementById('bfLogin').requestSubmit()");
  await until("document.getElementById('buildflowCloudStatus').textContent.startsWith('已同步')");
  await check("data.projects[0].name==='離線編輯'&&equipmentQuoteData.items[0].id==='eq'",'fresh phone downloads same account data');
  await check('document.documentElement.scrollWidth<=window.innerWidth+1','cloud controls fit mobile width');
  row.payload.construction.projects[0].name='雲端最新';row.revision++;
  await navigate(base+'/');await until("document.getElementById('buildflowCloudStatus').textContent.startsWith('已同步')");await check("data.projects[0].name==='雲端最新'",'reopen fetches latest remote snapshot');
  await evaluate("data.projects[0].name='本機待同步';save()");row.revision++;row.payload.construction.projects[0].name='另一裝置';
  await until("document.getElementById('buildflowCloudStatus').textContent.includes('同步失敗')");assert.equal(row.payload.construction.projects[0].name,'另一裝置');await check("data.projects[0].name==='本機待同步'",'stale-version protection preserves both copies');
  await check('cloudTestErrors.length===0','no uncaught cloud-page errors or unhandled rejections');
  }
  // Run the existing regression pages unchanged, in isolated storage per suite.
  await cdp('Emulation.clearDeviceMetricsOverride');
  for(const suite of [
    ['checklists-ui-test.html',[''],'results'],
    ['workflow-test.html',[''],'workflowTestResults'],
    ['regression.html',['?create','?reload'],'results'],
    ['daily-reports-test.html',['?phase=create','?phase=edit','?phase=verify','?phase=mobile'],'dailyTestResults'],
    ['project-site-test.html',['?phase=create','?phase=reload','?phase=mobile'],'dailyTestResults']
  ]){
    await navigate(base+'/blank');await evaluate('localStorage.clear();sessionStorage.clear()');
    for(const suffix of suite[1]){
      if(suffix.includes('mobile'))await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
      await navigate(base+'/tests/'+suite[0]+suffix);await until("['PASS','FAIL'].includes(document.title)");
      const result=await evaluate('({title:document.title,text:document.getElementById('+JSON.stringify(suite[2])+').textContent})');
      if(result.title==='FAIL'){failures.push(suite[0]+suffix+'\n'+result.text);console.log('FAIL '+suite[0]+suffix+'\n'+result.text);break;}
      console.log('PASS existing '+suite[0]+suffix+' ('+result.text.split('\n').length+' assertions)');
    }
    await cdp('Emulation.clearDeviceMetricsOverride');
  }
  if(failures.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{if(ws)ws.close();if(child)child.kill();server.close();});
