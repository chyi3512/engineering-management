// node tests/pwa-test.cjs [path-to-Chrome]. Uses an isolated browser profile and local server.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const http=require('node:http'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'engineering-pwa-'));
const chrome=process.argv[2]||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/blank'){res.setHeader('Content-Type','text/html');return res.end('<title>Fixture</title>');}
  const relative=pathname.replace(/^\/app\//,'/');
  const file=path.resolve(root,'.'+relative+(relative.endsWith('/')?'index.html':''));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(file,(error,body)=>{res.writeHead(error?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(error?'missing':body);});
});
let child,ws,nextId=0;const pending=new Map(),errors=[];
async function cdp(method,params={}){
  const id=++nextId;
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('Timeout '+method));},25000);
    pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});
    ws.send(JSON.stringify({id,method,params}));
  });
}
async function evaluate(expression){
  const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
  return r.result.value;
}
async function until(expression){
  for(let i=0;i<120;i++){try{if(await evaluate(expression))return;}catch(_){}await sleep(150);}
  throw Error('Condition not met: '+expression);
}
async function check(expression,label){assert.equal(await evaluate(expression),true,label);console.log('PASS '+label);}
async function navigate(url){await cdp('Page.navigate',{url});await until("document.readyState==='complete'");}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  child=spawn(chrome,['--headless','--no-sandbox','--disable-gpu','--disable-software-rasterizer','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  const portFile=path.join(profile,'DevToolsActivePort');
  for(let i=0;i<100&&!fs.existsSync(portFile);i++)await sleep(100);
  const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
  const pages=await (await fetch('http://127.0.0.1:'+port+'/json')).json();
  ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);const p=pending.get(message.id);if(p){pending.delete(message.id);message.error?p.reject(Error(JSON.stringify(message.error))):p.resolve(message.result);}};
  await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Network.enable');
  await navigate(base+'/blank');
  await evaluate(`window.localStorage.setItem('construction_v2',JSON.stringify({trades:[{name:'水電',items:[]}],projects:[{id:9001,name:'既有工程',client:'原業主',status:'進行中',steps:[{id:'pipe',name:'配管',trade:'水電',notes:[],done:false}],scheduleMeta:{estimatedStart:'2026-09-10',estimatedDuration:30}}],issues:[],methods:[]}));`);
  await navigate(base+'/');
  await until("typeof data!=='undefined'&&main.textContent.includes('既有工程')");
  await until('!!navigator.serviceWorker.controller');
  await check("data.projects.some(p=>p.id===9001&&p.client==='原業主')",'existing local data reads after PWA activation');
  const manifest=await cdp('Page.getAppManifest');assert.equal(manifest.errors.length,0);assert.equal(JSON.parse(manifest.data).display,'standalone');console.log('PASS browser manifest parsing and standalone declaration');
  const install=await cdp('Page.getInstallabilityErrors');assert.equal(install.installabilityErrors.length,0,JSON.stringify(install));console.log('PASS Chrome installability checks');
  await check("(async()=>{const c=await caches.open((await caches.keys()).find(k=>k.includes('engineering-management-pwa')));return (await c.keys()).every(r=>!r.url.includes('/data/')&&!r.url.includes('/tests/'));})()",'cache excludes user JSON and test pages');
  await evaluate("newProject();document.getElementById('projectName').value='PWA新增工程';document.getElementById('projectClient').value='測試';document.getElementById('projectStart').value='2026-09-10';document.getElementById('projectDuration').value='30';saveProject();");
  await check("data.projects.some(p=>p.name==='PWA新增工程')",'create project with original form');
  await evaluate("openProjectBasicData(9001);document.getElementById('projectBasicName').value='既有工程已編輯';saveProjectBasicData(9001);");
  await check("data.projects.find(p=>p.id===9001).name==='既有工程已編輯'",'edit project with original form');
  await evaluate("checklistHome();checklistQuickOpen(0);let f=main.querySelector('form');f.querySelector('input').value='配管驗收';f.requestSubmit();checklistHome();checklistQuickOpen(0,0);f=main.querySelector('form');f.querySelector('input').value='通水測試';f.requestSubmit();checklistHome();checklistTargetOpen(0,0,main.querySelector('.checklist-binding button'));const select=main.querySelector('select');select.value='0';select.dispatchEvent(new Event('change'));openProject(9001);const detail=main.querySelector('.checklist-project');detail.open=true;detail.querySelector('input').click();");
  await check("data.projects.find(p=>p.id===9001).steps[0].checklist[0].done",'Checklist creation, ID binding and project toggle');
  await evaluate("quoteGate();document.getElementById('qpass').value=QUOTE_PASSWORD;checkQuotePassword();newQuoteItem('水電');document.getElementById('qn').value='PWA測試報價';document.getElementById('qb').value='100';document.getElementById('qq').value='2';saveQuoteItem(0);");
  await check("quoteData.items.some(i=>i.name==='PWA測試報價'&&i.benchmark===100&&i.qty===2)",'quote login, creation and save');
  await navigate(base+'/');await until("typeof data!=='undefined'&&main.textContent.includes('既有工程已編輯')");
  await check("data.projects.some(p=>p.name==='PWA新增工程')&&data.projects.find(p=>p.id===9001).steps[0].checklist[0].done&&quoteData.items.some(i=>i.name==='PWA測試報價')",'project, Checklist and quote persistence after reload');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await check("document.documentElement.scrollWidth<=innerWidth&&document.querySelector('meta[name=viewport]').content.includes('viewport-fit=cover')",'390px mobile layout and viewport');
  await evaluate("checklistHome();checklistQuickOpen(0,0)");
  await check("document.activeElement===main.querySelector('form input')&&document.documentElement.scrollWidth<=innerWidth",'mobile Checklist input');
  await cdp('Emulation.setEmulatedMedia',{features:[]});await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await evaluate('home()');
  await check("document.querySelector('.app').getBoundingClientRect().width===540&&getComputedStyle(document.body).paddingLeft==='0px'&&document.querySelectorAll('nav button').length===6",'desktop width and navigation unchanged');
  await cdp('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await navigate(base+'/');await until("typeof data!=='undefined'&&main.textContent.includes('既有工程已編輯')");
  await check("data.projects.find(p=>p.id===9001).steps[0].checklist[0].done&&quoteData.items.some(i=>i.name==='PWA測試報價')",'offline shell opens with saved data');
  await cdp('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  await navigate(base+'/app/');await until("navigator.serviceWorker.controller?.scriptURL.endsWith('/app/sw.js')");
  await check("(async()=>{const r=await navigator.serviceWorker.getRegistration();return r.scope.endsWith('/app/');})()",'subdirectory deployment scope');
  assert.deepEqual(errors,[],'uncaught browser errors');console.log('PASS no uncaught browser exceptions');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  if(ws?.readyState===1){try{await cdp('Browser.close');}catch(_){}ws.close();}
  if(child&&!child.killed)child.kill();server.close();
});
