/**
 * Individual Event Row in the Live Capture and Review Timeline.
 * Includes expandable raw hex payload tray and timestamp offsets.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AEDEvent, Severity } from '../../core/types/events';
import { DarkTheme as Theme } from '../theme/colors';
import { Typography } from '../theme/typography';

interface EventRowProps {
  event: AEDEvent;
  sessionStartTime?: number;
  isLatest?: boolean;
}

export const EventRow: React.FC<EventRowProps> = ({
  event,
  sessionStartTime,
  isLatest,
}) => {
  const [expanded, setExpanded] = useState(false);

  const getSeverityColor = (severity: Severity, critical: boolean) => {
    if (critical) return Theme.critical;
    switch (severity) {
      case 'CRITICAL':
        return Theme.critical;
      case 'WARNING':
        return Theme.warning;
      case 'INFO':
        return Theme.info;
      default:
        return Theme.unknown;
    }
  };

  const getSeverityBg = (severity: Severity, critical: boolean) => {
    if (critical) return Theme.criticalBg;
    switch (severity) {
      case 'CRITICAL':
        return Theme.criticalBg;
      case 'WARNING':
        return Theme.warningBg;
      case 'INFO':
        return Theme.infoBg;
      default:
        return Theme.unknownBg;
    }
  };

  const elapsedMs = sessionStartTime ? event.timestamp - sessionStartTime : 0;
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  const elapsedSeconds = ((elapsedMs % 60000) / 1000).toFixed(1);
  const formattedElapsed = `+${elapsedMinutes.toString().padStart(2, '0')}:${elapsedSeconds.padStart(4, '0')}`;

  const date = new Date(event.timestamp);
  const formattedTime = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}.${date.getMilliseconds().toString().padStart(3, '0')}`;

  const severityColor = getSeverityColor(event.severity, event.critical);
  const severityBg = getSeverityBg(event.severity, event.critical);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => setExpanded(!expanded)}
      style={[
        styles.container,
        event.critical && styles.criticalContainer,
        isLatest && styles.latestContainer,
      ]}
    >
      {/* Primary Row */}
      <View style={styles.mainRow}>
        {/* Left: Sequence & Timestamps */}
        <View style={styles.timeColumn}>
          <Text style={styles.seqText}>#{event.sequenceNumber.toString().padStart(3, '0')}</Text>
          <Text style={styles.elapsedText}>{formattedElapsed}</Text>
          <Text style={styles.absoluteTimeText}>{formattedTime}</Text>
        </View>

        {/* Center: Label and Telemetry Summary */}
        <View style={styles.labelColumn}>
          <View style={styles.labelHeader}>
            <View style={[styles.severityBadge, { backgroundColor: severityBg, borderColor: severityColor }]}>
              <Text style={[styles.severityText, { color: severityColor }]}>
                {event.critical ? 'CRITICAL' : event.severity}
              </Text>
            </View>
            <Text style={styles.codeText}>{event.eventCode}</Text>
          </View>

          <Text style={[styles.labelText, event.critical && styles.criticalLabelText]}>
            {event.label}
          </Text>

          {/* Quick metadata chips */}
          {event.metadata.energyJoules !== undefined && (
            <Text style={styles.metaHighlight}>Energy: {event.metadata.energyJoules} Joules</Text>
          )}
          {event.metadata.batteryPercent !== undefined && (
            <Text style={styles.metaSub}>Battery: {event.metadata.batteryPercent}%</Text>
          )}
          {event.metadata.impedanceOhms !== undefined && (
            <Text style={styles.metaSub}>Impedance: {event.metadata.impedanceOhms} Ω</Text>
          )}
        </View>
      </View>

      {/* Expandable Raw Payload Drawer */}
      {expanded && (
        <View style={styles.payloadDrawer}>
          <View style={styles.payloadHeader}>
            <Text style={styles.payloadHeaderTitle}>RAW IR TELEMETRY PAYLOAD</Text>
            <Text
              style={[
                styles.checksumTag,
                { color: event.checksumValid ? Theme.success : Theme.critical },
              ]}
            >
              {event.checksumValid ? '✓ CHECKSUM VALID' : '✗ CHECKSUM FAILED'}
            </Text>
          </View>

          <View style={styles.hexBox}>
            <Text style={styles.hexText}>{event.rawPayloadHex}</Text>
          </View>

          {Object.keys(event.metadata).length > 1 && (
            <View style={styles.metadataBox}>
              <Text style={styles.metadataTitle}>PARSED FIELDS:</Text>
              <Text style={styles.metadataJsonText}>{JSON.stringify(event.metadata, null, 2)}</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Theme.surfaceCard,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: Theme.borderSubtle,
  },
  criticalContainer: {
    borderColor: Theme.criticalBorder,
    borderLeftWidth: 4,
    borderLeftColor: Theme.critical,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  latestContainer: {
    borderColor: Theme.borderFocused,
  },
  mainRow: {
    flexDirection: 'row',
  },
  timeColumn: {
    width: 80,
    marginRight: 10,
  },
  seqText: {
    ...Typography.monoTimestamp,
    color: Theme.textLowEmphasis,
    fontSize: 10,
  },
  elapsedText: {
    ...Typography.monoTimestamp,
    color: Theme.textHighEmphasis,
    fontWeight: '700',
    fontSize: 13,
    marginTop: 2,
  },
  absoluteTimeText: {
    ...Typography.monoTimestamp,
    color: Theme.textLowEmphasis,
    fontSize: 9,
    marginTop: 2,
  },
  labelColumn: {
    flex: 1,
  },
  labelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  severityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    marginRight: 6,
  },
  severityText: {
    ...Typography.badgePill,
    fontSize: 9,
    fontWeight: '700',
  },
  codeText: {
    ...Typography.monoTimestamp,
    color: Theme.textMonospace,
    fontSize: 11,
  },
  labelText: {
    ...Typography.titleMedium,
    color: Theme.textHighEmphasis,
  },
  criticalLabelText: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  metaHighlight: {
    ...Typography.bodySecondary,
    color: Theme.critical,
    fontWeight: '700',
    marginTop: 3,
  },
  metaSub: {
    ...Typography.bodySecondary,
    color: Theme.textLowEmphasis,
    marginTop: 2,
  },
  payloadDrawer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Theme.borderSubtle,
  },
  payloadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  payloadHeaderTitle: {
    ...Typography.badgePill,
    color: Theme.textLowEmphasis,
    fontSize: 9,
  },
  checksumTag: {
    ...Typography.monoTimestamp,
    fontSize: 9,
    fontWeight: '700',
  },
  hexBox: {
    backgroundColor: '#000000',
    padding: 8,
    borderRadius: 4,
    marginBottom: 6,
  },
  hexText: {
    ...Typography.monoPayload,
    color: Theme.textMonospace,
  },
  metadataBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: 6,
    borderRadius: 4,
  },
  metadataTitle: {
    ...Typography.badgePill,
    color: Theme.textLowEmphasis,
    fontSize: 8,
    marginBottom: 2,
  },
  metadataJsonText: {
    ...Typography.monoPayload,
    color: Theme.textMediumEmphasis,
    fontSize: 9,
  },
});
