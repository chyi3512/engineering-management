# PWA 安裝與部署

將目前整個網站（包含 `sw.js`、`manifest.webmanifest`、`icons/`、`css/pwa.css`、`js/pwa.js`）部署在原有的 HTTPS 網址。支援網站根目錄或子目錄，不需更換資料格式或伺服器 API。Manifest、圖示及 Service Worker 必須可直接存取，不能被登入頁或 HTML fallback 取代；`sw.js` 應使用 JavaScript MIME type。

- iPhone：用 Safari 直接開啟網站 → 分享 → 加入主畫面；如有「以網頁 App 開啟」，保持開啟。
- Android／桌機 Chrome：開啟網站，使用瀏覽器提供的「安裝」／「加入主畫面」。網站未增加安裝彈窗或新導覽。
- 第一次需連線成功載入；之後程式檔可在斷線時從快取啟動。工程資料仍由原本本機儲存讀取；外部照片、雲端功能與未快取的資料仍需網路。
- `file://`、一般區網 HTTP 或被嵌入的 iframe 不提供這次的 PWA 註冊；本機測試可使用 `http://localhost` 或 `http://127.0.0.1`。原本頁面功能仍可按既有方式啟動。

## 既有資料

這次沒有更動 localStorage、IndexedDB、儲存鍵或備份／還原格式。相同瀏覽器與相同 origin 的既有資料繼續沿用。

iPhone 主畫面 App 可能與 Safari 分開保存網站資料，不能保證安裝後自動帶入 Safari 的本機紀錄。先使用現有「備份」，在主畫面 App 使用既有還原入口帶入。更換網域、協定或連接埠也不會自動搬移本機資料。這次沒有加入資料遷移或同步程式。

## 更新

部署程式檔更新時，同步更新 `sw.js` 的 `VERSION`；若更動檔名或 query 版本，同步更新 `SHELL`。建議 `sw.js` 使用 `Cache-Control: no-cache`。程式優先連線取得內容，斷線才使用快取；新版 Worker 等所有舊頁面關閉後自然啟用，不強制重新整理正在編輯的畫面。只清除此網站 PWA 自己的舊版程式快取，不清除使用者資料。

## 驗證

```text
node tests/pwa-sw-test.cjs
node tests/pwa-test.cjs
node tests/checklists-test.cjs
```

瀏覽器測試使用隔離的 Chrome profile 與 localhost 測試資料，覆蓋可安裝性、工程新增／編輯、Checklist、報價、重載保存、離線啟動、390px 手機版、桌機導覽及子目錄部署。可在第二個指令後傳入 Chrome 執行檔路徑。

iPhone Safari 的實機加入主畫面、狀態列及瀏海／底部手勢區，仍需在部署後用實機確認；桌機模擬不等同 iOS 實機驗證。

參考：[Apple 安裝說明](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios)、[Apple Web App 儲存隔離說明](https://developer.apple.com/videos/play/wwdc2023/10120/)、[Service Worker 安全環境要求](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)。
