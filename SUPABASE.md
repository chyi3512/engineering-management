# BuildFlow 第一階段雲端同步

此版本保留 classic scripts、既有頁面、工期計算與巢狀資料。只在頁尾增加「雲端帳號」、「立即同步」與狀態文字，登入使用 Email／密碼。沒有 Realtime、多人合併或 Supabase Storage。

## 部署前設定

1. 在自己的 Supabase 專案 SQL Editor 貼上並執行 **`supabase/phase1.sql` 全部內容**，不必逐段執行。SQL 使用 transaction，建立一張資料表、一個 RPC 與讀取權限；可重複執行，不會刪除既有工程資料。
2. 在 Supabase Authentication 建立自己的 Email／密碼使用者並完成 Email 確認。第一版沒有公開註冊頁面；個人使用可關閉公開註冊。不要把登入密碼放進 Vercel 環境變數。
3. 在 Vercel 建立以下兩個 Environment Variables，設定到實際使用的 Production／Preview 環境，然後由你重新部署：

| Variable | 值 |
| --- | --- |
| `SUPABASE_URL` | `https://你的-project-ref.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase 的公開 publishable key，格式為 `sb_publishable_...` |

只需要這兩個值。不使用 `VITE_`／`NEXT_PUBLIC_` 前綴，不需要 service-role key、secret key、資料庫密碼或 Storage bucket。本版本設定端點拒絕 secret／service-role key，也不接受舊式 anon JWT key；請選用 publishable key。

此專案使用無額外套件的 Node.js scripts，不使用 bundler，也不產生 dist。`npm run build` 檢查 JavaScript 語法、入口資產及 PWA 快取完整性，網站產物仍是根目錄原有檔案。Vercel 使用 Other 靜態專案方式，網站入口為根目錄 `index.html`；`api/cloud-config.js` 是 Vercel Node.js Function，讀取環境變數並僅回傳公開設定。不要把這條 API rewrite 成 index.html，也不要設定不存在的 `dist` 為輸出目錄。

本機使用 Node.js 22.9 以上，於根目錄執行 `npm run dev`，開啟 `http://localhost:3000`。本機伺服器會讀取 `.env.local` 的這兩個變數並執行同一支設定 API，不需要安裝套件或部署。伺服器僅綁定本機，且不提供 `.env.local`、Git 資料或伺服器原始碼的下載；`.env.local` 已由 `.gitignore` 排除。

注意本機網址與原網站的 localStorage 不共用。若要測試既有工程，先在原本使用的網站匯出完整備份，再於本機網站還原、確認資料後登入；不要把新網址的預設空資料誤當成原本工程。真實帳號登入測試會啟動既有同步流程，請使用同一個 Supabase 帳號。

一般靜態 HTTP 伺服器或 `file://` 不會執行 Vercel Function；未設定時會顯示同步失敗，但仍可使用原本本機資料。HTTPS 同源已取得的公開設定會留作離線 fallback，不包含私密伺服器憑證。

## 實際資料表與 SQL

第一版只使用 `public.buildflow_snapshots`，每個 `auth.users.id` 一列。

| 欄位 | 型別與用途 |
| --- | --- |
| `user_id` | UUID 主鍵，對應登入帳號 |
| `payload` | JSONB：四份原有資料的完整快照 |
| `revision` | bigint：單純版本檢查，防止舊副本覆寫新資料 |
| `updated_at` | timestamptz：伺服器儲存時間 |

`payload` 結構：

```json
{
  "version": 1,
  "construction": {"trades": [], "projects": [], "issues": []},
  "library": [],
  "quotes": {"items": [], "vendors": []},
  "equipmentQuotes": {"items": [], "vendors": []}
}
```

上面只是形狀示意，實際儲存完整物件，包含 `construction` 的 methods、scheduleGroups、checklistLibrary、dailyReports，以及每個工程的 steps、baselineSchedule、workflow、siteDays、siteReports、nextSiteConfirmation、communicationItems、siteAppointments、projectReferences 等未知／舊欄位。陣列順序、數字 ID、既有名稱、Checklist 副本與關聯都保留。

RLS 限制使用者只能 SELECT 自己的列。瀏覽器不能直接 INSERT／UPDATE／DELETE，只能呼叫 `buildflow_save_snapshot(p_payload, p_expected_revision)`。RPC 使用經驗證的 `auth.uid()` 決定擁有者，不接受前端傳入 user_id；在單一 SQL 操作內檢查版本並寫入。

SQL 沒有建立 Storage、Realtime publication 或多人權限模型。本次未連線執行 SQL 或修改 Supabase。

## 同步流程

