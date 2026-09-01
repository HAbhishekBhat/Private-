/**
 * Persistent Connection Status Header Bar.
 * Unmissable hardware indicators: connected, searching, detached grace timer, and session stats.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ConnectionStatus, TransportMetadata } from '../../core/types/transport';
import { AEDSession } from '../../core/types/events';
import { DarkTheme as Theme } from '../theme/colors';
import { Typography } from '../theme/typography';

interface ConnectionStatusBarProps {
  status: ConnectionStatus;
  metadata: TransportMetadata | null;
  activeSession: AEDSession | null;
  isGraceActive: boolean;
  graceSecondsRemaining: number;
}

export const ConnectionStatusBar: React.FC<ConnectionStatusBarProps> = ({
  status,
  metadata,
  activeSession,
  isGraceActive,
  graceSecondsRemaining,
}) => {
  const getStatusColor = () => {
    if (isGraceActive) return Theme.critical;
    switch (status) {
      case 'CONNECTED':
        return Theme.success;
      case 'CONNECTING':
      case 'SEARCHING':
        return Theme.warning;
      case 'DETACHED_RETRYING':
      case 'ERROR':
        return Theme.critical;
      default:
        return Theme.textLowEmphasis;
    }
  };

  const getStatusLabel = () => {
    if (isGraceActive) {
      return `DONGLE DETACHED (RETAINING SESSION: ${graceSecondsRemaining}s)`;
    }
    switch (status) {
      case 'CONNECTED':
        return 'RECEIVER CONNECTED';
      case 'CONNECTING':
        return 'CONNECTING TO DONGLE...';
      case 'SEARCHING':
        return 'SEARCHING FOR DONGLE...';
      case 'DETACHED_RETRYING':
        return 'DONGLE DISCONNECTED — RETRYING';
      case 'ERROR':
        return 'HARDWARE ERROR';
      default:
        return 'NO DONGLE DETECTED';
    }
  };

  const statusColor = getStatusColor();

  return (
    <View style={[styles.container, isGraceActive && styles.graceContainer]}>
      {/* Top Status Strip */}
      <View style={styles.topRow}>
        <View style={styles.statusIndicatorGroup}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{getStatusLabel()}</Text>
        </View>

        {metadata?.type && (
          <View style={styles.transportBadge}>
            <Text style={styles.transportText}>{metadata.type.replace(/_/g, ' ')}</Text>
          </View>
        )}
      </View>

      {/* Detail row with device information and active recording stats */}
      <View style={styles.detailRow}>
        <Text style={styles.deviceInfoText} numberOfLines={1}>
          {metadata ? `${metadata.deviceName} (${metadata.baudRate || 9600} baud)` : 'Plug USB-C IR Dongle to Phone Port'}
        </Text>

        {activeSession ? (
          <View style={styles.sessionBadge}>
            <View style={styles.recordingDot} />
            <Text style={styles.sessionText}>
              REC: {activeSession.eventCount} EVTS ({activeSession.criticalEventCount} SHOCKS)
            </Text>
          </View>
        ) : (
          <Text style={styles.idleText}>IDLE / STANDBY</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Theme.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: Theme.borderSubtle,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  graceContainer: {
    backgroundColor: Theme.criticalBg,
    borderBottomColor: Theme.critical,
    borderBottomWidth: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusIndicatorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    ...Typography.badgePill,
    fontWeight: '700',
  },
  transportBadge: {
    backgroundColor: Theme.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  transportText: {
    ...Typography.badgePill,
    color: Theme.textMediumEmphasis,
    fontSize: 9,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceInfoText: {
    ...Typography.bodySecondary,
    color: Theme.textLowEmphasis,
    flex: 1,
    marginRight: 8,
  },
  sessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.criticalBorder,
  },
  recordingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Theme.critical,
    marginRight: 6,
  },
  sessionText: {
    ...Typography.monoTimestamp,
    color: Theme.textHighEmphasis,
    fontSize: 10,
    fontWeight: '700',
  },
  idleText: {
    ...Typography.bodySecondary,
    color: Theme.textLowEmphasis,
    fontSize: 11,
  },
});
