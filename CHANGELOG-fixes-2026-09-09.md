本次修改僅針對目前根目錄版本；未修改 index.html、原有備份 JSON、data/project-data.json、歷史 stage2／stage3 資料夾與 ZIP。工作區原本已有未提交及未追蹤的檔案，均保留。

**逐項修復**

| 問題 | 修復方式 |
| --- | --- |
| 輸入日期時立即報錯 | 表格日期改為離開欄位時提交。完整日期以格式及年月日回算確認，兩端都完整有效才比較先後。不完整輸入不寫入、不跳先後錯誤；相同日期不重繪。日期 modal 也防止不完整輸入覆蓋已存日期。 |
| 改分類後時間圖未移動 | 時間圖、週檢視及表格統一使用 scheduleGroupName()，讀取原有項目 [9] 分類；沒有明確分類才回退至工種名稱。名稱、分類、日期儲存後重繪。 |
| 工程範例三種檢視 | 新增主頁／以週／以工種分類切換。所有內容均從 data.trades 取得，未建立三份資料；主頁時間圖保留原有 HTML 樣式。共用編輯表保留於下方。修正週日到週一等跨週工程遺漏最後一週的問題。 |
| 新工程工種選擇 | 大工種 checkbox 選取整組；子項仍可個別勾選，部分選取顯示半勾狀態。展開按鈕獨立於 checkbox，展開／收合不改選取。 |
| 建立工程按鈕 | 原程式呼叫不存在的 libraryNextLabel()，導致選取工種後建立中斷。補齊該函式及同樣缺少的 progressNextFor2022()。改用明確 DOM selector 及 form submit，支援表單驗證、儲存失敗提示與重複提交防護。 |
| 預估及實際兩份表 | 建立時複製成 baselineSchedule 獨立深層快照並遞迴凍結；UI 唯讀。現場沿用 steps，各類日期、工種、內容與排序編輯只改現場資料。範例日期以使用者指定開工日平移，保留相對間距與工期；無日期項目預設 1 天。未選工種時仍建立現場確認及兩份獨立表。 |
| 現場確認無法勾選 | 原先只有文字方框。加入真正 checkbox，現場確認與每條注意事項皆可勾選／取消，透過 save() 儲存；重繪及重開仍保留。 |
| 工種庫注意事項 | 工種卡可展開，直接新增／編輯／刪除注意事項。沿用每個來源工種自己的 notes 陣列；表單及刪除確認使用既有 modal。相同名稱但不同來源仍各自保存。 |
| 共用資料污染 | libraryGroups() 原先會將自訂項目 push 到範例原始 items；改為建立獨立檢視容器並保留來源，不再因查看工種庫而修改範例。 |
| 初始化與保存 | 安全儲存層提前至 data.js；照片復原延後到核心及外部資料載入之後，避免 data 尚未初始化即使用。報價改成優先讀取已存資料。備份／還原納入既有獨立工種庫，並相容沒有 library 欄位的舊備份。 |

**修改的函式**

- js/data.js：recoverPhotos（改成初始化後明確呼叫）；另調整頂層安全儲存及報價載入順序。
- js/app.js：backupData、restoreData。
- js/schedule.js：dateObj、timelineHTML、renderWeeklyStages、saveScheduleDates、saveNewScheduleItem、updateScheduleDateInline、exampleScheduleUnsafe。
- js/projects.js：openProject、completeStep、saveStepEdit、delNote、newProject、saveProject。
- js/trades.js：library。
- js/photos.js：libraryGroups、addLibraryTradeNote、editLibraryTradeNote、removeLibraryTradeNote。
- js/init.js：初始化完成後執行照片復原及工程快照初始化。
- css/style.css：只新增工種選取、現場 checkbox、檢視按鈕與折疊標題的局部樣式。

**新增的函式**

- 日期與範例檢視：isCompleteScheduleDate、scheduleDateRangeValid、exampleScheduleTabs、setExampleScheduleView、renderExampleTradeView。
- 工種選取：toggleProjectTrade、selectProjectTrade、syncProjectTradeSelection。
- 工期與快照：localDateISO、shiftScheduleDate、buildProjectSchedule、freezeSchedule、initializeProjectSchedules、openProjectSchedule。
- 現場確認：projectConfirmationHTML、toggleProjectConfirmation、toggleProjectNote。
- 工種庫：rememberLibraryExpanded、openLibraryTrade、saveLibraryTradeNote、deleteLibraryTradeNote。
- 既有缺失入口：progressNextFor2022、libraryNextLabel。

**資料結構**

- 工程新增 baselineSchedule：建立當下深層複製的唯讀陣列；baselineCreatedAt：快照建立時間。
- 現場資料仍以既有 steps 陣列保存。actualSchedule 為不額外序列化的 getter，指向 steps，避免在儲存中再複製一份可變的現場資料。baselineSchedule 與 steps 完全分離。
- 現場工項新增 start／end（原本已支援，現在建立時填入）、siteConfirmed（現場確認）、noteChecks（各注意事項勾選）。刪除注意事項時同步移除對應勾選，避免狀態錯位。
- 工種注意事項沿用 data.trades[index].notes 及 libData[index].notes，各來源、各索引獨立。範例項目陣列欄位及既有 [9] 分類格式均保留。
- 範例檢視、展開狀態與新增表單選擇只屬畫面狀態，未複製工程資料。
- 備份新增 library 欄位，包含原 engineering_library_v1 的內容；原 construction 與 quotes 欄位保持相容。
- 所有持久資料沿用原 localStorage 儲存鍵：construction_v2、engineering_library_v1、quote_management_v1。
- 舊工程沒有歷史預估快照時顯示說明，不以現在的現場資料冒充建立當下快照，也不修改旧工程原資料。

**驗證**

2026-09-09 使用獨立暫存 Chrome profile 實際載入所有 classic scripts，43 項功能測試及 10 項重開後測試通過，無 JavaScript 事件錯誤。另核對相同資料下原版／修改版時間圖 HTML 完全相同，並檢查新增工程表單截圖。

測試包含日期半輸入、無效日期、逆序日期、日期更新圖表、分類移動及改回、名稱改名、三種檢視、跨週、工種父子勾選／收合、建立與重複提交、未選工種、空白表單、預設工期、快照深層隔離、現場排序與內容編輯、確認勾選及取消、舊空工程、注意事項 CRUD／來源隔離、資料重開保留、報價不被初始化覆寫，以及首頁／工程／問題／工法／報價與照片區入口。

完整結果見 [tests/regression-results.txt](tests/regression-results.txt)，表單截圖見 [tests/project-form.png](tests/project-form.png)。測試頁 [tests/regression.html](tests/regression.html) 會寫入測試資料，僅供獨立測試瀏覽器 profile 使用，請勿在存有正式資料的瀏覽器開啟。測試以獨立本機 HTTP 來源執行；重新載入測試使用 ?reload=1。

本次沒有部署到遠端。Google Apps Script 雲端照片上傳／刪除需要實際服務，未做外部寫入測試。
