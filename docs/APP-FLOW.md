# App 使用流程規範

這份文件記錄目前三個分頁的完整邏輯規範,給接續開發/測試時對照用。資料模型細節見 `HANDOFF.md`;這裡專注在「每一頁做什麼、怎麼互動」。

**重要**:這份文件混合了「已實作」跟「已定案但還沒實作」的內容,每個章節開頭都會標明狀態,不要假設全部都對應目前的程式碼。跟外層專案根目錄的 `README.md`(使用者手寫的規劃筆記)對照時,以 `README.md` 為最新決策來源。

## 整體結構

三個底部分頁,固定順序:**今日 → 統計 → 設定**。全部是一般的 `expo-router` 路由畫面,沒有分頁是「觸發彈窗、不導航」的特例。

---

## 1. 今日 Tab(`src/app/index.tsx`)—— ✅ 已實作

**用途**:看月曆、瀏覽/建立/編輯/刪除班次,有「瀏覽」跟「排班」兩種模式。

**共用邏輯**:
- 模式、日期、各個 sheet 的開關狀態都存在 `src/store/ui-store.ts`(`todayMode`、`selectedDate`、`schedulingDate`、`dayDetail`、`deleteModeActive`、`editingShiftId`),不是畫面 local state。
- 有排班的日期在月曆格子上顯示橘色點(`dotColor: theme.primary`),休息日標記顯示灰色點(`theme.textSecondary`)。

### 瀏覽狀態(預設)

- 全螢幕行事曆 + 右下角懸浮圓形按鈕(`fab`,`theme.primary` 底色、白色 `add` icon)。
- 點懸浮按鈕 → `enterSchedulingMode()`,切換進排班狀態(同時把 `schedulingDate` 重置成當月 1 號)。
- 點月曆上任一天 → `setSelectedDate` + `openDayDetail(date)`,彈出 `src/components/day-detail-sheet.tsx`。
- `DayDetailSheet`:半截、可透過點背景或「返回」按鈕關閉。列出當天所有班次(含休息日標記),header 有「返回」+「刪除」(切換 `deleteModeActive`)。刪除模式開啟後每筆項目多一個垂圾桶圖示,點下去**直接刪除,不跳確認對話框**。點項目本身(非刪除圖示)→ `openShiftEdit(shiftId)`,疊一層 `src/components/shift-edit-sheet.tsx` 在上面。
- `ShiftEditSheet`:依這筆 `Shift` 有沒有 `shiftTypeId` 分兩種表單——有 → 只能改起訖時間/備註/國定假日/手動覆寫金額;沒有(手動輸入的臨時班次) → 整套欄位都能改(工作地點/時間/薪資/休息/加給)。都有刪除按鈕,直接刪除不用二次確認。

### 排班狀態

- 上方行事曆(`current` 綁 `schedulingDate`,點其他日期只換目標日期、不退出排班狀態)+ 下方 `src/components/scheduling-sheet.tsx`,**常駐、不可點背景或下滑關閉**,只能點 sheet 內的「退出」按鈕離開(`exitSchedulingMode()`)。
- Sheet 內容(local state `panel: 'list' | 'manual' | 'newShiftType'` 切換):
  - **班別清單**(依工作地點分組):點一項 = 立即 `addShift` 建立班次到 `schedulingDate`,並呼叫 `advanceSchedulingDate()`(+1 天),不跳確認。
  - **休息日**選項:建立 `isRestDay: true` 的 shift(不綁班別、無時間),同樣自動跳下一天。
  - **手動輸入**:展開內嵌表單(工作地點選填 chip、起訖時間、基本薪資、休息時間+計薪開關、深夜/假日加給開關、國定假日勾選、手動覆寫金額),送出後建立班次 + 跳下一天 + 收合回清單。
  - **新增班別**:展開精簡版 `ShiftType` 表單(選工作地點、名稱、起訖時間、休息時間、深夜/假日加給),建立後回到班別清單,不離開排班狀態。

### 計薪邏輯(現行實作,見 `src/lib/wage.ts` + `src/lib/resolve-shift-wage-input.ts`)

任何一筆 `Shift` 要算錢,先跑 `resolveShiftWageInput`:
1. `isRestDay` 或缺起訖時間 → 回傳 `null`,呼叫端跳過不計算。
2. `manualWageOverride` 有填 → 直接用這個數字。
3. 有 `shiftTypeId` → 依對應 `Workplace.wageType`(月薪/日薪/時薪)三選一分流取得薪率/休息/深夜/假日規則,月薪不計逐班金額。
4. 沒有 `shiftTypeId`(手動輸入) → 直接用 `Shift` 自己存的欄位,一律走時薪公式,跟 `Workplace.wageType` 無關。

工時計算:先處理跨夜(結束 ≤ 開始視為隔天),深夜加給依重疊分鐘數算,不計薪休息時間優先扣一般時段、扣完才反扣深夜時段。假日加成要「規則開關開」且「這筆班次勾了國定假日」兩者同時成立才套用。

