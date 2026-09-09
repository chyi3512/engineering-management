/* 日報專用照片儲存。既有工種庫照片流程不變；日報文字仍經 save() 保存。 */
let dailyPhotoDatabasePromise;
function dailyPhotoKey(projectId,reportId,photoId){return JSON.stringify([String(projectId),String(reportId),String(photoId)]);}
function openDailyPhotoDatabase(){
  if(!dailyPhotoDatabasePromise)dailyPhotoDatabasePromise=new Promise((resolve,reject)=>{
    if(!window.indexedDB){reject(new Error('此瀏覽器不支援本機照片儲存，請使用支援 IndexedDB 的瀏覽器或雲端版。'));return;}
    const request=indexedDB.open('engineering_daily_report_photos_v1',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('photos',{keyPath:'key'});
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();dailyPhotoDatabasePromise=null;};resolve(db);};
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error('照片資料庫忙碌，請關閉其他工程管理分頁後重試。'));
  }).catch(error=>{dailyPhotoDatabasePromise=null;throw error;});
  return dailyPhotoDatabasePromise;
}
async function dailyPhotoStore(mode,operation){
  const db=await openDailyPhotoDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('photos',mode),store=tx.objectStore('photos');let result;
    try{const request=operation(store);if(request)request.onsuccess=()=>result=request.result;}catch(error){tx.abort();reject(error);return;}
    tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('照片儲存已中止'));
  });
}
function dailyDataURLBlob(value){
  const match=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(value||'');
  if(!match)throw new Error('照片格式不正確');
  const binary=atob(match[2]),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return new Blob([bytes],{type:match[1]});
}
function dailyBlobDataURL(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});}
function dailyCloudPhotoURL(photo){
  try{const url=new URL(photo.url||photo.data||'');return ['https:','http:'].includes(url.protocol)?url.href:'';}catch(error){return '';}
}
async function dailyPhotoBlob(report,photo){
  if(photo.storage!=='indexeddb')return null;
  const record=await dailyPhotoStore('readonly',store=>store.get(dailyPhotoKey(report.projectId,report.id,photo.id)));
  return record?.blob||null;
}
async function prepareDailyPhoto(file){
  if(file.type&&!file.type.startsWith('image/'))throw new Error('請選擇照片檔案。');
  if(file.size>40*1024*1024)throw new Error('單張照片請小於 40 MB。');
  // 使用原有縮圖函式，壓縮後才上傳／保存，原始 Base64 不進入工程資料。
  let blob=dailyDataURLBlob(await resizeLibraryPhoto(file,1200,.75));
  if(blob.size>500*1024)blob=dailyDataURLBlob(await resizeLibraryPhoto(file,960,.6));
  return blob;
}
async function persistDailyPhotos(editor){
  const report=editor.report;
  for(const photo of report.photos){
    const blob=editor.blobs.get(photo.id);if(!blob)continue;
    if(cloudReady()){
      if(!photo.url){
        const file=new File([blob],photo.id+'.jpg',{type:'image/jpeg'});
        const result=await new Promise((resolve,reject)=>uploadPhotoToDrive(file,photo.trade||'日報',report.date,photo.description,(error,value)=>error?reject(error):resolve(value)));
        if(!result?.url||!dailyCloudPhotoURL(result))throw new Error('雲端未回傳有效照片網址，日報尚未儲存。');
        photo.storage='google-drive';photo.url=result.url;photo.driveId=result.id||'';
      }
    }else{
      await dailyPhotoStore('readwrite',store=>store.put({key:dailyPhotoKey(report.projectId,report.id,photo.id),projectId:report.projectId,reportId:report.id,photoId:photo.id,blob}));
      photo.storage='indexeddb';
    }
    photo.size=blob.size;
  }
}
async function removeDailyPhotoFiles(report,photos){
  // 雲端 URL 保留在 Drive，避免刪除日報時使已匯出的 Excel 或備份連結失效。
  const local=photos.filter(photo=>photo.storage==='indexeddb');
  if(local.length)await dailyPhotoStore('readwrite',store=>{local.forEach(photo=>store.delete(dailyPhotoKey(report.projectId,report.id,photo.id)));});
}
async function collectDailyReportPhotoBackup(){
  const reports=Array.isArray(data.dailyReports)?data.dailyReports:[],out=[];
  for(const report of reports)for(const photo of report.photos||[]){
    if(photo.storage!=='indexeddb')continue;
    const blob=await dailyPhotoBlob(report,photo);
    if(!blob)throw new Error('日報 '+report.date+' 的本機照片遺失，無法製作完整備份。');
    out.push({projectId:report.projectId,reportId:report.id,photoId:photo.id,data:await dailyBlobDataURL(blob)});
  }
  return out;
}
async function restoreDailyReportPhotoBackup(entries,construction){
  if(!Array.isArray(entries)||!entries.length)return;
  const records=entries.map(entry=>{
    const report=construction?.dailyReports?.find(r=>String(r.projectId)===String(entry.projectId)&&String(r.id)===String(entry.reportId));
    if(!report?.photos?.some(p=>p.id===entry.photoId&&p.storage==='indexeddb'))throw new Error('日報照片與備份紀錄不一致');
    return {key:dailyPhotoKey(entry.projectId,entry.reportId,entry.photoId),projectId:entry.projectId,reportId:entry.reportId,photoId:entry.photoId,blob:dailyDataURLBlob(entry.data)};
  });
  await dailyPhotoStore('readwrite',store=>records.forEach(record=>store.put(record)));
}
