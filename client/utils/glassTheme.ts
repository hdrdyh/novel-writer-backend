/**
 * 毛玻璃暗色主题 - 统一色彩配置
 * 所有页面共用，避免硬编码色值
 */

export const GlassTheme = {
  // 背景色
  bgRoot: '#070A14',           // 最深层背景
  bgBase: '#0A0D1A',           // 基础背景（比root稍浅）
  bgElevated: '#111827',       // 抬升背景（卡片内嵌区域）
  bgCard: 'rgba(255,255,255,0.05)',   // 毛玻璃卡片背景
  bgCardHover: 'rgba(255,255,255,0.08)', // 卡片悬浮
  bgInput: 'rgba(255,255,255,0.06)',    // 输入框背景
  inputBg: 'rgba(255,255,255,0.06)',    // 输入框背景（别名）
  bgOverlay: 'rgba(0,0,0,0.85)',        // 弹窗遮罩
  
  // 边框
  border: 'rgba(255,255,255,0.1)',        // 通用边框（borderGlass别名）
  borderGlass: 'rgba(255,255,255,0.1)',   // 毛玻璃边框
  borderLight: 'rgba(255,255,255,0.05)',  // 更淡的边框
  borderFocus: '#7C5CFF',                 // 聚焦边框
  
  // 主色
  primary: '#7C5CFF',
  primaryLight: 'rgba(124,92,255,0.15)',
  primaryGlow: 'rgba(124,92,255,0.3)',
  
  // 强调色
  accent: '#69E7FF',
  accentLight: 'rgba(105,231,255,0.15)',
  
  // 成功/警告/错误
  success: '#62FAD3',
  successLight: 'rgba(98,250,211,0.15)',
  warning: '#FFD166',
  warningLight: 'rgba(255,209,102,0.15)',
  danger: '#FF6B8A',                     // danger别名
  error: '#FF6B8A',
  errorLight: 'rgba(255,107,138,0.15)',
  
  // 文字色
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.7)',
  textTertiary: 'rgba(255,255,255,0.4)',
  textMuted: 'rgba(255,255,255,0.5)',     // 弱化文字
  textDisabled: 'rgba(255,255,255,0.2)',
  
  // 按钮色
  btnPrimaryBg: '#7C5CFF',
  btnPrimaryText: '#FFFFFF',
  btnSecondaryBg: 'rgba(255,255,255,0.1)',
  btnSecondaryText: '#FFFFFF',
  btnDangerBg: 'rgba(255,107,138,0.15)',
  btnDangerText: '#FF6B8A',
  
  // 阴影
  shadowCard: {
    shadowColor: '#7C5CFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  shadowGlow: {
    shadowColor: '#7C5CFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

// 常用组合样式
export const GlassCardStyle = {
  backgroundColor: GlassTheme.bgCard,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: GlassTheme.borderGlass,
  ...GlassTheme.shadowCard,
} as const;

export const GlassInputStyle = {
  backgroundColor: GlassTheme.bgInput,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: GlassTheme.borderLight,
  color: GlassTheme.textPrimary,
  paddingHorizontal: 16,
  paddingVertical: 14,
  fontSize: 15,
} as const;
