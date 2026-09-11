const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{parseEnv}=require('node:util');
const root=path.resolve(__dirname,'..'),envFile=path.join(root,'.env.local');
if(fs.existsSync(envFile)){
  const values=parseEnv(fs.readFileSync(envFile,'utf8').replace(/^\uFEFF/,''));
  for(const key of ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY'])if(process.env[key]===undefined&&values[key]!==undefined)process.env[key]=values[key];
}
const config=require('../api/cloud-config.js');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=http.createServer((req,res)=>{
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch(_){res.writeHead(400);res.end();return;}
  res.setHeader('Cache-Control','no-store');
  if(pathname==='/api/cloud-config'){
    res.status=code=>{res.statusCode=code;return res;};res.json=body=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));};
    return config(req,res);
  }
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  // Never serve environment files, repository metadata, backups or server source.
  const relative=pathname==='/'?'index.html':pathname.slice(1);
  if(!/^(?:index\.html|sw\.js|manifest\.webmanifest|(?:js|css|icons|data)\/[A-Za-z0-9_./-]+)$/.test(relative)||relative.split('/').some(part=>part.startsWith('.'))){res.writeHead(404);res.end();return;}
  const file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)||!mime[path.extname(file)]){res.writeHead(404);res.end();return;}
  fs.readFile(file,(error,body)=>{res.writeHead(error?404:200,{'Content-Type':mime[path.extname(file)]});res.end(req.method==='HEAD'||error?'':body);});
});
const port=Number(process.env.PORT||3000);
server.listen(port,'127.0.0.1',()=>console.log('BuildFlow local: http://localhost:'+server.address().port+' (environment values are not logged)'));
server.on('error',error=>{console.error('Local server failed: '+error.code);process.exitCode=1;});
