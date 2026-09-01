/**
 * Hero Critical Event Banner.
 * Engineered for immediate glanceability from 3 feet away under stress.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AEDEvent } from '../../core/types/events';
import { DarkTheme as Theme } from '../theme/colors';
import { Typography } from '../theme/typography';

interface CriticalEventBannerProps {
  latestCriticalEvent: AEDEvent | null;
  sessionStartTime?: number;
}

export const CriticalEventBanner: React.FC<CriticalEventBannerProps> = ({
  latestCriticalEvent,
  sessionStartTime,
}) => {
  if (!latestCriticalEvent) {
    return (
      <View style={styles.standbyContainer}>
        <Text style={styles.standbyLabel}>MONITORING ACTIVE — READY FOR AED EVENTS</Text>
      </View>
    );
  }

  const isShockDelivered = latestCriticalEvent.eventCode === '0X34';
  const isShockAdvised = latestCriticalEvent.eventCode === '0X30' || latestCriticalEvent.eventCode === '0X33';

  const elapsedMs = sessionStartTime ? latestCriticalEvent.timestamp - sessionStartTime : 0;
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  const elapsedSeconds = ((elapsedMs % 60000) / 1000).toFixed(1);
  const formattedElapsed = `+${elapsedMinutes.toString().padStart(2, '0')}:${elapsedSeconds.padStart(4, '0')}`;

  return (
    <View
      style={[
        styles.container,
        isShockDelivered && styles.shockDeliveredContainer,
        isShockAdvised && styles.shockAdvisedContainer,
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.criticalBadge}>
          <Text style={styles.criticalBadgeText}>CRITICAL CLINICAL EVENT</Text>
        </View>
        <Text style={styles.elapsedText}>{formattedElapsed} (SEQ #{latestCriticalEvent.sequenceNumber})</Text>
      </View>

      <Text style={styles.titleText}>{latestCriticalEvent.label.toUpperCase()}</Text>

      {/* Structured Telemetry Metrics */}
      <View style={styles.metricsRow}>
        {latestCriticalEvent.metadata.energyJoules !== undefined && (
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{latestCriticalEvent.metadata.energyJoules} J</Text>
            <Text style={styles.metricLabel}>DELIVERED ENERGY</Text>
          </View>
        )}

        {latestCriticalEvent.metadata.currentAmps !== undefined && (
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{latestCriticalEvent.metadata.currentAmps} A</Text>
            <Text style={styles.metricLabel}>PEAK CURRENT</Text>
          </View>
        )}

        {latestCriticalEvent.metadata.impedanceOhms !== undefined && (
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{latestCriticalEvent.metadata.impedanceOhms} Ω</Text>
            <Text style={styles.metricLabel}>PATIENT IMPEDANCE</Text>
          </View>
        )}

        {latestCriticalEvent.metadata.heartRateBpm !== undefined && (
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{latestCriticalEvent.metadata.heartRateBpm} BPM</Text>
            <Text style={styles.metricLabel}>DETECTED RATE</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  standbyContainer: {
    backgroundColor: Theme.surfaceCard,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.borderSubtle,
    alignItems: 'center',
  },
  standbyLabel: {
    ...Typography.badgePill,
    color: Theme.textLowEmphasis,
  },
  container: {
    backgroundColor: Theme.surfaceCard,
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: Theme.criticalBorder,
  },
  shockDeliveredContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
    borderColor: Theme.critical,
  },
  shockAdvisedContainer: {
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
    borderColor: Theme.warning,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  criticalBadge: {
    backgroundColor: Theme.critical,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  criticalBadgeText: {
    ...Typography.badgePill,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  elapsedText: {
    ...Typography.monoTimestamp,
    color: Theme.textMediumEmphasis,
    fontWeight: '700',
  },
  titleText: {
    ...Typography.heroCritical,
    color: Theme.textHighEmphasis,
    marginBottom: 10,
  },
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 6,
    padding: 10,
    justifyContent: 'space-around',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    ...Typography.headline,
    color: Theme.textHighEmphasis,
    fontWeight: '700',
  },
  metricLabel: {
    ...Typography.badgePill,
    color: Theme.textLowEmphasis,
    fontSize: 9,
    marginTop: 2,
  },
});
