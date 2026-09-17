/* 正式現場日報：只呈現現場紀錄，不推測進度或下一工種。 */
function findProjectSiteReport(projectId,reportId){const project=dailyProject(projectId);return [...(project?.siteReportPreviews||[]),...(project?.siteReports||[])].find(report=>report.id===reportId);}
function finalizeProjectSiteReport(projectId,report){const project=dailyProject(projectId);if(!project||!report?.preview)return;projectSiteUpdate(project,()=>{const formal={...report,preview:false,finalizedAt:new Date().toISOString()};project.siteReports=[...(project.siteReports||[]).filter(item=>item.id!==report.id),formal];project.siteReportPreviews=(project.siteReportPreviews||[]).filter(item=>item.id!==report.id);});report.preview=false;}
function projectSiteReportRows(report,key){return Array.isArray(report[key])?report[key]:[];}
function projectSiteReportBody(report,photoURLs={}){
  const cell=value=>esc(value==null?'':value).replace(/\n/g,'<br>');
  const todayWork=projectSiteReportRows(report,'todayWork'),acceptances=projectSiteReportRows(report,'acceptances'),nextConstruction=projectSiteReportRows(report,'nextConstruction'),coordination=projectSiteReportRows(report,'coordinationItems');
  return '<article class="site-report"><header><div class="site-report-kicker">FIELD / CONSTRUCTION</div><h1>工程日報</h1><div>施工現場紀錄</div></header><table class="site-report-info"><tbody><tr><th>工程名稱</th><td>'+cell(report.projectName)+'</td><th>日期</th><td>'+cell(report.date)+'</td></tr><tr><th>業主／客戶</th><td colspan="3">'+cell(report.client||'—')+'</td></tr></tbody></table><h2>一、今日施工紀錄</h2><table><thead><tr><th style="width:28%">工種</th><th>施工內容</th></tr></thead><tbody>'+(todayWork.length?todayWork.map(item=>'<tr><td>'+cell(item.trade)+'</td><td>'+cell(item.content)+'</td></tr>').join(''):'<tr><td colspan="2">未記錄</td></tr>')+'</tbody></table><h2>二、驗收紀錄</h2><table><thead><tr><th>驗收項目</th><th style="width:28%">狀態</th></tr></thead><tbody>'+(acceptances.length?acceptances.map(item=>'<tr><td>'+cell(item.label)+'</td><td>已驗收</td></tr>').join(''):'<tr><td colspan="2">未記錄</td></tr>')+'</tbody></table><h2>三、下次施工</h2><table><thead><tr><th style="width:24%">日期</th><th style="width:24%">工種</th><th>施工內容</th></tr></thead><tbody>'+(nextConstruction.length?nextConstruction.map(item=>'<tr><td>'+cell(item.date)+'</td><td>'+cell(item.trade)+'</td><td>'+cell(item.content)+'</td></tr>').join(''):'<tr><td colspan="3">未記錄</td></tr>')+'</tbody></table><h2>四、待確認／協調事項</h2><table><thead><tr><th style="width:22%">分類</th><th>事項</th><th style="width:22%">狀態</th></tr></thead><tbody>'+(coordination.length?coordination.map(item=>'<tr><td>'+cell(item.category||'業主')+'</td><td>'+cell(item.text)+'</td><td>'+cell(item.status||'待確認')+'</td></tr>').join(''):'<tr><td colspan="3">未記錄</td></tr>')+'</tbody></table><h2>五、現場照片</h2><div class="site-report-photos">'+(report.photos.length?report.photos.map((photo,i)=>'<figure>'+(photoURLs[photo.id]?'<img src="'+esc(photoURLs[photo.id])+'" alt="照片 '+(i+1)+'">':'<div data-site-report-photo="'+esc(photo.id)+'">照片載入中…</div>')+'<figcaption>照片 '+(i+1)+'｜'+cell(photo.description||'未填說明')+'</figcaption></figure>').join(''):'<p>未記錄</p>')+'</div><footer>紀錄日期 '+cell(report.date)+'　｜　製表 '+cell(new Date(report.createdAt).toLocaleString('zh-TW'))+'</footer></article>';
}
const PROJECT_SITE_PRINT_CSS='@page{size:A4 portrait;margin:14mm}*{box-sizing:border-box}body{margin:0;color:#171717;background:#fff;font-family:"Microsoft JhengHei","Noto Sans TC",sans-serif;font-size:11pt;line-height:1.5}.site-report{max-width:182mm;margin:auto}.site-report header{display:block;padding:0 0 12px;border-bottom:2px solid #222;margin-bottom:14px}.site-report h1{font-size:24pt;letter-spacing:.15em;margin:5px 0}.site-report-kicker,.report-small{font-size:9pt;color:#666}.site-report h2{font-size:13pt;margin:20px 0 8px;break-after:avoid}.site-report table{border-collapse:collapse;width:100%;table-layout:fixed}.site-report th,.site-report td{padding:8px;border:1px solid #ccc;vertical-align:top;overflow-wrap:anywhere;text-align:left}.site-report th{background:#f2f2f2;font-weight:600}.site-report tr{break-inside:avoid}.site-report thead{display:table-header-group}.site-report-info th{width:20%}.site-report p{white-space:pre-wrap}.site-report-photos{display:grid;grid-template-columns:1fr 1fr;gap:12px}.site-report figure{margin:0;break-inside:avoid}.site-report figure img{width:100%;height:55mm;object-fit:contain;background:#fafafa}.site-report figcaption{font-size:10pt;overflow-wrap:anywhere}.site-report footer{border-top:1px solid #ccc;margin-top:24px;padding-top:8px;font-size:9pt;color:#666}.print-controls{max-width:182mm;margin:16px auto;font:14px sans-serif}.print-controls button{padding:10px 16px}@media print{.print-controls{display:none}}';
async function projectSiteReportPhotoURLs(report){
  const urls={};
  for(const photo of report.photos){const cloud=dailyCloudPhotoURL(photo);if(cloud){urls[photo.id]=cloud;continue;}const blob=await dailyPhotoBlob(report,photo);if(!blob)throw new Error('找不到照片，請先還原照片備份');urls[photo.id]=await dailyBlobDataURL(blob);}
  return urls;
}
function viewProjectSiteReport(projectId,reportId){
  const report=findProjectSiteReport(projectId,reportId);if(!report)return;
  releaseDailyPhotoViews();
  main.innerHTML='<section class="project-site" id="psReportRoot"><button class="back" id="psReportReturn">← 返回工程</button><div class="site-actions"><button id="psReportExcel">匯出 Excel</button><button class="light" id="psReportPDF">匯出 PDF／列印</button><button class="light" id="psReportSend">＋ 寄送</button></div><p class="muted" role="status" id="psReportStatus">'+(report.preview?'今日預覽，尚未正式輸出。':'已保存正式日報。')+' Excel 為 A4 直式一頁；PDF 請於列印視窗選擇儲存為 PDF。</p><div class="site-report-preview">'+projectSiteReportBody(report)+'</div></section>';
  document.getElementById('psReportReturn').onclick=()=>openProject(dailyProject(projectId).id);
  const status=document.getElementById('psReportStatus');
  document.getElementById('psReportExcel').onclick=async function(){this.disabled=true;try{await exportProjectSiteExcel(report);finalizeProjectSiteReport(projectId,report);status.textContent='Excel 已匯出（A4 直式一頁）';}catch(error){status.textContent='匯出未完成：'+error.message;}finally{this.disabled=false;}};
  document.getElementById('psReportPDF').onclick=()=>{finalizeProjectSiteReport(projectId,report);printProjectSiteReport(report);};
  document.getElementById('psReportSend').onclick=()=>openProjectSiteReportSend(projectId,report);
  const root=document.getElementById('psReportRoot');
  projectSiteReportPhotoURLs(report).then(urls=>{if(root.isConnected)root.querySelector('.site-report-preview').innerHTML=projectSiteReportBody(report,urls);}).catch(error=>{if(root.isConnected)root.querySelector('[role=status]').textContent=error.message;});
}
const PROJECT_SITE_REPORT_RECIPIENT_TYPES=['業主','老闆','公司','自己','其他'];
function openProjectSiteReportSend(projectId,report){const project=dailyProject(projectId),subject=(project.name||'工程')+'｜'+report.date+' 工程日報',body='您好，\n\n附件為 '+(project.name||'工程')+'\n'+report.date+' 工程日報。\n\n請查收，謝謝。\n\n附件：\n工程日報 PDF';openModal('<div class="project-site"><h2>寄送工程日報</h2><label>收件人 Email<textarea id="psReportRecipients" placeholder="可用 Enter 或逗號分隔多個 Email" required></textarea></label><div class="actions"><button class="light" onclick="closeModal()">取消</button><button id="psReportSendConfirm">寄送</button></div><p class="muted" id="psReportSendMessage"></p></div>');document.getElementById('psReportSendConfirm').onclick=()=>{const recipients=[...new Set(document.getElementById('psReportRecipients').value.split(/[\s,;]+/).map(value=>value.trim()).filter(Boolean))];if(!recipients.length||recipients.some(value=>!/^\S+@\S+\.\S+$/.test(value))){document.getElementById('psReportSendMessage').textContent='請輸入有效 Email。';return;}finalizeProjectSiteReport(projectId,report);window.location.href='mailto:'+encodeURIComponent(recipients.join(','))+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);closeModal();};}
async function buildProjectSiteWorkbook(report){
  const Excel=await loadDailyReportExcel(),book=new Excel.Workbook();book.creator='工程管理系統';book.created=new Date(report.createdAt);
  const sheet=book.addWorksheet('工程日報');sheet.columns=[{width:9},{width:17},{width:17},{width:18},{width:18},{width:14}];
  const merged=(text,start=1,end=6)=>{const row=sheet.addRow([]);sheet.mergeCells(row.number,start,row.number,end);row.getCell(start).value=text;return row;};
  const title=merged('工程日報');title.height=36;title.getCell(1).font={name:'Microsoft JhengHei',size:22,bold:true};title.getCell(1).alignment={horizontal:'center',vertical:'middle'};
  merged('工程名稱：'+report.projectName);merged('業主／客戶：'+(report.client||'—')+'　　日期：'+report.date);
  const section=text=>{const row=merged(text);row.height=26;row.getCell(1).font={name:'Microsoft JhengHei',size:12,bold:true};row.getCell(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEEEEEE'}};};
  section('一、現場確認');
  let row=sheet.addRow(['完成','確認事項','','備註','','處理狀態']);sheet.mergeCells(row.number,2,row.number,3);sheet.mergeCells(row.number,4,row.number,5);
  for(const item of report.checks){
    const refs=item.photoIds.map(id=>report.photos.findIndex(photo=>photo.id===id)+1).filter(Boolean);
    const text=item.text+(refs.length?'\n照片 '+refs.join('、'):''),note=(item.note||'—')+(item.issueId?'\n已轉為問題':'');
    row=sheet.addRow([item.done?'☑':'☐',text,'',note,'',item.status]);sheet.mergeCells(row.number,2,row.number,3);sheet.mergeCells(row.number,4,row.number,5);
    row.height=Math.max(30,...[text,note].map(value=>String(value).split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/15)),0)*16+8));
  }
  if(!report.checks.length)merged('未記錄');
  section('二、今日到場');row=merged(report.trades.join('、')||'未記錄');row.height=Math.max(26,Math.ceil(report.trades.join('、').length/40)*18);
  section('三、預約／後續事項');
  for(const item of report.appointments){row=merged(item.date+'　'+item.text+'　'+(item.generatedItemId?'已加入現場確認':'預約'));row.height=Math.max(28,Math.ceil((item.text.length+28)/40)*18);}
  if(!report.appointments.length)merged('未記錄');
  section('四、現場照片');
  for(let i=0;i<report.photos.length;i+=2){
    const imageRow=sheet.addRow([]);imageRow.height=112;
    const captionRow=sheet.addRow([]);let captionHeight=30;
    for(let j=0;j<2&&i+j<report.photos.length;j++){
      const photo=report.photos[i+j],col=j*3+1;sheet.mergeCells(imageRow.number,col,imageRow.number,col+2);sheet.mergeCells(captionRow.number,col,captionRow.number,col+2);
      const caption='照片 '+(i+j+1)+'｜'+(photo.description||'未填說明');captionRow.getCell(col).value=caption;captionHeight=Math.max(captionHeight,Math.ceil(caption.length/22)*16+8);
      const cloud=dailyCloudPhotoURL(photo),blob=cloud?null:await dailyPhotoBlob(report,photo);
      if(cloud){imageRow.getCell(col).value={text:'開啟現場照片',hyperlink:cloud};imageRow.getCell(col).alignment={vertical:'middle',horizontal:'center'};}
      else{
        if(!blob)throw new Error('找不到照片，請先還原照片備份');
        const thumb=await resizeLibraryPhoto(new File([blob],'report.jpg',{type:blob.type}),640,.75),dimensions=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve({width:img.naturalWidth,height:img.naturalHeight});img.onerror=()=>reject(new Error('照片讀取失敗'));img.src=thumb;});
        const scale=Math.min(260/dimensions.width,136/dimensions.height),id=book.addImage({base64:thumb,extension:'jpeg'});
        sheet.addImage(id,{tl:{col:col-1+.08,row:imageRow.number-1+.04},ext:{width:dimensions.width*scale,height:dimensions.height*scale},editAs:'oneCell'});
      }
    }captionRow.height=captionHeight;
  }
  if(!report.photos.length)merged('未記錄');
  merged('紀錄日期 '+report.date+'　｜　製表 '+new Date(report.createdAt).toLocaleString('zh-TW'));
  sheet.eachRow(row=>{if(!row.height)row.height=26;row.eachCell({includeEmpty:true},cell=>{cell.font={name:'Microsoft JhengHei',size:11,...cell.font};cell.alignment={vertical:'top',wrapText:true,...cell.alignment};cell.border={bottom:{style:'hair',color:{argb:'FFDDDDDD'}}};});});
  sheet.pageSetup={paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:1,horizontalCentered:true,margins:{left:.35,right:.35,top:.4,bottom:.4,header:.15,footer:.15}};
  sheet.pageSetup.printArea='A1:F'+sheet.rowCount;
  return book;
}
async function exportProjectSiteExcel(report){
  const book=await buildProjectSiteWorkbook(report),buffer=await book.xlsx.writeBuffer(),blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),filename=(report.projectName+'_工程日報_'+report.date).replace(/[<>:"/\\|?*\x00-\x1F]/g,'_')+'.xlsx';
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);return {blob,filename};
}
async function printProjectSiteReport(report){
  // 同步開啟列印頁，讓手機瀏覽器保留這次使用者點擊的授權。
  const target=window.open('','_blank');
  if(!target){document.getElementById('psReportStatus').textContent='請允許此網站開啟列印視窗後重試。';return;}
  target.opener=null;target.document.body.textContent='正在準備日報與照片…';
  try{
    const urls=await projectSiteReportPhotoURLs(report);if(target.closed)return;
    target.document.open();target.document.write('<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(report.projectName+'_工程日報_'+report.date)+'</title><style>'+PROJECT_SITE_PRINT_CSS+'</style></head><body><div class="print-controls"><button onclick="window.print()">列印／儲存為 PDF</button><p>請於列印視窗選擇「儲存為 PDF」。</p></div>'+projectSiteReportBody(report,urls)+'</body></html>');target.document.close();
    await Promise.all(Array.from(target.document.images).map(img=>img.decode()));if(target.closed)return;target.focus();target.print();
  }catch(error){if(!target.closed)target.document.body.textContent='日報未完成：'+error.message;}
}
