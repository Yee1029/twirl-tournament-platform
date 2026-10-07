# 85°X 賽事管理平台 — MVP v5

## 本版重點

### 👑 主審登入改為 Google OAuth
- 首頁右上角「👑 主審登入」改成「使用 Google 登入」。
- 使用 Supabase Auth + Google OAuth。
- 不再使用舊版 `admin / 1234` Demo 帳密。
- 平台管理員固定為：`yee861029@gmail.com`。
- Google 驗證成功後，系統再檢查是否具有主審資格。

### 權限設計
- `platform_admin`：平台最高管理權限，目前為 `yee861029@gmail.com`。
- `host`：一般主審，之後由平台管理員授權 Google 帳號。
- 裁判：不使用 Google 帳號，仍規劃使用賽事／場地 QR Code 臨時加入。
- 參賽者：不需要登入，使用公開賽事 URL。

### ⚠️ 上線前必做
請先建立 Supabase Project，並在 `supabase-config.js` 填入：
- Supabase Project URL
- Supabase anon/publishable key

不要放 `service_role` key。

### Supabase 後續資料表
正式版預計建立：
- `profiles`
- `user_roles`
- `events`
- `event_hosts`
- `courts`
- `referees`
- `matches`
- `match_scores`

一般主審的資格會從 `user_roles` 判斷，而不是只靠前端寫死 Gmail。

### Google OAuth
在 Supabase Authentication → Providers → Google 啟用 Google Provider，並設定 Google Cloud OAuth Client。
OAuth 回呼網址使用 Supabase Dashboard 提供的 Callback URL；同時將 GitHub Pages 網址加入 Redirect URLs，例如：
`https://yee1029.github.io/twirl-tournament-platform/`

## 目前仍是前端 MVP
賽事資料目前仍使用 localStorage，因此不同裝置還不能真正同步。
下一階段接上 Supabase Database + RLS + Realtime 後，才會成為真正的多人即時賽事平台。