⚠️ 這一節已經跟目前 `schema.ts`/`resolve-shift-wage-input.ts` 的最新版本同步(`wageType` 三選一在 `Workplace` 上,`ShiftType` 沒有獨立的 `isFullDay` 開關),如果之後 schema 再變動記得回來更新這裡。

---

## 2. 統計 Tab(`src/app/wage.tsx`)—— ✅ 已實作

**整體結構**:`wage.tsx` 只是一個 `viewMode: 'hours' | 'payday'` 的雙按鈕切換殼,實際內容都在子元件:
- `src/components/hours-report-view.tsx` —— 工時統計
- `src/components/payday-calendar-view.tsx` —— 發薪日曆
- `src/components/job-detail-view.tsx` —— 逐日明細(兩個模式共用同一個元件,只是傳進去的 `rangeStart`/`rangeEnd`/`workplaceKey` 不同)
- `src/components/report-template-form.tsx` —— 新增自訂範本

### 工時統計(`HoursReportView`)

- 時間範圍 chips:週/雙週/月/年/自訂(自訂是兩個 `YYYY-MM-DD` 文字輸入框,`parseISODateInput` 驗證格式,輸入到一半或無效字串會 fallback 成當月,不會讓 `date-fns` 的 `format()` 對無效 `Date` 噴錯炸頁)。非自訂用左右箭頭切換錨點日期(`shiftAnchor`)。
- 工作範圍 chips 可多選,「全部工作」是 `workplaceIds === null` 的特例。
- 摘要區塊(`showSplit` 範本設定控制顯示與否,不分的話只顯示單一「總計」卡):
  - **未來總計**:整個選定範圍(不分過去/未來)全部加總——這個日期區間總共可以領到多少。
  - **截至今日**:以今天為界(`isShiftCompleted`)算到今天為止的薪水/工時/出勤天數;月薪工作不參與這個拆分,固定算進這裡(包括日期是未來的月薪班次,連出勤天數也算進來)。
  - ⚠️ 原本規劃另外一個獨立的「未來/預估」卡片已經拿掉,目前只有這兩個區塊。
- 依工作拆算列表:整列可點 → `openJobKey` 開 `JobDetailView`。
- 範本 pill row:內建虛擬「預設」(UI hardcode,不落地存 DB)+ `reportTemplates` 表裡的使用者範本,套用後篩選器跟範本內容不一致時顯示 drift banner + 「更新範本」按鈕。

### 逐日明細(`JobDetailView`)

- 上方摘要:這份工作截至今日 / 未來(如果有)的出勤+工時+收入。
- 逐日列表:日期+班別+時段+時數+當日薪資,`isShiftCompleted` 判斷是否套虛線框+時鐘圖示+淡色金額,`manualWageOverride` 有值加鉛筆圖示,有深夜加給的班次可以點展開看拆解(`calculateShiftWageBreakdown`)。
- 底部筆數截斷(預設顯示前 6 筆,點擊「查看全部」展開)。

### 發薪日曆(`PaydayCalendarView`)

- 只有「月」單位的月份切換,不篩工作範圍,全部工作都會列出來。
- 依 `workplace.payCycle` 分流:
  - 沒設定(`null`)→ 列進 `unconfigured` 提示,不出現在清單裡。
  - `'monthly'` / `'weekly'` → 呼叫 `resolvePayPeriodsInRange` 算出這個月內每一次的發薪日+對應計薪區間,金額:月薪工作直接用 `monthlySalary`,日薪/時薪工作用 `payForPeriod` 加總該計薪區間內的班次金額。
  - `'daily'` → 沒有固定發薪日概念,把這個月所有班次彙總成一行(`日結彙總`)。
- 每一列都可以點進去開 `JobDetailView`:月結/週結用該次的 `periodStart`~`periodEnd`,日結用整個月的範圍。
- 底部總計卡「這個月總共領到」(`isShiftCompleted(paydayDate, today)` 已確定的部分)+ 尚未確定的預估金額另一行——跟工時統計的總收入是不同的數字,故意分開算。

### 自訂範本(`ReportTemplateForm` + `reportTemplates` 表)

新增範本存:名稱、`rangeType`(自訂類型不存實際日期,套用時要求使用者重選)、`workplaceIds`(JSON 字串陣列,`null` 代表全部工作)、`showSplit`、`showBreakdown`。刪除範本前不用檢查引用(範本不會被別的資料引用)。

### 還沒定案(來自 `README.md`,尚未動工)

跨期比較趨勢、依日期跨工作彙總視角、班別層級再篩選、匯出功能、歷史金額因薪率調整被回溯改變的問題(傾向方向是建立/編輯班次時凍結當時金額,但影響範圍大還沒拍板)。

---

