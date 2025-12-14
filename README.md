# WiseDigitalTwins - 智能倉儲數字孿生平台

一個基於 WebGL 的大型無人倉儲數字孿生展示工具，用於展示貨架布局、AGV 載貨即時動態模擬。

## 功能特點

### 首頁 - 布局管理
- 新增 / 編輯 / 刪除倉儲布局
- 自訂場地尺寸（長 × 寬 × 高）
- 地板以 60cm × 60cm 格子排列
- 預覽圖自動生成
- 資料本地儲存 (localStorage)

### 編輯模式
- **物件類型**：
  - 貨架（可設定寬度、深度、層數）
  - 棧板區（2×2 格子大小）
  - 人工出貨區
  - 設備（立方體 / 圓柱體，可自訂尺寸）
  - 禁止移動區（地面標記）
  - AGV 路線（拖曳繪製）
  - AGV（最多 30 台，自動產生設備參數）
  - AGV 出貨站

- **3D 視角控制**：透視 / 俯視 / 正視 / 側視
- **操作方式**：
  - 從左側面板拖曳或點擊放置物件
  - 滑鼠拖曳旋轉視角
  - 滾輪縮放
- **屬性編輯**：右側面板調整位置、顏色、尺寸等
- **撤銷/重做**：支援最多 10 步歷史記錄
- **圖層控制**：可隱藏 / 顯示特定圖層

### 模擬監控模式
- 時間控制：播放 / 暫停 / 倒帶
- 速度調整：0.5x ~ 5x
- AGV 自動沿路線移動
- 點擊 AGV 查看：
  - 載貨狀態
  - 當前任務
  - 目標位置
  - 電池電量
- 圖層顯示模式：半透明 / 框線 / 隱藏 / 正常

### 快捷鍵
| 快捷鍵 | 功能 |
|--------|------|
| `Ctrl + Z` | 撤銷 |
| `Ctrl + Y` / `Ctrl + Shift + Z` | 重做 |
| `Ctrl + S` | 儲存 |
| `Delete` | 刪除選中物件 |
| `Esc` | 取消路線繪製 |

## 技術架構

### 前端
- **HTML5 + CSS3** - 響應式 UI 介面
- **JavaScript (ES6+)** - 應用邏輯
- **jQuery 3.7** - DOM 操作與事件處理
- **Three.js r128** - WebGL 3D 渲染引擎
  - OrbitControls - 視角控制
  - Raycaster - 物件選取

### 後端
- **Python Flask** - RESTful API 伺服器
- **flask-cors** - 跨域支援

## 專案結構

```
wdt_warehouse_demo/
├── index.html          # 主頁面
├── app.py              # Flask 後端 API
├── requirements.txt    # Python 依賴
├── README.md           # 專案說明
├── css/
│   └── style.css       # 樣式表
├── js/
│   ├── app.js          # 主應用程式邏輯（路由、狀態管理）
│   ├── scene.js        # Three.js 場景管理
│   ├── objects.js      # 3D 物件工廠（貨架、AGV 等）
│   ├── editor.js       # 編輯器功能（放置、選取、撤銷）
│   └── simulation.js   # 模擬引擎（AGV 移動、任務分配）
├── data/               # 資料存儲目錄
├── assets/             # 靜態資源
└── templates/          # 模板目錄
```

## 安裝與執行

### 環境需求
- Python 3.8+
- 現代瀏覽器（Chrome、Firefox、Edge、Safari）

### 安裝步驟

```bash
# 1. Clone 專案
git clone git@github.com:jhk482001/wdt_warehouse_demo.git
cd wdt_warehouse_demo

# 2. 安裝 Python 依賴
pip install -r requirements.txt

# 3. 啟動伺服器
python app.py
```

### 開啟應用
在瀏覽器開啟 http://localhost:8080

## API 端點

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/layouts` | 取得所有布局列表 |
| POST | `/api/layouts` | 建立新布局 |
| GET | `/api/layouts/:id` | 取得單一布局 |
| PUT | `/api/layouts/:id` | 更新布局 |
| DELETE | `/api/layouts/:id` | 刪除布局 |
| GET | `/api/simulation/agvs` | 取得 AGV 狀態（模擬） |
| GET | `/api/health` | 健康檢查 |

## 未來規劃

- [ ] 與實際 AGV 管理系統 API 串接
- [ ] 即時數據推送 (WebSocket)
- [ ] 多用戶協作編輯
- [ ] 匯出 / 匯入布局檔案
- [ ] 熱力圖分析
- [ ] 路徑最佳化演算法

## 授權

MIT License

## 聯絡

WiseDigitalTwins Team
