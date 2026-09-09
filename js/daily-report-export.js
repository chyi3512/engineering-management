/* ExcelJS 僅在日報匯出時載入一次；固定版本本機檔，匯出不依賴 CDN。 */
const DAILY_EXCEL_SCRIPT_URL=new URL('vendor/exceljs-4.4.0.min.js',document.currentScript.src).href;
let dailyExcelPromise;
function loadDailyReportExcel(){
  if(window.ExcelJS)return Promise.resolve(window.ExcelJS);
  if(!dailyExcelPromise)dailyExcelPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=DAILY_EXCEL_SCRIPT_URL;
    script.onload=()=>window.ExcelJS?resolve(window.ExcelJS):reject(new Error('Excel 匯出套件未載入'));
    script.onerror=()=>{script.remove();reject(new Error('無法載入 Excel 匯出套件，請確認 js/vendor 檔案完整。'));};
    document.head.appendChild(script);
  }).catch(error=>{dailyExcelPromise=null;throw error;});
  return dailyExcelPromise;
}
function dailyExcelDate(value){return isCompleteScheduleDate(value)?new Date(value+'T00:00:00Z'):null;}
function styleDailyReportSheet(sheet,widths){
  sheet.columns.forEach((column,i)=>column.width=widths[i]||24);
  sheet.views=[{state:'frozen',ySplit:1}];
  sheet.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,sheet.rowCount),column:sheet.columnCount}};
  sheet.eachRow((row,index)=>{
    row.eachCell({includeEmpty:true},cell=>{
      cell.font={name:'Microsoft JhengHei',size:11,bold:index===1,color:{argb:index===1?'FFFFFFFF':'FF222222'}};
      cell.alignment={vertical:'top',wrapText:true};
      if(index===1)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF333333'}};
      else if(index%2===0)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF4F4F2'}};
    });
    if(index===1)row.height=34;
  });
  sheet.pageSetup={paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0};
  sheet.printTitlesRow='1:1';
}
async function buildDailyReportsWorkbook(projectId){
  const project=dailyProject(projectId);if(!project)throw new Error('找不到工程');
  const Excel=await loadDailyReportExcel(),workbook=new Excel.Workbook();
  workbook.creator='工程管理系統';workbook.created=new Date();
  const summary=workbook.addWorksheet('工程日報總表'),photos=workbook.addWorksheet('照片紀錄');
  summary.addRow(['日期','工種','今天工作內容','特記事項','特記事項處理狀態','今日進度','提前/延誤天數','延誤原因','下一工種','預計進場日期','進場前確認']);
  photos.addRow(['日期','工種','照片說明','照片資料/連結','附加於特記事項']);
  for(const report of dailyReportsForProject(projectId)){
    const row=summary.addRow([dailyExcelDate(report.date),report.trades.join('・'),report.workContent,report.issues.map((issue,i)=>(i+1)+'. ['+issue.type+'] '+issue.content+'（'+(issue.trade||'未設定工種')+'）').join('\n'),report.issues.map((issue,i)=>(i+1)+'. '+(issue.resolved?'已處理':'未處理')).join('\n'),report.progressStatus,Number(report.progressDays)||0,report.progressStatus==='延誤'?dailyReportDelayLabel(report):'',report.nextTrade,dailyExcelDate(report.nextTradeDate),report.checklist.map(item=>(item.done?'☑ ':'☐ ')+item.text).join('\n')]);
    row.getCell(1).numFmt='yyyy-mm-dd';row.getCell(10).numFmt='yyyy-mm-dd';row.getCell(7).numFmt='0.0';
    row.height=Math.min(400,Math.max(48,...[report.workContent,...report.issues.map(i=>i.content)].map(text=>Math.ceil(String(text).length/24)*16),report.issues.length*32,report.checklist.length*18));
    for(const photo of report.photos){
      const url=dailyCloudPhotoURL(photo),attachment=report.issues.filter(issue=>issue.photoIds.includes(photo.id)).map(issue=>issue.type+'：'+issue.content).join('\n');
      const photoRow=photos.addRow([dailyExcelDate(report.date),photo.trade,photo.description,url?{text:url,hyperlink:url}:null,attachment]);
      photoRow.getCell(1).numFmt='yyyy-mm-dd';photoRow.height=54;
      if(!url){
        const blob=await dailyPhotoBlob(report,photo);
        if(!blob)throw new Error(report.date+' 有本機照片無法讀取，請還原照片備份後再匯出。');
        const thumb=await resizeLibraryPhoto(new File([blob],'thumbnail.jpg',{type:blob.type}),320,.6);
        const dimensions=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve({width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>reject(new Error('縮圖無法讀取'));image.src=thumb;});
        const scale=Math.min(240/dimensions.width,140/dimensions.height),imageId=workbook.addImage({base64:thumb,extension:'jpeg'});
        photos.addImage(imageId,{tl:{col:3.08,row:photoRow.number-1+.1},ext:{width:dimensions.width*scale,height:dimensions.height*scale},editAs:'oneCell'});
        photoRow.height=120;
      }
    }
  }
  styleDailyReportSheet(summary,[14,22,44,48,22,14,18,30,20,18,36]);
  styleDailyReportSheet(photos,[14,20,44,44,44]);
  return workbook;
}
async function exportDailyReportsExcel(projectId,button){
  if(button?.disabled)return;
  if(button)button.disabled=true;
  dailyReportMessage('正在整理 Excel 與照片紀錄…');
  try{
    const workbook=await buildDailyReportsWorkbook(projectId),buffer=await workbook.xlsx.writeBuffer();
    const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const filename=(dailyProject(projectId).name||'工程').replace(/[<>:"/\\|?*\x00-\x1F]/g,'_')+'_工程日報_'+localDateISO(new Date())+'.xlsx';
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    dailyReportMessage('Excel 已匯出。');return {blob,filename};
  }catch(error){dailyReportMessage('匯出失敗：'+error.message);return null;}
  finally{if(button)button.disabled=false;}
}
