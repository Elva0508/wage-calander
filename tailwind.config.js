/**
 * 色票對應 src/constants/theme.ts 的 Colors.light/Colors.dark,一份設定同時服務兩套樣式系統
 * 直到 ThemedView/ThemedText 逐步遷到 NativeWind 為止。深色模式用法:
 *   className="bg-background dark:bg-background-dark"
 * darkMode 用 'media' 是為了跟現有 useColorScheme() 自動跟系統一致的行為保持一致,不需要額外的
 * dark mode provider/toggle。
 */
module.exports = {
  darkMode: 'media',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        text: '#000000',
        'text-dark': '#ffffff',
        background: '#ffffff',
        'background-dark': '#000000',
        'background-element': '#F0F0F3',
        'background-element-dark': '#212225',
        'background-selected': '#E0E1E6',
        'background-selected-dark': '#2E3135',
        'text-secondary': '#60646C',
        'text-secondary-dark': '#B0B4BA',
        primary: '#D85A30',
        'primary-dark': '#E37A54',
        'primary-soft': '#FBE7DE',
        'primary-soft-dark': '#3A2620',
        accent: '#993556',
        'accent-dark': '#C15E7E',
        'accent-soft': '#F5DEE6',
        'accent-soft-dark': '#3A2530',
        danger: '#C0392B',
        'danger-dark': '#E0685C',
        border: '#E5E2DE',
        'border-dark': '#33332F',
      },
      borderRadius: {
        card: '16px',
      },
    },
  },
  plugins: [],
};
