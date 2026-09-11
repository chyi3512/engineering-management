// 動態產生的按鈕與 modal 表單共用同一個明確的全域入口。
// 不依賴瀏覽器對 classic script 函式的隱式 window 掛載行為。
const APP_EVENT_ENTRY_POINTS=[
  'addLibraryItem','addLibraryTradeNote','addLibraryTradePhoto','addNote','addProjectStep','addScheduleItemToGroup','addTradeItem','addTradeNote','backupData','checkQuotePassword','cleanupScheduleGroups','closeModal','collapseAllTradeSchedules','completeStep','delNote','deleteMethod','deleteScheduleGroup','deleteScheduleItem','editLibraryChecks','editLibraryItem','editLibraryTrade','editLibraryTradeNote','editLibraryTradePhoto','editMethod','editNote','editQuoteItem','editQuoteTitle','editScheduleDates','editScheduleItem','editSchedulePlan','editTradeItem','editTradeNote','editVendorName','exampleLibraryItemDetail','exampleSchedule','home','issues','library','libraryDetailBySource','methods','migrateExistingPhotosToDrive','moveProjectStep','moveQuoteItem','moveScheduleGroup','moveTradeItem','newIssue','newLibraryTrade','newMethod','newProject','newQuoteCategory','newQuoteItem','newQuoteTitle','newVendor','newScheduleItem','openNewScheduleItemForm','openProject','openProjectView','projects','quoteCategory','quoteGate','quoteHome','removeItem','removeLibraryItem','removeLibraryTradeNote','removeLibraryTradePhoto','removeTradeNote','renderMethods','reorderProject','report','restoreData','saveIssue','saveLibraryChecks','saveLibraryItem','saveLibraryTrade','saveLibraryTradeName','saveLibraryTradePhotoEdit','saveLibraryTradePhotos','saveMethod','saveNewScheduleItem','saveNewVendor','saveProject','saveQuoteCategory','saveQuoteItem','saveQuoteTitle','saveScheduleDates','saveScheduleGroupEdit','saveScheduleGroupFromModal','saveSchedulePlan','saveStep','saveStepEdit','saveTrade','saveTradeItem','saveTradeName','saveVendorName','stepDetail','toggleLibraryCheck','toggleTradeSchedule','updateMethod','updateScheduleDateInline','updateScheduleItemGroup','viewProjectLibrarySource'
];
APP_EVENT_ENTRY_POINTS.forEach(name=>{
  if(typeof globalThis[name]==='function')window[name]=globalThis[name];
});

// 分類「編輯」使用事件委派，避免重新渲染工程進度表後 inline onclick 失效。
document.addEventListener('click',function(e){
  const addGroupBtn=e.target.closest ? e.target.closest('[data-action="add-schedule-group"]') : null;
  if(addGroupBtn){
    e.preventDefault();
    e.stopPropagation();
    if(typeof window.addScheduleGroup==='function')window.addScheduleGroup();
    return;
  }
  const btn=e.target.closest ? e.target.closest('.scheduleGroupEditBtn') : null;
  if(!btn)return;
  e.preventDefault();
  e.stopPropagation();
  const idx=parseInt(btn.getAttribute('data-group-index'),10);
  if(Number.isFinite(idx)) window.editScheduleGroup(idx);
},true);


// Render the existing local home immediately, even while cloud requests time out.
home(document.querySelector('nav button'));
Promise.resolve(typeof window.buildFlowCloud==='undefined'?null:window.buildFlowCloud.initialize()).then(async function(){
  if(!window.buildFlowCloud?.authoritative){await loadProjectDataFile();recoverPhotos();}
  initializeProjectSchedules();
  home(document.querySelector('nav button'));
});
