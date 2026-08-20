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
        text: '#33312B',
        'text-dark': '#ECE7DA',
        background: '#FDFCF9',
        'background-dark': '#1D1B17',
        'background-element': '#F8F5EE',
        'background-element-dark': '#272420',
        'background-selected': '#D7E6E1',
        'background-selected-dark': '#2D4C3F',
        'text-secondary': '#86827A',
        'text-secondary-dark': '#9C9787',
        primary: '#3F6B5E',
        'primary-dark': '#4F8C79',
        'primary-soft': '#D7E6E1',
        'primary-soft-dark': '#2D4C3F',
        'on-primary': '#FFFFFF',
        'on-primary-dark': '#0E1613',
        accent: '#5F4419',
        'accent-dark': '#E7CE9C',
        'accent-soft': '#F0E4CB',
        'accent-soft-dark': '#3A2E1C',
        warning: '#BA8A5A',
        'warning-dark': '#C9986A',
        'warning-soft': '#F1E3D2',
        'warning-soft-dark': '#362A1D',
        'warning-text': '#6B4A2C',
        'warning-text-dark': '#E3C4A3',
        danger: '#C0392B',
        'danger-dark': '#E0685C',
        border: '#EAE4D5',
        'border-dark': '#3B3730',
      },
      borderRadius: {
        card: '16px',
      },
    },
  },
  plugins: [],
};
