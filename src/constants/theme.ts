/**
 * App 的顏色/字型/間距設定,透過 useTheme() 讀取,搭配 StyleSheet.create 或內嵌 style 使用。
 * 色彩系統詳細規格見 docs/COLOR-SYSTEM.md。
 */

import { Platform } from 'react-native';

// 色彩系統詳細規格(用途、深淺模式對照、決策脈絡)見 docs/COLOR-SYSTEM.md
export const Colors = {
  light: {
    text: '#33312B',
    background: '#FDFCF9',
    backgroundElement: '#F8F5EE',
    backgroundSelected: '#D7E6E1',
    textSecondary: '#86827A',
    primary: '#3F6B5E',
    primarySoft: '#D7E6E1',
    onPrimary: '#FFFFFF',
    accent: '#5F4419',
    accentSoft: '#F0E4CB',
    warning: '#BA8A5A',
    warningSoft: '#F1E3D2',
    warningText: '#6B4A2C',
    danger: '#C0392B',
    border: '#EAE4D5',
  },
  dark: {
    text: '#ECE7DA',
    background: '#1D1B17',
    backgroundElement: '#272420',
    backgroundSelected: '#2D4C3F',
    textSecondary: '#9C9787',
    primary: '#4F8C79',
    primarySoft: '#2D4C3F',
    onPrimary: '#0E1613',
    accent: '#E7CE9C',
    accentSoft: '#3A2E1C',
    warning: '#C9986A',
    warningSoft: '#362A1D',
    warningText: '#E3C4A3',
    danger: '#E0685C',
    border: '#3B3730',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'Spline Sans, Inter, ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
    serif: 'Georgia, "Times New Roman", serif',
    rounded: '"SF Pro Rounded", "Hiragino Maru Gothic ProN", Meiryo, "MS PGothic", sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
export const CardRadius = 16;
