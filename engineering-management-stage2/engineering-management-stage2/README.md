# engineering-management

第二階段：在保留現有功能的前提下，先把 CSS 與資料層從主程式分離。

## 結構
- `index.html`：頁面骨架
- `css/style.css`：樣式
- `js/data.js`：預設工程、報價與照片資料
- `js/app.js`：主要功能邏輯

## 原則
這一階段不改 UI 與功能，只做檔案結構整理。
下一階段再依功能拆分 `schedule.js`、`projects.js`、`trades.js`、`quotes.js`、`photos.js`。
