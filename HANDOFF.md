# Shift & Wage App — 專案交接文件

給下一個 session 接續使用。這份文件記錄「為什麼這樣做」跟「目前做到哪」,程式碼本身看 git diff / 檔案內容即可,這裡不重複。

## 背景與動機

使用者(前端工程師,第一次寫 App,主要用 iOS)目前用三個 App:
- **TimeTree**:共編行事曆,排一般行程
- **Shifta**:記錄兼職排班 + 自動算月薪,介面陽春但好用、沒有匯出/同步功能
- **TickTick**:自訂 Eisenhower Matrix 待辦清單,免費版不夠用、付費太貴

**核心痛點**:要跟別人確認哪天有空,得分別打開 TimeTree 跟 Shifta 兩個 App 確認,想要一個畫面看到所有行程。TickTick 的付費牆問題其實跟日曆整合無關,是獨立需求。

**決定**:自己寫一個側專案(练習 App 開發),保留 Shifta 的簡單易用,先做優化版排班+薪資工具,之後再疊加日曆整合。

## 產品規劃(分階段)

- **Phase 1(現在在做)**:類 Shifta 優化版 — 排班登記 + 薪資試算,純本機儲存,無後端,無帳號系統
- **Phase 2**:日曆整合 — 用裝置原生日曆(iOS EventKit,透過 `expo-calendar`)讀取 TimeTree 同步進來的行程,疊加顯示自己的排班。**前提**:需先確認使用者的 TimeTree 有沒有開「同步到手機行事曆」的設定。**不走** TimeTree 官方 API(申請門檻/開放程度不確定,且裝置日曆同步不依賴 TimeTree API 是否存在,更穩)
- **Phase 3**:持續優化 Shifta 覺得簡陋的地方(彈性加給規則、月度報表)
- **Phase 4(可選)**:Eisenhower Matrix 待辦模組,獨立功能,取代 TickTick 付費功能,不跟日曆/薪資邏輯掛鉤

## 技術棧決策

- **框架**:Expo (React Native) + TypeScript,用 `expo-router` 做路由(選這個是因為對前端工程師從 React/Next.js 過渡最平滑,原生模組不用碰 Xcode)
- **本機資料庫**:`expo-sqlite` + `drizzle-orm`(關聯式資料模型比 AsyncStorage/JSON 更適合 Shift 關聯 WageRule 的結構,Drizzle 型別安全,學習曲線低)
- **狀態管理**:`zustand`(狀態不複雜,不需要 Redux)
- **表單**:`react-hook-form` + `zod`
- **月曆 UI**:`react-native-calendars`
- **日期時間**:`date-fns`(處理跨夜班、月薪週期計算)
- **未來雲端(只有真的需要多裝置同步才做)**:優先選 Supabase 而非 Firebase,因為底層 Postgres 貼合現在的關聯式 schema,遷移成本低

## 資料模型(已規劃,尚未寫進程式碼)

```
Shift(班次)
├─ id
├─ date          排班日期
├─ startTime     開始時間
├─ endTime       結束時間(需處理跨夜,例如 23:00–06:00)
├─ wageRuleId    關聯的薪資規則
├─ note          備註

WageRule(薪資規則)
├─ id
├─ jobName       工作名稱(支援多份兼職)
├─ baseRate      基本時薪
├─ nightRate     深夜加給倍率(可選,開關控制是否啟用)
├─ nightStart / nightEnd  深夜時段
├─ holidayRate   假日加給百分比(可選,開關控制是否啟用)
```

薪資試算要寫成獨立、可單元測試的純函式(輸入 Shift + WageRule,輸出金額),不要跟 UI 耦合。

## UI Mockup 決策(已用 visualize 工具互動展示給使用者看過,決議定案,但沒有存成圖檔,只有這份文字記錄)

**風格**:日系暖色調 — 珊瑚橘 `#D85A30` 系列為主色(對應「排班」)、莓粉 `#993556` 系列識別 TimeTree 同步事件、大圓角卡片(16px)、圓形圖示徽章、底部分頁選中時用膠囊底色。文字全部中文。

已定案的畫面與關鍵互動:

1. **月曆首頁**:月曆格子上排班(橘點)跟 TimeTree 事件(粉點)疊加顯示,今天日期特別標示,點某天展開當天清單
2. **新增/編輯班次**:選工作(帶出對應薪資規則)、日期、起訖時間、備註;結束時間必須晚於開始時間,否則顯示錯誤擋下
3. **薪資規則設定**:清單頁(每份工作一張卡片,顯示基本時薪 + 已啟用的加給規則標籤)+ 新增/編輯表單(深夜加給、假日加給各自用開關切換啟用/停用,關掉時欄位變灰停用,不是刪除規則本身)
4. **薪資總覽**:當月總工時 + 預估薪資兩個大數字卡,下面依工作分類拆算列表
5. **班次詳情/編輯(點月曆某天)**:列出當天所有項目——自己的班次(可點擊進編輯)+ TimeTree 同步進來的事件(唯讀,標示鎖頭圖示,並提示「請在 TimeTree 編輯」,不能反向寫回 TimeTree);編輯頁即時算出這班的預估薪水;刪除要先跳二次確認對話框,不能一鍵刪除

