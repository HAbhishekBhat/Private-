/**
 * LiveCaptureScreen: Primary operational interface during emergency telemetry capture.
 */

import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SessionManager, SessionManagerState } from '../../core/session/SessionManager';
import { ConnectionStatusBar } from '../components/ConnectionStatusBar';
import { CriticalEventBanner } from '../components/CriticalEventBanner';
import { LiveEventList } from '../components/LiveEventList';
import { DarkTheme as Theme } from '../theme/colors';
import { Typography } from '../theme/typography';

interface LiveCaptureScreenProps {
  sessionManager: SessionManager;
}

export const LiveCaptureScreen: React.FC<LiveCaptureScreenProps> = ({ sessionManager }) => {
  const [managerState, setManagerState] = useState<SessionManagerState>(sessionManager.getState());

  useEffect(() => {
    const unsubscribe = sessionManager.onStateChange((newState) => {
      setManagerState({ ...newState });
    });
    return () => unsubscribe();
  }, [sessionManager]);

  const handleManualStop = () => {
    if (!managerState.activeSession) return;

    Alert.alert(
      'End Ingestion Session',
      'Are you sure you want to stop recording and seal the audit log for this session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End & Seal Session',
          style: 'destructive',
          onPress: async () => {
            const sha256 = await sessionManager.stopCurrentSession();
            if (sha256) {
              Alert.alert('Session Sealed', `Audit Integrity SHA-256:\n${sha256.substring(0, 24)}...`);
            }
          },
        },
      ]
    );
  };

  const latestCritical = managerState.eventList
    .slice()
    .reverse()
    .find((e) => e.critical) || null;

  return (
    <View style={styles.container}>
      {/* Persistent Sticky Hardware Indicator */}
      <ConnectionStatusBar
        status={managerState.connectionStatus}
        metadata={managerState.deviceMetadata}
        activeSession={managerState.activeSession}
        isGraceActive={managerState.isDisconnectGraceActive}
        graceSecondsRemaining={managerState.graceSecondsRemaining}
      />

      {/* Glanceable Critical Event Hero Banner */}
      <CriticalEventBanner
        latestCriticalEvent={latestCritical}
        sessionStartTime={managerState.activeSession?.startTimestamp}
      />

      {/* Ingestion Stream Header */}
      <View style={styles.streamHeader}>
        <Text style={styles.streamTitle}>
          LIVE TELEMETRY STREAM ({managerState.eventList.length} EVENTS)
        </Text>

        {managerState.activeSession && (
          <TouchableOpacity style={styles.stopButton} activeOpacity={0.8} onPress={handleManualStop}>
            <Text style={styles.stopButtonText}>STOP SESSION</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Live Auto-Scrolling Virtualized Event Log */}
      <LiveEventList
        events={managerState.eventList}
        sessionStartTime={managerState.activeSession?.startTimestamp}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.backgroundBase,
  },
  streamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
  },
  streamTitle: {
    ...Typography.badgePill,
    color: Theme.textLowEmphasis,
  },
  stopButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Theme.criticalBorder,
  },
  stopButtonText: {
    ...Typography.badgePill,
    color: Theme.critical,
    fontWeight: '700',
    fontSize: 9,
  },
});
