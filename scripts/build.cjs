// The application is already static; validate it without transforming its files.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);}
const files=[...walk(path.join(root,'js')),...walk(path.join(root,'api')),...walk(path.join(root,'scripts')),path.join(root,'sw.js')].filter(file=>/\.(js|cjs)$/.test(file));
for(const file of files)execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const [,asset] of html.matchAll(/(?:src|href)="((?:js|css|icons)\/[^"<>]+|manifest.webmanifest)"/g)){
  if(!fs.existsSync(path.join(root,asset.split('?')[0])))throw Error('Missing asset: '+asset);
}
JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
execFileSync(process.execPath,[path.join(root,'tests/pwa-sw-test.cjs')],{stdio:'inherit'});
console.log('Build PASS: '+files.length+' JavaScript files, entry assets and PWA shell verified. Static output remains at project root.');
