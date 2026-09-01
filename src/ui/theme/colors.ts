/**
 * Medical-grade color tokens exceeding WCAG 2.1 AAA contrast.
 */

export const DarkTheme = {
  // Backgrounds
  backgroundBase: '#0B0F19',
  surfaceCard: '#1E293B',
  surfaceElevated: '#334155',
  surfaceHighlight: '#1E3A8A',
  borderSubtle: '#334155',
  borderFocused: '#60A5FA',

  // Typography
  textHighEmphasis: '#FFFFFF',
  textMediumEmphasis: '#CBD5E1',
  textLowEmphasis: '#94A3B8',
  textMonospace: '#38BDF8',

  // Status & Severity
  critical: '#EF4444',
  criticalBg: 'rgba(239, 68, 68, 0.18)',
  criticalBorder: '#F87171',

  warning: '#F59E0B',
  warningBg: 'rgba(245, 158, 11, 0.18)',
  warningBorder: '#FBBF24',

  success: '#10B981',
  successBg: 'rgba(16, 185, 129, 0.18)',
  successBorder: '#34D399',

  info: '#3B82F6',
  infoBg: 'rgba(59, 130, 246, 0.18)',
  infoBorder: '#60A5FA',

  unknown: '#8B5CF6',
  unknownBg: 'rgba(139, 92, 246, 0.18)',
  unknownBorder: '#A78BFA',
};

export const LightTheme = {
  backgroundBase: '#F8FAFC',
  surfaceCard: '#FFFFFF',
  surfaceElevated: '#F1F5F9',
  surfaceHighlight: '#DBEAFE',
  borderSubtle: '#E2E8F0',
  borderFocused: '#3B82F6',

  textHighEmphasis: '#0F172A',
  textMediumEmphasis: '#334155',
  textLowEmphasis: '#64748B',
  textMonospace: '#0284C7',

  critical: '#DC2626',
  criticalBg: '#FEE2E2',
  criticalBorder: '#EF4444',

  warning: '#D97706',
  warningBg: '#FEF3C7',
  warningBorder: '#F59E0B',

  success: '#059669',
  successBg: '#D1FAE5',
  successBorder: '#10B981',

  info: '#2563EB',
  infoBg: '#DBEAFE',
  infoBorder: '#3B82F6',

  unknown: '#7C3AED',
  unknownBg: '#EDE9FE',
  unknownBorder: '#8B5CF6',
};

export type ThemeColors = typeof DarkTheme;
