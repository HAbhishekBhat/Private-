/**
 * SessionHistoryScreen: Read-only review of historical AED rescue sessions.
 * Communicates immutability by absolute absence of edit/delete affordances.
 */

import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AEDSession } from '../../core/types/events';
import { SessionReadRepository } from '../../storage/SessionReadRepository';
import { DarkTheme as Theme } from '../theme/colors';
import { Typography } from '../theme/typography';

interface SessionHistoryScreenProps {
  readRepo: SessionReadRepository;
  onSelectSession: (session: AEDSession) => void;
}

export const SessionHistoryScreen: React.FC<SessionHistoryScreenProps> = ({
  readRepo,
  onSelectSession,
}) => {
  const [sessions, setSessions] = useState<AEDSession[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const list = await readRepo.listSessions();
      setSessions(list);
    } catch (err) {
      console.error('Failed to load session history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [readRepo]);

  const renderSessionItem = ({ item }: { item: AEDSession }) => {
    const startDate = new Date(item.startTimestamp);
    const durationSec = item.endTimestamp
      ? Math.round((item.endTimestamp - item.startTimestamp) / 1000)
      : null;

    const formattedDuration = durationSec !== null
      ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`
      : 'In Progress';

    return (
      <TouchableOpacity
        style={styles.sessionCard}
        activeOpacity={0.8}
        onPress={() => onSelectSession(item)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.statusBadge}>
            <Text style={[styles.statusText, item.status === 'COMPLETED' ? styles.statusCompleted : styles.statusInterrupted]}>
              {item.status}
            </Text>
          </View>
          <Text style={styles.timestampText}>{startDate.toLocaleString()}</Text>
        </View>

        <Text style={styles.sessionIdText} numberOfLines={1}>
          SESSION: {item.sessionId}
        </Text>

        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={styles.metricVal}>{item.eventCount}</Text>
            <Text style={styles.metricLbl}>TOTAL EVENTS</Text>
          </View>

          <View style={styles.metric}>
            <Text style={[styles.metricVal, item.criticalEventCount > 0 && { color: Theme.critical }]}>
              {item.criticalEventCount}
            </Text>
            <Text style={styles.metricLbl}>SHOCKS DELIVERED</Text>
          </View>

          <View style={styles.metric}>
            <Text style={styles.metricVal}>{formattedDuration}</Text>
            <Text style={styles.metricLbl}>DURATION</Text>
          </View>
        </View>

        {item.sha256Checksum && (
          <View style={styles.shaContainer}>
            <Text style={styles.shaLabel}>SHA-256 SEAL:</Text>
            <Text style={styles.shaText} numberOfLines={1}>
              {item.sha256Checksum}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>HISTORICAL RESCUE SESSIONS</Text>
        <TouchableOpacity onPress={loadSessions} style={styles.refreshButton}>
          <Text style={styles.refreshButtonText}>REFRESH</Text>
        </TouchableOpacity>
      </View>

      {sessions.length === 0 && !loading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>NO SAVED SESSIONS FOUND</Text>
          <Text style={styles.emptySubtext}>Connect an AED IR dongle to record telemetry.</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.sessionId}
          renderItem={renderSessionItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.backgroundBase,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Theme.borderSubtle,
  },
  headerTitle: {
    ...Typography.headline,
    color: Theme.textHighEmphasis,
  },
  refreshButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: Theme.surfaceElevated,
    borderRadius: 4,
  },
  refreshButtonText: {
    ...Typography.badgePill,
    color: Theme.textMediumEmphasis,
  },
  listContent: {
    padding: 16,
  },
  sessionCard: {
    backgroundColor: Theme.surfaceCard,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Theme.borderSubtle,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    backgroundColor: Theme.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    ...Typography.badgePill,
    fontSize: 9,
  },
  statusCompleted: {
    color: Theme.success,
  },
  statusInterrupted: {
    color: Theme.warning,
  },
  timestampText: {
    ...Typography.monoTimestamp,
    color: Theme.textMediumEmphasis,
    fontSize: 11,
  },
  sessionIdText: {
    ...Typography.monoTimestamp,
    color: Theme.textMonospace,
    fontSize: 12,
    marginBottom: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 6,
    paddingVertical: 8,
    marginBottom: 8,
  },
  metric: {
    alignItems: 'center',
  },
  metricVal: {
    ...Typography.headline,
    color: Theme.textHighEmphasis,
    fontSize: 16,
  },
  metricLbl: {
    ...Typography.badgePill,
    color: Theme.textLowEmphasis,
    fontSize: 8,
    marginTop: 2,
  },
  shaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  shaLabel: {
    ...Typography.badgePill,
    color: Theme.textLowEmphasis,
    fontSize: 8,
    marginRight: 6,
  },
  shaText: {
    ...Typography.monoTimestamp,
    color: Theme.textMediumEmphasis,
    fontSize: 9,
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    ...Typography.headline,
    color: Theme.textMediumEmphasis,
    marginBottom: 8,
  },
  emptySubtext: {
    ...Typography.bodyPrimary,
    color: Theme.textLowEmphasis,
  },
});