**尚未做 mockup 的畫面**:App 總設定頁(深色模式、原生日曆同步授權、通知)、Eisenhower 矩陣(Phase 4)、首次使用引導/空狀態畫面。

## 環境備忘

- **環境**:這台機器 Node.js v24.19.0 / npm 11.17.0 已裝在 `C:\Program Files\nodejs`,但沒在系統 PATH 裡,新開的 terminal/shell 抓不到。**每次跑指令前記得先** `$env:PATH = "C:\Program Files\nodejs;" + $env:PATH`(PowerShell)。
- **專案位置**:`D:\projects\shift-wage-app`。⚠️ 注意:`D:\projects` 本身是一個既有的 git repo,裡面還放了其他不相關的專案(cpu-reball-system、iceberg、jg-repair-system、recallanalysissystem)。建立 Expo 專案時系統詢問是否要在裡面重新 init 一個新 git repo,選擇了**否**(沿用外層既有 repo)。另外這個外層 repo 目前有大量跟本專案無關的未提交異動(屬於 recallanalysissystem 的檔案),**沒有去動它**,以後在這個目錄下操作 git 要小心別牽動到不相關的檔案。
- **⚠️ 不要跑 `npm run reset-project`**:這是 create-expo-app 內建的腳本,會把整個 `src/`(所有畫面、資料層、薪資邏輯)搬到 `example/` 資料夾換成空白畫面。今晚遇到建置錯誤時一度考慮用它「重來」,但問題其實都是建置工具設定,不是元件寫錯,已經全部修好,**不需要也不要重置**。

## 已完成(2026-08-17,今晚全部四個畫面都做完並且在網頁預覽驗證過)

- ✅ `src/db/schema.ts` / `src/db/client.ts`:Drizzle schema(`wageRules`、`shifts`)+ 手機端用 `expo-sqlite` 的 client。
- ✅ `drizzle.config.ts` + `drizzle/migrations.js`(`npm run db:generate` 產生),並且**已經接上** `_layout.tsx` 的 `useMigrations`,App 啟動時會真的建表。
- ✅ `src/lib/wage.ts`:`calculateShiftHours`、`calculateShiftWage`、`calculateMonthlyWage` 三個純函式,處理跨夜班 + 深夜加給跨夜比對 + 假日加給開關。**已補上自動化測試**:`scripts/wage.test.ts`,9 個案例(一般班、跨夜不開深夜加給、跨夜全段深夜、部分深夜、班次與深夜時段都跨夜、假日加給開/關、月加總)全部通過,執行 `npm run test:wage`。專案沒裝 jest,用 `tsx` 直接跑純函式測試,夠用且輕量。
- ✅ `src/components/app-tabs.tsx`:改用標準 `Tabs`(from `expo-router`)+ `Ionicons`(`@expo/vector-icons`),四個分頁:月曆(`index`)/新增(`add-shift`)/薪資(`wage`)/設定(`settings`)。`app-tabs.web.tsx`(網頁版用 `expo-router/ui` 的自訂膠囊分頁列)同步更新成一樣四個分頁 + icon。
- ✅ 四個畫面全部建好:
  - `src/app/index.tsx`:月曆首頁,`react-native-calendars` 顯示有排班的日子(橘點),點日期展開當天班次清單,長按班次跳確認對話框刪除。
  - `src/app/add-shift.tsx`:新增/編輯班次,選工作(橫向 chip,從薪資規則清單帶出)、日期(內嵌 `Calendar` 選)、起訖時間(文字輸入 `HH:mm`)、備註,即時預估這班薪資,editing 模式下可刪除(二次確認)。
  - `src/app/wage.tsx`:薪資總覽,月份切換 + 當月總工時/預估薪資兩個大數字卡 + 依工作拆算列表。
  - `src/app/settings.tsx`:薪資規則清單(卡片顯示已啟用的加給標籤)+ 新增/編輯表單(深夜/假日加給各自開關控制,關閉時欄位變灰)。
  - 舊的 demo 畫面/元件(`explore.tsx`、`collapsible.tsx`、`hint-row.tsx`、`web-badge.tsx`、`external-link.tsx`)已刪除,確認沒有其他地方在用。
