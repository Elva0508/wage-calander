const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// drizzle-kit 產生的 migration 檔會 import 原始 .sql 內容(見 drizzle/migrations.js),
// 讓 Metro 認得這個副檔名,實際的 inline 轉換交給 babel.config.js 的 inline-import 外掛處理
config.resolver.sourceExts.push('sql');

// expo-sqlite 在 web 平台用 wa-sqlite(WASM)實作,需要讓 Metro 把 .wasm 當成資源檔案
config.resolver.assetExts.push('wasm');

// wa-sqlite 需要 SharedArrayBuffer,瀏覽器只有在「跨來源隔離」開啟時才會提供這個 API,
// 開發伺服器預設不會加這兩個 header,手動補上讓網頁版的 SQLite 能正常初始化
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => (req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    return middleware(req, res, next);
  },
};

module.exports = withNativeWind(config, { input: './src/global.css' });