## 3. 設定 Tab(`src/app/settings.tsx`)—— ✅ 已實作

**整體結構(三層)**:

```
設定 Tab 根畫面(選項清單,目前只有「工作設定」一項,保留清單形式是因為之後會再加其他設定項目)
└─ 工作設定 → 工作主頁(上方 pill 子分頁:工作 / 排班)
    ├─ 工作(子分頁)
    └─ 排班(子分頁)
```

### 工作(子分頁)

**列表**:每個工作地點一張卡片(名稱 + 依計薪方式顯示的摘要),空清單顯示提示 + 新增按鈕。點卡片進編輯頁。

**編輯/新增頁欄位**:

| 欄位 | 顯示條件 | 備註 |
|---|---|---|
| 名稱 | 一律 | 必填 |
| 計薪方式:`月薪` / `日薪` / `時薪` | 一律 | **新增時可選,編輯既有工作地點時鎖定不可改**(避免過去排班紀錄的金額被回溯改變) |
| 月薪金額 / 起始日 / 目前是否仍在職 / 結束日 | `計薪方式=月薪` | 月薪金額必填,其餘選填 |
| 預設日薪(選填) | `計薪方式=日薪` | 同一份工作底下不同班別預設都用這個數字,個別班別可在排班分頁覆蓋 |
| 預設時薪(選填) | `計薪方式=時薪` | 同上,班別可覆蓋 |

刪除:檢查底下有沒有班別綁定,有就擋下、不做連坐刪除。

**「發薪設定」收合區塊**(不分計薪方式,一律選填,跟計薪方式獨立):

| 欄位 | 顯示條件 | 備註 |
|---|---|---|
| 發薪頻率 chip:月結/週結/日結 | 一律 | 不選 = `payCycle: null`,發薪日曆會跳過這份工作 |
| 發薪日 / 計薪起始日 / 計薪結束日(數字 + 「月底」開關) | 月結 | 數字都是「每月第幾天」,填 29/30/31 但當月沒有那天時自動退到當月最後一天 |
| 發薪星期 / 計薪起始星期 / 計薪結束星期 | 週結 | 週一~週日 chip |
| (無) | 日結 | 不用填額外欄位 |

即時預覽文字呼叫 `resolvePayPeriodsInRange`(`src/lib/pay-period.ts`)算出下一次的結果,例如「下一次發薪日 8/25,對應計薪區間 7/26–8/25」。

### 排班(子分頁)

**列表**:依工作地點分組,每區塊列出所屬班別簡述(名稱 + 起訖時間)。每區塊下方各自有「新增班別」按鈕——所屬工作地點由區塊帶入,表單裡不用再選一次。

**編輯/新增頁欄位**:不管計薪方式是月薪/日薪/時薪,起訖時間一律必填(用來算出勤工時給統計頁顯示,沒有「全日」這個選項):
- 綁定「月薪」工作地點的班別:起訖時間必填,本身不計逐班金額。
- 綁定「日薪」工作地點的班別:起訖時間必填(僅記錄用,不影響金額)、日薪金額(可套用工作預設值或針對這個班別覆蓋),不管做多久都算這個固定數字,休息時間/深夜加給/假日加給都不適用。
- 綁定「時薪」工作地點的班別:起訖時間必填、時薪必填(可套用工作預設值或覆蓋),休息時間/深夜加給/假日加給可選填。

刪除:檢查有沒有 `Shift` 綁定它,有就擋下。

---

## Tab Bar —— ✅ 已實作

`src/components/app-tabs.tsx`(native)/ `app-tabs.web.tsx`(web)只有今日/統計/設定三個項目,沒有特例攔截導航。今日 Tab 的 `tabPress`(native)/ `onExtraPress`(web)會呼叫 `resetToday()`:把 `todayMode` 重置回瀏覽狀態、`selectedDate` 重置回今天、關掉所有開著的 sheet——不管點的時候人在哪個分頁都會觸發。

---

## 開發用假資料(`src/db/seed-data.ts` + `src/db/memory-db.ts`)—— 僅網頁預覽

網頁預覽原本每次重新整理記憶體資料庫就會清空,現在 `memory-db.ts` 每次異動後會順手存一份到瀏覽器 `localStorage`(key `shift-wage-app:memory-db:v1`),重新整理會從那裡還原。只有 `localStorage` 完全沒有資料的「第一次載入」才會套用 `seed-data.ts` 的假資料;使用者自己之後的異動不會被蓋掉。

`seed-data.ts` 涵蓋:三種計薪方式 × 三種發薪頻率(月結/週結/日結)各一份工作 + 一份還沒設定發薪日的工作、深夜加給(部分重疊/全部重疊)、假日加給、手動覆寫金額、休息日標記,每份工作都有今天(以 `new Date()` 為準)前後的班次,方便手動測試截至今日/未來拆分跟發薪日曆各種情境。