- ✅ `src/store/data-store.ts`:zustand store,包 `db` 的 CRUD(`refresh`/`addShift`/`updateShift`/`deleteShift`/`addWageRule`/`updateWageRule`),四個畫面都是透過這個 store 讀寫,沒有直接碰 `db`。
- ✅ `npx tsc --noEmit` 乾淨,只剩一個跟今晚工作無關的既有小問題(`src/components/animated-icon.tsx:142` 的 `StyleSheet.absoluteFill` spread 型別警告,是 splash 動畫元件,不影響執行,沒有動它)。

### 建置工具踩坑記錄(2026-08-17,已解決,之後不要重複排查)

今晚花最多時間的不是畫面邏輯,是讓 Metro/Babel 認得 `drizzle-kit` 產生的 migration 檔、以及讓 `expo-sqlite` 能在網頁預覽上跑,依序踩到:

1. **`drizzle/migrations.js` 直接 `import` `.sql` 檔內容**,Metro 預設會把它當 JS 解析,語法錯誤(`Missing semicolon`)。解法:裝 `babel-plugin-inline-import`,在 `babel.config.js` 設定 `plugins: [['inline-import', { extensions: ['.sql'] }]]`,並在 `metro.config.js` 把 `sql` 加進 `resolver.sourceExts`。**專案原本沒有 `babel.config.js`,自訂時必須額外裝 `babel-preset-expo` 這個 devDependency**,否則 Metro 會報 `Cannot find module 'babel-preset-expo'`。
2. **`expo-sqlite` 網頁版**用 `wa-sqlite`(WASM)實作:
   - 需要把 `wasm` 加進 `metro.config.js` 的 `resolver.assetExts`,否則 Metro 找不到 `.wasm` 檔。
   - 需要瀏覽器開啟「跨來源隔離」才有 `SharedArrayBuffer`,在 `metro.config.js` 的 `server.enhanceMiddleware` 幫每個回應加上 `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` 這兩個 header 才會有。
   - 就算上面都設好,**`expo-sqlite` 的 WASM worker 在開發伺服器上還是常常 `Sync operation timeout`**,不穩定到無法拿來做網頁預覽——這是套件本身在瀏覽器環境的已知限制,跟我們的程式碼無關,**手機上走原生 SQLite 完全不受影響**。
3. **最終解法**:新增 `src/db/memory-db.ts`,只在 `Platform.OS === 'web'` 時啟用(`src/db/client.ts` 用 `isMemoryDb` 判斷分流)。用 `drizzle-orm/sqlite-proxy` 攔截 drizzle 產生的 SQL 文字,對照本專案唯一會用到的四種查詢型態(單表 SELECT * / INSERT / 依 id UPDATE / 依 id DELETE),資料存在記憶體陣列裡。**這不是通用 SQL 引擎,只覆蓋 `data-store.ts` 實際用到的查詢**,重新整理或重啟開發伺服器資料就會清空。手機上的正式版本完全不會走到這個檔案。`_layout.tsx` 也對應改成 `isMemoryDb` 時跳過 `useMigrations`(記憶體資料庫不需要 migration)。
   - 相關新增/修改檔案:`src/db/memory-db.ts`(新)、`src/db/client.ts`、`src/app/_layout.tsx`、`metro.config.js`、`babel.config.js`。
   - 新增 devDependencies:`babel-preset-expo`、`babel-plugin-inline-import`、`tsx`。新增 dependency:`@hookform/resolvers`(react-hook-form + zod 用)。
4. 今晚只在網頁預覽(`npm run web`,`http://localhost:8081`)驗證過四個畫面能跑、能點、能新增/編輯/刪除——**手機上的 Expo Go 實測還沒做**(使用者今晚不方便用手機),下一次有手機時務必實測一次,理論上因為手機走的是完全不同的 `expo-sqlite` 原生路徑 + 真正的 migration,邏輯應該一致,但沒有實測過不能打勾。

## Expo SDK 版本 & Expo Go 相容性問題(2026-08-17 排查並解決)

- **問題**:專案原本用 `create-expo-app` 建立時裝的是 **SDK 57**,但手機 App Store/Play Store 上的 Expo Go **從 2026 年 5 月起卡在 SDK 54**(Apple/Google 審核流程延遲,Expo 新版本一直沒過審),導致手機打不開專案、又沒有「更新」按鈕可以按(因為店家根本沒有更新版本可放)。iOS、Android 兩邊的官方商店都受影響,不是只有 iOS。
- **解法**:把整個專案降版對齊 SDK 54。已完成:
  - `package.json` 裡 `expo` 改成 `~54.0.0`,移除了未使用到的 SDK57 專屬套件(`@expo/ui`、`expo-glass-effect`)
  - 刪掉 `node_modules`/`package-lock.json` 重新 `npm install`,再跑 `npx expo install --fix` 讓 Expo CLI 自動把 `react`(19.1.0)、`react-native`(0.81.5)、`react-native-reanimated`(~4.1.1)、`react-native-screens`、`react-native-gesture-handler`、`react-native-worklets`、`typescript` 等全部對齊到 SDK 54 相容版本
  - 用 `npm run start:tunnel` 起了一次 Metro,確認沒有 SDK 版本相關的錯誤,降版本身是成功的
