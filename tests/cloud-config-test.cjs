const assert=require('node:assert/strict');
const handler=require('../api/cloud-config.js');
const original={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_PUBLISHABLE_KEY};
function call(method='GET'){const result={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};handler({method},result);return result;}
try{
  delete process.env.SUPABASE_URL;delete process.env.SUPABASE_PUBLISHABLE_KEY;assert.equal(call().code,503);
  process.env.SUPABASE_URL='https://fixture.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='sb_secret_do-not-expose';let r=call();assert.equal(r.code,503);assert.ok(!JSON.stringify(r.body).includes('sb_secret'));
  process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_fixture';r=call();assert.equal(r.code,200);assert.deepEqual(r.body,{url:'https://fixture.supabase.co',key:'sb_publishable_fixture'});assert.equal(r.headers['Cache-Control'],'no-store');assert.equal(call('POST').code,405);
  console.log('PASS missing config, secret-key rejection, public-only response, no-store and method restriction');
}finally{if(original.url===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=original.url;if(original.key===undefined)delete process.env.SUPABASE_PUBLISHABLE_KEY;else process.env.SUPABASE_PUBLISHABLE_KEY=original.key;}
