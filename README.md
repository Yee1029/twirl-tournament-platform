# 🌀 陀螺賽事管理平台 MVP

可直接放到 GitHub Pages 的純前端原型。

## 三種角色
- 主審：比賽設定、參賽人數、場地、裁判 QR/加入碼狀態、現場控制塔。
- 裁判：掃 QR 後進入指定場地，按「轉停 +1／爆裂 +2／擊飛 +2／極限 +3」，先達 4 分自動判勝；可撤銷尚未結束的錯誤記分。
- 參賽者：公開頁選擇追蹤玩家，查看完整賽程與自己的路線。

## 目前是 MVP
資料使用瀏覽器 localStorage，因此適合先放 GitHub 展示與驗證 UI/流程；不同手機之間尚未真正同步。QR Code 目前是視覺示意，尚未接 Supabase/Reatime。

## GitHub Pages
把 `index.html`、`styles.css`、`app.js`、`README.md` 上傳到 repository 的 main 分支，Settings → Pages → Deploy from a branch → main / root，即可產生網站。

## 正式版下一階段
建議使用 Next.js/React + Supabase PostgreSQL/Realtime + Vercel，實作真正的多手機即時同步、QR 加入、完整 8/16/32/64/128 淘汰賽引擎、第0輪、Bye、前N名排名戰、主審高權限修正、事件稽核紀錄。