- **參考來源**:[Expo Go and the App Store in May 2026](https://expo.dev/changelog/expo-go-and-app-store-may-2026)

## 公司網路會封鎖 ngrok tunnel(2026-08-17 排查發現,重要,之後不要重複排查)

- 使用者在公司內網環境,原本 LAN 模式連不上手機(疑似 Wi-Fi AP 隔離),改用 `expo start --tunnel` 時又跳出 `CommandError: ngrok tunnel took too long to connect.`
- **排查結果**:用 `Test-NetConnection` 測試發現 `ngrok.com`、`tunnel.us.ngrok.com` 這兩個網域,在公司網路的 DNS 解析下都指向 `127.0.0.1`——這是**公司網路刻意做的 DNS sinkhole 封鎖**,不是網路不穩或防毒軟體誤擋,而是主動擋掉 ngrok 服務。
- **結論**:在公司網路底下,`expo start --tunnel` 這條路走不通,重試沒有用,**不建議**為了個人 side project 去申請 IT 把 ngrok 加白名單。
- **可行的替代方案**:
  1. 換一個非公司網路環境(例如回家用 LAN 模式 `npm start`,不用 tunnel)
  2. 手機熱點(需使用者先跟公司 IT/資安確認是否符合政策,尚未確認)
  3. 在公司環境時,先專注在看不到手機畫面也能做的部分(資料層、純函式邏輯、單元測試),UI 驗證留到方便連手機的環境再做

## 尚未實作/做過的取捨(下一個 session 接續前務必看過)

今晚做四個畫面時,有幾個地方原本的規劃文件沒寫清楚,自己做了合理的簡化取捨,**跟使用者確認過沒有明確反對,但沒有正式定案**,之後有空應該再跟使用者對一次:

- **假日加給目前是「死開關」**:`WageRule` 還留著 `holidayRateEnabled`/`holidayPercent` 欄位跟設定畫面的開關,但 `shifts` 表已經沒有 `isHoliday` 欄位(使用者自己動手拿掉的),`wage.tsx` 算月薪時**永遠不會套用假日加給**,因為沒有任何地方標記某天是假日。要恢復這個功能,得先決定假日判斷方式(手動勾選 vs. 自動判斷週末 vs. 接國定假日 API),對照 Phase 3「彈性加給規則」再處理。
- **跨夜班沒有獨立開關**:`add-shift.tsx` 用「結束時間 ≤ 開始時間就自動視為跨夜到隔天」,只擋掉「結束時間跟開始時間完全相同」這種輸入錯誤,沒有做成另外一個「跨夜」勾選框。跟 mockup 文件寫的「結束時間必須晚於開始時間,否則顯示錯誤擋下」字面上有出入,但配合 `wage.ts` 本來就是跨夜自動偵測的設計,這樣做比較一致。
- **刪除班次是長按 + 二次確認對話框**,不是獨立的垃圾桶圖示,跟 mockup 提到的互動細節沒有完全對應,但同樣有做到「不能一鍵刪除」的要求。

## 下一步 TODO(接續 session 從這裡繼續)

1. **用手機 Expo Go 實測今晚做的四個畫面**(目前只在網頁預覽驗證過,見上面「建置工具踩坑記錄」第 4 點)。
2. 跟使用者對一次上面「尚未實作/做過的取捨」那三點,決定要不要調整。
3. 確認四個畫面串完、手機測過沒問題後,再進 Phase 2:確認使用者的 TimeTree 有沒有「同步到手機行事曆」設定,決定要不要串 `expo-calendar`。

## 開發環境備忘

啟動開發伺服器(需要 Expo Go App 或模擬器,現在已對齊 SDK 54,跟 App Store/Play Store 版 Expo Go 相容):
```bash
cd D:\projects\shift-wage-app
npm run web             # 網頁預覽(用記憶體資料庫,見上面踩坑記錄),今晚都是用這個測試畫面
npm run start           # 同一區網(不建議在公司網路用,AP 隔離連不上)
npm run start:tunnel    # 跨網路(不能在公司網路用,ngrok 被 DNS 封鎖;家用網路可以)
npm run ios             # 需要 macOS 才能跑模擬器,這台機器沒有 Mac
npm run android
npm run test:wage       # 跑 src/lib/wage.ts 的測試案例
```
這台機器每次開新的 PowerShell/終端機,記得先跑:
```powershell
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
```
Node.js 才會被找到(裝在 `C:\Program Files\nodejs`,但沒加進系統 PATH)。
