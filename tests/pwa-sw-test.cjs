const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),scope='https://example.test/app/',handlers={};
let cached=[],deleted=[],claimed=false,cacheFails=false,offline=false;
const cache={addAll:async requests=>{cached=requests.map(r=>r.url);},put:async()=>{},match:async()=>new Response('offline shell')};
const context=vm.createContext({URL,Request,Response,Set,
  self:{registration:{scope},location:{origin:'https://example.test'},clients:{claim:async()=>{claimed=true;}},addEventListener:(name,fn)=>handlers[name]=fn},
  caches:{open:async()=>{if(cacheFails)throw Error('storage unavailable');return cache;},keys:async()=>['unrelated-cache','engineering-management-pwa:'+scope+':old','engineering-management-pwa:https://example.test/other/:old'],delete:async name=>deleted.push(name)},
  fetch:async()=>{if(offline)throw Error('offline');return new Response('online shell');}
});
vm.runInContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),context);
async function lifetime(name){let promise;handlers[name]({waitUntil:p=>promise=p});await promise;}
function request(url,method='GET',mode='cors'){let response;handlers.fetch({request:{url,method,mode},respondWith:p=>response=p});return response;}
(async()=>{
  await lifetime('install');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  for(const [,asset] of html.matchAll(/(?:src|href)="((?:js|css|icons)\/[^"<>]+|manifest.webmanifest)"/g))assert.ok(cached.includes(new URL(asset,scope).href),asset+' is precached');
  for(const asset of cached)assert.ok(fs.existsSync(path.join(root,new URL(asset).pathname.replace('/app/',''))),asset+' exists');
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
  for(const icon of manifest.icons){const bytes=fs.readFileSync(path.join(root,icon.src));assert.equal(bytes.readUInt32BE(16)+'x'+bytes.readUInt32BE(20),icon.sizes);}
  assert.equal(request(scope+'data/project-data.json'),undefined);
  assert.equal(request('https://external.test/photo.jpg'),undefined);
  assert.equal(request(scope+'js/app.js','POST'),undefined);
  assert.equal(request(scope+'tests/regression.html','GET','navigate'),undefined);
  cacheFails=true;assert.equal(await (await request(scope+'js/app.js')).text(),'online shell');
  cacheFails=false;offline=true;assert.equal(await (await request(scope,'GET','navigate')).text(),'offline shell');
  await lifetime('activate');assert.equal(claimed,true);assert.deepEqual(deleted,['engineering-management-pwa:'+scope+':old']);
  console.log('PASS shell coverage, PNG sizes, data/API bypass, storage failure, offline fallback and scoped cache cleanup');
})().catch(error=>{console.error(error);process.exitCode=1;});
