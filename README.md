# engineering-management

第一階段重構：只把原本單一 HTML 的 CSS / JavaScript 拆出，功能與資料結構不主動修改。

- `index.html`：頁面 HTML
- `css/style.css`：原本 HTML 內的全部 CSS（保留原順序）
- `js/app.js`：原本 HTML 內的全部 JavaScript（保留原順序）
- 工程資料 JSON 備份請由使用者自行放入專案目錄，不納入程式碼修改。

後續再將 `app.js` 安全拆成 data / schedule / projects / trades / quotes / photos 等模組。