1. 開啟時先顯示原有本機首頁，雲端連線逾時不會使主畫面空白。
2. 未登入時維持本機使用。登入／重新載入時讀取雲端。
3. 雲端 **沒有這個帳號的列**：將四份本機資料上傳；不以空資料取代本機。
4. 雲端 **有有效資料列**：先保留本機備份，再下載為本機 cache。雲端已有資料但 projects 是空陣列，代表有效的空工程清單，不會再灌入預設工程／復原照片。
5. 已綁定裝置若有尚未同步的本機修改：保留本機並嘗試上傳，不直接以雲端覆蓋。伺服器版本不同時停止並顯示錯誤。
6. 既有 `save()`、`saveLib()`、`qsave()`、設備報價儲存與備份還原仍同步寫入 localStorage。統一儲存包裝在成功寫入後標記待同步，約 800ms 合併連續儲存；不更改工程功能的同步儲存／例外處理語意。
7. 上傳進行中若又修改，新修改保持待同步，成功後接著上傳。不做背景合併。
8. 網路、登入過期、缺少 SQL、格式錯誤或權限失敗時，原工作資料保留，頁尾顯示失敗。已登入裝置恢復網路會重試待同步資料；也可按「立即同步」。
9. 手機重新載入／關閉後重新開啟會讀最新雲端。頁面從背景回到前景時，若未在表單／日報／照片編輯中，也會同步；有新的雲端內容時回到更新後首頁。相同內容不改動當前頁面。持續開啟的另一台裝置不會即時接收更新，可按「立即同步」。

同一帳號請盡量一次只在一台裝置編輯，換裝置前等到「已同步」。簡單版本檢查不是多人協作；若版本不同，先用原「備份」匯出本機，再於「雲端帳號 → 下載雲端版本」明確選擇雲端副本。本版不提供自動合併或強制覆蓋雲端。

登出只移除本機登入 session，保留工程 cache 與待同步標記；之後請登入同一帳號。本機資料會記住首次綁定的帳號與 Supabase 專案，避免誤上傳到另一個帳號。這不是供多位使用者共用同一瀏覽器的版本。偵測另一分頁修改 cache/session 時會暫停本分頁同步，提示重新開啟。

## 本機備份與照片限制

四個原本的 localStorage key 保留：`construction_v2`、`engineering_library_v1`、`quote_management_v1`、`equipment_quotes_v1`。下載會更新其 cache 值；替換前保留原副本，不刪除整個 localStorage 或 IndexedDB。

新增 localStorage：`buildflow_cloud_meta_v1`（帳號／版本／待同步／內容指紋）、`buildflow_cloud_session_v1`（登入與更新 token）、`buildflow_cloud_config_v1`（公開設定）。指紋使用 SHA-256，比對時排序物件鍵但不排序陣列。

替換前副本存放於新的 **IndexedDB `buildflow_cloud_backups_v1` → `snapshots`**：

- `initial:<user-id>`：第一次同步前副本，只建立一次。
- `before-download:<user-id>`：最近下載前的工作副本。
- `manual:<timestamp>:<user-id>`：使用者主動下載前另存副本。

這個 DB 和原日報照片 DB 完全分開，避免含 Base64 的工程副本擠滿 localStorage。備份建立失敗時不取代本機資料。必要時可在瀏覽器開發工具 Application → IndexedDB 檢視副本；平常請使用原備份按鈕匯出 JSON。本次也補上既有 JSON 備份／還原漏掉的設備報價欄位，舊備份仍可讀取。

**照片程式完全未改動：**

- JSON 內原有 Base64、Google Drive URL、storage／driveId 與照片中繼資料會隨原物件原樣保存。
- `engineering_daily_report_photos_v1` 的 Blob **沒有上傳**。另一台裝置可能看到照片紀錄，但無法顯示只存在原裝置的圖片。
- 預設工種照片不會重新補進已下載的雲端快照。
- 完整照片備份繼續使用原 JSON 匯出流程；不把本機圖片標成已搬到 Supabase Storage。

## 驗證

```powershell
node tests/cloud-sync-test.cjs
node tests/cloud-config-test.cjs
node tests/checklists-test.cjs
node tests/pwa-sw-test.cjs
node tests/pwa-test.cjs
node tests/cloud-browser-test.cjs
node tests/cloud-browser-test.cjs --baseline
```

雲端測試使用模擬 HTTP 回應、真實 Chrome 及獨立暫存瀏覽器 profile，不碰實際 Supabase 或使用者瀏覽器。`--baseline` 唯讀取 Git HEAD 的原儲存／啟動檔案，重跑既有測試以區分原有失敗。

目前 Workflow 20 項、日報 create/edit/verify/mobile 80 項、Checklist UI 16 項、Checklist 單元測試、PWA 及 18 組新同步情境測試通過。新版登入／同步另以真實 Chrome 驗證。以下兩個舊測試在修改前 HEAD 與修改後皆同樣失敗，本次沒有修改其頁面或測試斷言：

- `tests/regression.js:62`：點擊現在不存在的 `.project-check input`，create 中止，因此後續 reload 沒有可用的完整 fixture。
- `tests/project-site-test.html`：沒有載入 `workflow.js`，建立工程時 `buildProjectWorkflow is not defined`，後續 reload/mobile 未執行。

可執行 `npm run build` 與 `npm test`。目前已使用 `.env.local` 的真實公開設定，唯讀確認 Auth settings 回應 200、Email 登入啟用，snapshot 匿名讀取回應 401／42501。沒有使用真實帳號登入或寫入雲端工程；完整真實帳號讀寫與兩台實機驗收仍需登入後完成。Chrome 同步測試使用模擬 Supabase API，不代表正式帳號讀寫已驗證。

官方介面參考：[Supabase REST API](https://supabase.com/docs/guides/api)、[Auth API 定義](https://github.com/supabase/auth/blob/master/openapi.yaml)、[Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js)。
