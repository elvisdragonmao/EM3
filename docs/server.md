# 伺服器版

EM3 有兩個版本，第一次登入時讓使用者選，之後可以在設定頁改：

|                 | 本機版                         | 伺服器版（推薦）                     |
| --------------- | ------------------------------ | ------------------------------------ |
| Moodle 憑證     | 只在這個瀏覽器的 cookie        | 瀏覽器一份，EM3 伺服器加密保存一份   |
| 個人設定        | 只在這台裝置                   | 跨裝置同步                           |
| 課表            | 手動輸入（中正從 Moodle 帶入） | 陽明交大也自動從課綱帶入             |
| 截止提醒        | 沒有                           | 瀏覽器推播、Discord Webhook          |
| 助教協作        | 沒有                           | 分工、「正在批改」提示、排程公布成績 |
| 在 EM3 作答測驗 | 可以                           | 可以                                 |

在 EM3 作答測驗只用到 Moodle 行動版 API，瀏覽器就能直接呼叫，所以兩個版本都有。其他功能需要一個在使用者沒開 EM3 時也能工作、或能讓多人共用資料的地方，所以只有伺服器版有。

本機版跟以前一樣，完全不連 EM3 伺服器。

## 架構

- 同一個 Cloudflare Worker 同時提供靜態檔案和 `/api/*`（`wrangler.jsonc` 的 `run_worker_first`）。程式在 `worker/`。
- 資料放 D1（`migrations/`），每 15 分鐘的 Cron Trigger 跑提醒和排程公布。
- 瀏覽器照舊直接呼叫 Moodle；伺服器只負責上面那些伺服器版功能，不代理一般的 Moodle 請求。

```
瀏覽器 ──Moodle 行動版 API──▶ 學校 Moodle
   │                              ▲
   └──/api/*──▶ EM3 Worker ───────┘（提醒、課綱、排程公布、驗證身分）
                   │
                   └── D1
```

## 身分與憑證

1. 使用者照舊用密碼或單一登入拿到 Moodle 憑證（token）。
2. 伺服器版會把 `{ site, token }` 送到 `POST /api/session`。伺服器只接受 `MOODLE_SITES` 裡的學校，先用這個 token 呼叫 `core_webservice_get_site_info` 確認身分，才建立帳號（以「學校 + Moodle userid」辨識）。
3. token 用 AES-256-GCM 加密後存進 D1，金鑰是 Worker secret `TOKEN_KEY`，資料庫外洩也拿不到 token。
4. 伺服器回一個 `em3_server` cookie（HttpOnly、Secure、SameSite=Lax、90 天）。D1 只存它的 SHA-256。
5. Moodle 回 `invalidtoken` 時，伺服器把帳號標成「需要重新登入」，停止所有背景工作；使用者下次登入時，新的 token 會覆蓋舊的。

- 登出只撤銷這台裝置的 session，提醒照常寄送。
- 設定頁切回本機版會刪掉伺服器上這個帳號的所有資料，包括 token、設定、推播訂閱和 Webhook。

## API

所有回應都是 JSON。錯誤一律是 `{ error: string }` 加上對應的 HTTP 狀態碼。除了 `POST /api/session`，其他都要 `em3_server` cookie。

| 方法與路徑                                                | 用途                                                |
| --------------------------------------------------------- | --------------------------------------------------- |
| `POST /api/session`                                       | `{ site, token }`，驗證後建立或更新帳號，發 session |
| `GET /api/session`                                        | 目前的帳號 `{ site, userid, fullname, tokenOk }`    |
| `DELETE /api/session`                                     | 登出這台裝置                                        |
| `DELETE /api/account`                                     | 刪除伺服器上這個帳號的所有資料                      |
| `GET /api/prefs`、`PUT /api/prefs`                        | 個人設定同步，`{ data, updatedAt }`，較新的贏       |
| `GET /api/nycu/schedules?courses=115-1-515516,…`          | 陽明交大課綱的上課時間代碼                          |
| `GET /api/notify`、`PUT /api/notify`                      | 提醒設定                                            |
| `POST /api/notify/test`                                   | 傳一則測試通知                                      |
| `GET /api/push/key`、`POST /api/push`、`DELETE /api/push` | VAPID 公鑰、推播訂閱                                |
| `/api/grading/*`                                          | 助教協作，見下方                                    |

## 提醒

- Cron 每 15 分鐘，對每個開了提醒、token 有效的帳號呼叫一次 `core_calendar_get_action_events_by_timesort`。這支 API 對學生回「繳交作業」、對助教回「評分」（附待評數量），所以學生和助教的提醒都靠它。
- 使用者可以選提前多久提醒（預設 24 小時和 3 小時）。每個「事件 × 提前時間」只送一次，記在 `sent_notifications`。
- 管道有兩種：
  - **Web Push**：伺服器自己實作 VAPID 與 RFC 8291 加密，不經過第三方服務。
  - **Discord Webhook**：只接受 `https://discord.com/api/webhooks/…` 和 `https://discordapp.com/api/webhooks/…`，加密保存。
- 通知文字依使用者設定的語言。

## 助教協作

需要同一門課的助教都用伺服器版。伺服器每次都用呼叫者自己的 token，以 `core_course_get_user_administration_options` 確認他在這門課能評分，才讓他讀寫這門課的協作資料。

- **分工**：把學生分給各個助教（平均分、依學號區段，或手動）。評分工作台多一個「只看我這組」。
- **正在批改**：在評分工作台打開一位學生時，送出心跳，2 分鐘內沒有心跳就失效。其他助教的名單上會看到「某某正在改」，存檔前也會提醒。
- **排程公布**：在一份作業開啟排程公布後，分數和評語先存在 EM3 伺服器，所有助教都看得到。到了公布時間，伺服器用開啟排程那位助教的 token 呼叫 `mod_assign_save_grades` 一次寫入。回饋檔不能排程（要先上傳到 Moodle），開啟排程時會說明。

## 開發

```sh
pnpm dev          # 前端，/api 代理到 8787
pnpm dev:server   # Worker 與本機 D1（wrangler dev）
pnpm db:migrate   # 套用 migrations 到本機 D1
```

本機 secrets 放 `.dev.vars`（不進版控），用 `node scripts/server-keys.mjs` 產生 `TOKEN_KEY` 和 VAPID 金鑰。正式環境用 `wrangler secret put` 設定同樣的值。
