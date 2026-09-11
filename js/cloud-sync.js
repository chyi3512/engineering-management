/* Phase 1: one private snapshot per account. Existing synchronous local saves stay intact.
   No Realtime, photo upload, background merge or third-party SDK is required. */
(() => {
  'use strict';
  const META='buildflow_cloud_meta_v1', SESSION='buildflow_cloud_session_v1', CONFIG='buildflow_cloud_config_v1';
  const KEYS=['construction_v2','engineering_library_v1','quote_management_v1','equipment_quotes_v1'];
  let config, session, meta={}, busy=false, paused=false, applying=false, timer, generation=0, status='本機模式';
  let ready=false, startup=true;
  const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch(_){return null;}};
  const snapshot=()=>JSON.parse(JSON.stringify({version:1,construction:data,library:libData,quotes:quoteData,equipmentQuotes:equipmentQuoteData}));
  // Stable object-key order: jsonb reorders object keys, but never array positions.
  const canonical=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.keys(v).sort().reduce((o,k)=>(o[k]=v[k],o),{}):v);
  async function fingerprint(value){
    const bytes=new TextEncoder().encode(canonical(value));
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  }
  function persistMeta(){localStorage.setItem(META,JSON.stringify(meta));}
  function say(message){status=message;const el=document.getElementById('buildflowCloudStatus');if(el)el.textContent=message;}
  function setSyncButtonBusy(value){const button=document.getElementById('buildflowCloudSync');if(button)button.disabled=!!value;}
  function fail(error){say('同步失敗：'+(error.message||'網路無法連線')+'；本機資料保留');}
  function validate(p){
    if(p?.version!==1||!p.construction||!Array.isArray(p.construction.projects)||!Array.isArray(p.construction.trades)||!Array.isArray(p.construction.issues)||!Array.isArray(p.library)||!Array.isArray(p.quotes?.items)||!Array.isArray(p.quotes?.vendors)||!Array.isArray(p.equipmentQuotes?.items)||!Array.isArray(p.equipmentQuotes?.vendors))throw Error('雲端資料格式不完整，未覆蓋本機');
    const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
    const lists=[p.construction.projects,p.construction.trades,p.construction.issues,p.library,p.quotes.items,p.quotes.vendors,p.equipmentQuotes.items,p.equipmentQuotes.vendors];
    if(lists.some(list=>!list.every(object))||p.construction.projects.some(project=>!Array.isArray(project.steps)||!project.steps.every(object)))throw Error('雲端工程紀錄格式錯誤，未覆蓋本機');
  }
  async function request(url,options={}){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch(url,{...options,cache:'no-store',signal:controller.signal});
      const body=await response.json().catch(()=>null);
      if(!response.ok){
        const message=body?.message||body?.msg||body?.error_description||body?.error||'HTTP '+response.status;
        if(/BF_REVISION_CONFLICT/.test(message))throw Error('雲端已有更新，已停止覆蓋。請先匯出本機備份，再使用「下載雲端版本」');
        if(/PGRST202|PGRST205|42P01|42883/.test(body?.code||''))throw Error('Supabase 資料表／函式尚未建立，請執行第一階段 SQL');
        throw Error(typeof message==='string'?message:'雲端請求失敗');
      }
      return body;
    }catch(error){if(error.name==='AbortError')throw Error('連線逾時');throw error;}finally{clearTimeout(timeout);}
  }
  async function settings(){
    if(!config){
      try{config=await request(new URL('api/cloud-config',document.baseURI));localStorage.setItem(CONFIG,JSON.stringify(config));}
      catch(error){config=read(CONFIG);if(!config)throw error;}
    }
    if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config?.url)||!config?.key?.startsWith('sb_publishable_')){config=null;throw Error('雲端設定無效');}
    if(meta.server&&meta.server!==config.url)throw Error('Supabase 專案與本機綁定不同，未上傳資料');
  }
  async function authenticate(email,password){
    await settings();
    const result=await request(config.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    acceptSession(result);
  }
  function acceptSession(result){
    if(!result?.user?.id||!result.access_token||!result.refresh_token)throw Error('登入回應無效');
    if(meta.owner&&meta.owner!==result.user.id)throw Error('此瀏覽器的本機資料已綁定另一帳號，請使用原帳號');
    session={access_token:result.access_token,refresh_token:result.refresh_token,user:result.user,expires_at:Math.floor(Date.now()/1000)+Number(result.expires_in||3600)};
    localStorage.setItem(SESSION,JSON.stringify(session));
  }
  async function token(){
    if(!session)throw Error('請先登入');
    if(meta.owner&&meta.owner!==session.user.id)throw Error('登入帳號與本機資料不一致');
    if(session.expires_at*1000<Date.now()+60000){
      acceptSession(await request(config.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})}));
    }
    return session.access_token;
  }
  async function api(path,body){
    return request(config.url+'/rest/v1/'+path,{method:body?'POST':'GET',headers:{apikey:config.key,Authorization:'Bearer '+await token(),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  }
  async function preserveLocal(kind='initial'){
    // Separate backup DB, not the existing photo DB. Base64-heavy snapshots must not
    // multiply localStorage usage and prevent an otherwise valid cloud download.
    const value=snapshot(),key=kind+':'+session.user.id;
    await new Promise((resolve,reject)=>{
      const request=indexedDB.open('buildflow_cloud_backups_v1',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('snapshots');
      request.onerror=()=>reject(request.error);
      request.onblocked=()=>reject(Error('本機備份資料庫忙碌，未覆蓋資料'));
      request.onsuccess=()=>{
        const db=request.result,tx=db.transaction('snapshots','readwrite'),store=tx.objectStore('snapshots');
        const record={savedAt:new Date().toISOString(),payload:value};
        if(kind==='initial'){const get=store.get(key);get.onsuccess=()=>{if(!get.result)store.put(record,key);};}
        else store.put(record,key);
        tx.oncomplete=()=>{db.close();resolve();};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error||Error('本機備份失敗'));};
      };
    });
  }
  async function apply(p,expectedGeneration){
    validate(p);await preserveLocal();await preserveLocal('before-download');
    if(generation!==expectedGeneration||!canReplace())throw Error('本機有新修改，未覆蓋；請完成編輯後重試');
    const values=[p.construction,p.library,p.quotes,p.equipmentQuotes],old=KEYS.map(k=>localStorage.getItem(k)),oldValues=[data,libData,quoteData,equipmentQuoteData];
    applying=true;
    try{
      KEYS.forEach((k,i)=>localStorage.setItem(k,JSON.stringify(values[i])));
      data=p.construction;libData=p.library;quoteData=p.quotes;equipmentQuoteData=p.equipmentQuotes;
      initializeProjectSchedules();
    }catch(error){
      [data,libData,quoteData,equipmentQuoteData]=oldValues;
      KEYS.forEach((k,i)=>{try{if(old[i]!==null)localStorage.setItem(k,old[i]);else localStorage.removeItem(k);}catch(_){}});
      throw error;
    }finally{applying=false;}
  }
  function canReplace(){return !(typeof dailyReportEditor!=='undefined'&&dailyReportEditor?.dirty)&&!(typeof projectSitePending!=='undefined'&&projectSitePending)&&!document.getElementById('projectBasicName')&&!document.getElementById('projectReferenceTitle')&&document.getElementById('modal')?.style.display!=='flex'&&!document.activeElement?.matches('input,textarea,select');}
  async function sync(download=false){
    if(busy||paused)return false;
    busy=true;setSyncButtonBusy(true);clearTimeout(timer);let succeeded=false;
    const start=generation;
    try{
      await settings();if(!session){say('本機模式 · 尚未登入');return false;}
      say('同步中…');
      const rows=await api('buildflow_snapshots?select=payload,revision&user_id=eq.'+encodeURIComponent(session.user.id));
      if(!Array.isArray(rows)||rows.length>1)throw Error('雲端讀取結果無效');
      const row=rows[0];
      if(row){validate(row.payload);if(!Number.isSafeInteger(row.revision)||row.revision<1)throw Error('雲端版本無效');}
      if(start!==generation)throw Error('讀取期間本機有修改，請按立即同步重試');
      if(download&&(!row||!canReplace()))throw Error('請先完成編輯，並確認雲端已有資料');
      if(row&&(download||(!meta.dirty&&meta.owner))){
        if(!canReplace())throw Error('請先完成目前編輯，再按立即同步');
        const hash=await fingerprint(row.payload);
        const changed=hash!==await fingerprint(snapshot());
        if(start!==generation)throw Error('本機有新修改，未覆蓋');
        if(changed)await apply(row.payload,start);
        meta={owner:session.user.id,server:config.url,revision:row.revision,dirty:false,hash};persistMeta();
        window.buildFlowCloud.authoritative=true;
        if(!startup&&changed)home();
      }else if(row&&!meta.owner){
        // First login on another device: remote is authoritative, local is backed up first.
        if(!canReplace())throw Error('請先完成目前編輯，再登入同步');
        const hash=await fingerprint(row.payload);
        if(start!==generation)throw Error('本機有新修改，未覆蓋');
        await apply(row.payload,start);meta={owner:session.user.id,server:config.url,revision:row.revision,dirty:false,hash};persistMeta();
        window.buildFlowCloud.authoritative=true;if(!startup)home();
      }else{
        // A deleted/reset remote row is never silently recreated by an already-bound device.
        if(!row&&meta.revision)throw Error('原雲端資料不存在，已保留本機，請檢查 Supabase');
        const payload=snapshot();validate(payload);const hash=await fingerprint(payload);
        if(row&&meta.revision!==row.revision){
          if(hash!==await fingerprint(row.payload))throw Error('雲端已有更新，本機待同步資料已保留。請先備份再下載雲端版本');
          meta={...meta,revision:row.revision,hash,dirty:start!==generation};persistMeta();
          succeeded=true;say(meta.dirty?'本機已儲存 · 等待同步':'已同步');return true;
        }
        await preserveLocal();
        meta={...meta,owner:session.user.id,server:config.url,dirty:true};persistMeta();
        // Atomic server revision check; receipt loss is handled on the next read above.
        const revision=await api('rpc/buildflow_save_snapshot',{p_payload:payload,p_expected_revision:row?row.revision:null});
        if(!Number.isSafeInteger(revision)||revision<1)throw Error('雲端未回傳有效儲存版本');
        meta={...meta,revision,hash,dirty:start!==generation};persistMeta();
        window.buildFlowCloud.authoritative=true;
      }
      succeeded=true;say(meta.dirty?'本機已儲存 · 等待同步':'已同步 · '+new Date().toLocaleTimeString());return true;
    }catch(error){fail(error);return false;}finally{
      busy=false;setSyncButtonBusy(false);
      if(meta.dirty&&(succeeded||generation!==start))schedule();
    }
  }
  function schedule(){clearTimeout(timer);if(ready&&session&&!paused)timer=setTimeout(()=>sync(),800);}
  window.buildFlowCloudChanged=key=>{
    if(applying||!KEYS.includes(key))return;
    generation++;meta.dirty=true;
    try{persistMeta();say(session?'本機已儲存 · 等待同步':'本機已儲存 · 尚未登入');schedule();}catch(error){fail(error);}
  };
  function controls(){
    const footer=document.getElementById('deploymentBuildMarker');if(!footer)return;
    const box=document.createElement('div');box.id='buildflowCloudControls';
    box.innerHTML='<span id="buildflowCloudStatus" role="status" aria-live="polite"></span> <button type="button" class="light" id="buildflowCloudAccount">雲端帳號</button> <button type="button" class="light" id="buildflowCloudSync">立即同步</button>';
    footer.before(box);box.style.cssText='padding:8px 16px;font-size:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap';
    document.getElementById('buildflowCloudAccount').onclick=account;
    document.getElementById('buildflowCloudSync').onclick=()=>sync();say(status);
  }
  function account(){
    if(busy){say('同步中，請稍候');return;}
    openModal('<h2>BuildFlow 雲端帳號</h2><p class="muted">同一帳號共用工程資料。照片沿用原機制，本機日報照片暫不跨裝置。</p>'+(session?'<p>'+esc(session.user.email||'已登入')+'</p><button class="light" id="bfSignOut">登出</button> <button class="light" id="bfDownload">下載雲端版本</button>':'<form id="bfLogin"><label>Email<input name="email" type="email" autocomplete="username" required></label><label>密碼<input name="password" type="password" autocomplete="current-password" required></label><button type="submit">登入並同步</button></form>')+'<p id="bfAccountMessage" role="status"></p><button class="light" onclick="closeModal()">關閉</button>');
    const form=document.getElementById('bfLogin');
    if(form)form.onsubmit=async event=>{
      event.preventDefault();const button=form.querySelector('button');button.disabled=true;paused=true;
      try{await authenticate(form.elements.email.value.trim(),form.elements.password.value);form.elements.password.value='';paused=false;closeModal();await sync();}catch(error){document.getElementById('bfAccountMessage').textContent=error.message;fail(error);}finally{paused=false;button.disabled=false;}
    };
    const logout=document.getElementById('bfSignOut');if(logout)logout.onclick=()=>{
      if(meta.dirty&&!confirm('尚有本機資料未同步。登出會保留這些資料，之後請登入同一帳號同步。確定登出？'))return;
      clearTimeout(timer);session=null;localStorage.removeItem(SESSION);closeModal();say('本機模式 · 已登出');
    };
    const download=document.getElementById('bfDownload');if(download)download.onclick=async()=>{
      if(!confirm('將下載雲端版本取代目前工作副本。請先匯出備份；本機副本亦會另存。確定繼續？'))return;
      try{await preserveLocal('manual:'+Date.now());closeModal();await sync(true);}catch(error){fail(error);}
    };
  }
  window.buildFlowCloud={authoritative:false,sync,async initialize(){
    controls();
    try{
      meta=read(META)||{};session=read(SESSION);
      window.buildFlowCloud.authoritative=!!meta.revision;
      // Catch saves performed by old cached pages, startup normalization, or restored backups.
      if(meta.owner&&meta.hash&&await fingerprint(snapshot())!==meta.hash){meta.dirty=true;persistMeta();}
      await sync();
    }catch(error){fail(error);}finally{ready=true;startup=false;if(meta.dirty&&generation>0)schedule();}
  }};
  window.addEventListener('online',()=>{if(meta.dirty)sync();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&ready&&session&&canReplace())sync();});
  window.addEventListener('beforeunload',event=>{if(busy||session&&meta.dirty){event.preventDefault();event.returnValue='';}});
  // Do not let an older open tab overwrite another tab's cache or refreshed session.
  window.addEventListener('storage',event=>{if(KEYS.includes(event.key)||event.key===META||event.key===SESSION){paused=true;clearTimeout(timer);say('另一分頁已更新資料；請完成本機編輯並備份後重新開啟');}});
})();
