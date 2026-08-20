# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# 程式碼組織規範

每次新增或修改程式碼都要遵守以下規則,不是建議,是硬性規範:

1. **單檔行數上限 1000 行。** 新增功能前先看目標檔案目前多長,如果加完會超過 1000 行,先拆檔案再加功能,不要讓檔案繼續長大。
2. **簡化檔案內的功能,不要把太多職責塞進一個檔案。** 一個檔案只做一件事(一個畫面、一個元件、一組相關的純函式),邏輯變複雜時優先思考「這一塊能不能獨立成自己的檔案」,而不是繼續往同一個檔案裡加。
3. **相同或相似的邏輯/UI 拉成共用元件,不要複製貼上。** 出現第二次類似的表單欄位、卡片樣式、計算邏輯,就要抽成共用的元件或函式:
   - 共用 UI 元件放 `src/components/`
   - 共用純函式邏輯放 `src/lib/`
4. **同一個頁面內可以拆的區塊,拆成獨立檔案,用資料夾集中放。** 例如一個畫面如果有表單、清單、彈出視窗等好幾個明顯的子區塊,不要全部塞進同一個 `.tsx`。⚠️ `src/app/` 底下是 expo-router 的檔案路由,裡面每個 `.tsx` 檔都會被當成一個路由,**不能**在 `src/app/settings/` 這種資料夾裡放非路由的子元件(會多長出一個 `/settings/workplace-form` 之類的意外路由)。正確做法是把畫面本身的路由檔留在 `src/app/xxx.tsx`(只當薄殼,import 實際內容),子區塊拆進 `src/components/xxx/` 資料夾——例如 `src/components/settings/` 底下放 `workplace-list.tsx` + `workplace-form.tsx` + `shift-type-list.tsx` + `shift-type-form.tsx` + `shared.tsx`(共用樣式/元件/常數),`src/app/settings.tsx` 只剩 import 跟最外層的路由邏輯。
5. **檔案盡量用資料夾分類,不要平鋪在同一層。** 相關的檔案(同一功能領域的元件、同一頁面拆出來的子檔案)歸進同一個子資料夾,方便之後找。
