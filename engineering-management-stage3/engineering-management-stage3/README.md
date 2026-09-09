# engineering-management

第二階段模組化版本。保留原本功能與資料格式，將 JavaScript 按責任拆分。

## 結構
- `index.html`：頁面骨架
- `css/style.css`：樣式
- `js/data.js`：預設資料、報價資料、照片復原資料
- `js/app.js`：核心儲存、導覽、共用工具
- `js/photos.js`：照片與工種庫照片／備註
- `js/trades.js`：工種庫與工程工種管理
- `js/schedule.js`：施工安排、工程進度、時間圖與分類
- `js/projects.js`：工程專案與問題追蹤
- `js/methods.js`：工法／材料資料庫
- `js/init.js`：最後初始化

注意：本版本仍以 classic script 共享全域函式，避免破壞既有 inline onclick；下一階段再逐步移除 inline handler。
