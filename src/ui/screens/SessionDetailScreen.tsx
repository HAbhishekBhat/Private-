/**
 * SessionDetailScreen: Comprehensive drill-down of a single completed rescue session.
 * Exposes full timeline review, raw log inspector, and clinical export generators.
 */

import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AEDEvent, AEDSession, SessionExportBundle } from '../../core/types/events';
import { SessionReadRepository } from '../../storage/SessionReadRepository';
import { EventRow } from '../components/EventRow';
import { DarkTheme as Theme } from '../theme/colors';
import { Typography } from '../theme/typography';

interface SessionDetailScreenProps {
  session: AEDSession;
  readRepo: SessionReadRepository;
  onBack: () => void;
}

export const SessionDetailScreen: React.FC<SessionDetailScreenProps> = ({
  session,
  readRepo,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<'TIMELINE' | 'RAW_LOG' | 'EXPORT'>('TIMELINE');
  const [events, setEvents] = useState<AEDEvent[]>([]);
  const [rawLogText, setRawLogText] = useState<string>('');
  const [exportBundle, setExportBundle] = useState<SessionExportBundle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDetails = async () => {
      try {
        setLoading(true);
        const evList = await readRepo.getEventsForSession(session.sessionId);
        setEvents(evList);

        try {
          const raw = await readRepo.readRawLogFile(session.rawLogPath);
          setRawLogText(raw);
        } catch {
          setRawLogText('Raw log stream not accessible on local filesystem.');
        }

        const bundle = await readRepo.exportSessionBundle(session.sessionId);
        setExportBundle(bundle);
      } catch (err) {
        console.error('Failed to load session details:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [session, readRepo]);

  const handleExportCsv = async () => {
    try {
      const csv = await readRepo.exportSessionCsv(session.sessionId);
      Alert.alert('CSV Export Generated', `Ready for transfer (${csv.length} bytes)`);
    } catch (err) {
      Alert.alert('Export Error', String(err));
    }
  };

  const handleExportJson = () => {
    if (!exportBundle) return;
    Alert.alert(
      'JSON Audit Bundle',
      `Integrity: ${exportBundle.manifest.integrityVerified ? 'VERIFIED ✓' : 'UNVERIFIED'}\nSHA-256: ${exportBundle.manifest.sha256Checksum}`
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Navigation & Session Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          SESSION AUDIT
        </Text>
        <View style={styles.headerRightSpacer} />
      </View>

      {/* Session Metadata Card */}
      <View style={styles.metaCard}>
        <Text style={styles.sessionIdLabel}>SESSION UUID: {session.sessionId}</Text>
        <View style={styles.metaGrid}>
          <Text style={styles.metaField}>Status: <Text style={styles.metaValue}>{session.status}</Text></Text>
          <Text style={styles.metaField}>Transport: <Text style={styles.metaValue}>{session.transportType}</Text></Text>
          <Text style={styles.metaField}>Events: <Text style={styles.metaValue}>{session.eventCount}</Text></Text>
          <Text style={styles.metaField}>Shocks: <Text style={[styles.metaValue, { color: Theme.critical }]}>{session.criticalEventCount}</Text></Text>
        </View>
        {session.sha256Checksum && (
          <Text style={styles.checksumText} numberOfLines={1}>
            SHA-256: {session.sha256Checksum}
          </Text>
        )}
      </View>

      {/* Tab Selector */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'TIMELINE' && styles.tabButtonActive]}
          onPress={() => setActiveTab('TIMELINE')}
        >
          <Text style={[styles.tabText, activeTab === 'TIMELINE' && styles.tabTextActive]}>
            TIMELINE ({events.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'RAW_LOG' && styles.tabButtonActive]}
          onPress={() => setActiveTab('RAW_LOG')}
        >
          <Text style={[styles.tabText, activeTab === 'RAW_LOG' && styles.tabTextActive]}>
            RAW IR LOG
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'EXPORT' && styles.tabButtonActive]}
          onPress={() => setActiveTab('EXPORT')}
        >
          <Text style={[styles.tabText, activeTab === 'EXPORT' && styles.tabTextActive]}>
            AUDIT EXPORT
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'TIMELINE' && (
        <ScrollView style={styles.scrollContent}>
          {events.map((ev, index) => (
            <EventRow
              key={ev.eventId}
              event={ev}
              sessionStartTime={session.startTimestamp}
              isLatest={index === events.length - 1}
            />
          ))}
        </ScrollView>
      )}

      {activeTab === 'RAW_LOG' && (
        <ScrollView style={styles.rawLogContainer}>
          <Text style={styles.rawLogCode}>{rawLogText}</Text>
        </ScrollView>
      )}

      {activeTab === 'EXPORT' && (
        <View style={styles.exportContainer}>
          <Text style={styles.exportTitle}>TAMPER-EVIDENT AUDIT EXPORTS</Text>
          <Text style={styles.exportDescription}>
            All exported records include cryptographic SHA-256 digests matching the original raw IR stream.
          </Text>

          <TouchableOpacity style={styles.exportButton} onPress={handleExportCsv}>
            <Text style={styles.exportButtonText}>EXPORT STRUCTURED CSV TIMELINE</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.exportButton} onPress={handleExportJson}>
            <Text style={styles.exportButtonText}>EXPORT AUDIT JSON MANIFEST BUNDLE</Text>
          </TouchableOpacity>
        </View>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.borderSubtle,
  },
  backButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Theme.surfaceElevated,
    borderRadius: 4,
  },
  backButtonText: {
    ...Typography.badgePill,
    color: Theme.textHighEmphasis,
  },
  headerTitle: {
    ...Typography.headline,
    color: Theme.textHighEmphasis,
    fontSize: 16,
  },
  headerRightSpacer: {
    width: 60,
  },
  metaCard: {
    backgroundColor: Theme.surfaceCard,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.borderSubtle,
  },
  sessionIdLabel: {
    ...Typography.monoTimestamp,
    color: Theme.textMonospace,
    fontSize: 11,
    marginBottom: 6,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaField: {
    ...Typography.bodySecondary,
    color: Theme.textLowEmphasis,
  },
  metaValue: {
    color: Theme.textHighEmphasis,
    fontWeight: '700',
  },
  checksumText: {
    ...Typography.monoTimestamp,
    color: Theme.textMediumEmphasis,
    fontSize: 9,
    marginTop: 6,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Theme.borderSubtle,
    marginHorizontal: 16,
    marginTop: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: Theme.info,
  },
  tabText: {
    ...Typography.badgePill,
    color: Theme.textLowEmphasis,
  },
  tabTextActive: {
    color: Theme.info,
    fontWeight: '700',
  },
  scrollContent: {
    flex: 1,
    paddingTop: 12,
  },
  rawLogContainer: {
    flex: 1,
    backgroundColor: '#000000',
    margin: 16,
    padding: 12,
    borderRadius: 8,
  },
  rawLogCode: {
    ...Typography.monoPayload,
    color: '#34D399',
    fontSize: 11,
  },
  exportContainer: {
    flex: 1,
    padding: 24,
  },
  exportTitle: {
    ...Typography.headline,
    color: Theme.textHighEmphasis,
    marginBottom: 8,
  },
  exportDescription: {
    ...Typography.bodyPrimary,
    color: Theme.textLowEmphasis,
    marginBottom: 20,
  },
  exportButton: {
    backgroundColor: Theme.surfaceCard,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.borderFocused,
    marginBottom: 12,
    alignItems: 'center',
  },
  exportButtonText: {
    ...Typography.badgePill,
    color: Theme.textHighEmphasis,
    fontSize: 12,
  },
});
