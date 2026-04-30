// Glass Theme Colors - pure constants for StyleSheet.create (no runtime dependency)
// These MUST be hardcoded hex values because StyleSheet.create runs at module load time
// and Metro's lazy loading may cause GlassTheme to be undefined at that point.

export const GC = {
  bgBase: '#070A14',
  bgElevated: '#0F1420',
  bgCard: '#151C2C',
  bgInput: '#1A2235',
  textPrimary: '#F0F2FF',
  textSecondary: '#8B8FA3',
  textMuted: '#5A5F73',
  textTertiary: '#4A4F63',
  inputBg: '#1A2235',
  primary: '#7C5CFF',
  primaryDark: '#5A3FD6',
  accent: '#69E7FF',
  success: '#62FAD3',
  danger: '#FF6B6B',
  warning: '#FFD700',
  border: '#2A3050',
  borderLight: '#1E2640',
  shadow: '#7C5CFF',
  disabled: '#3A3F53',
  overlay: 'rgba(7, 10, 20, 0.7)',
  glassBg: 'rgba(15, 20, 32, 0.6)',
  glassBorder: 'rgba(124, 92, 255, 0.12)',
  glassHighlight: 'rgba(105, 231, 255, 0.06)',
} as const;

export const GlassCardStyle = {
  backgroundColor: GC.glassBg,
  borderWidth: 1,
  borderColor: GC.glassBorder,
  borderRadius: 16,
  shadowColor: GC.shadow,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.1,
  shadowRadius: 16,
  elevation: 8,
} as const;

export const GlassInputStyle = {
  backgroundColor: GC.inputBg,
  borderWidth: 1,
  borderColor: GC.borderLight,
  borderRadius: 12,
  color: GC.textPrimary,
  paddingHorizontal: 16,
  paddingVertical: 12,
  fontSize: 15,
} as const;
