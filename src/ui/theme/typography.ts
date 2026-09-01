/**
 * Accessible typography scale with tabular figures and monospace metrics.
 */

import { Platform, TextStyle } from 'react-native';

const monospaceFamily = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

const sansFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'sans-serif',
});

export const Typography: Record<string, TextStyle> = {
  heroCritical: {
    fontFamily: sansFamily,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  headline: {
    fontFamily: sansFamily,
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  titleMedium: {
    fontFamily: sansFamily,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  bodyPrimary: {
    fontFamily: sansFamily,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  bodySecondary: {
    fontFamily: sansFamily,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  monoTimestamp: {
    fontFamily: monospaceFamily,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    // Tabular numbers prevent UI jumping as numbers change
    fontVariant: ['tabular-nums'],
  },
  monoPayload: {
    fontFamily: monospaceFamily,
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 15,
  },
  badgePill: {
    fontFamily: sansFamily,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
    letterSpacing: 0.5,
  },
};
