/**
 * Root Application Component for AED Event Capture & Logging.
 * Coordinates system initialization, medical UI shell, and navigation tabs.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TransportFactory } from './transport/TransportFactory';
import { MockSimulatorTransport } from './transport/MockSimulatorTransport';
import { MemoryDatabaseDriver } from './storage/drivers/MemoryDatabaseDriver';
import { MemoryFileSystemDriver } from './storage/drivers/FileSystemDrivers';
import { SessionWriteRepository } from './storage/SessionWriteRepository';
import { SessionReadRepository } from './storage/SessionReadRepository';
import { SessionManager } from './core/session/SessionManager';
import { AEDSession } from './core/types/events';
import { LiveCaptureScreen } from './ui/screens/LiveCaptureScreen';
import { SessionHistoryScreen } from './ui/screens/SessionHistoryScreen';
import { SessionDetailScreen } from './ui/screens/SessionDetailScreen';
import { SimulatorControlScreen } from './ui/screens/SimulatorControlScreen';
import { DarkTheme as Theme } from './ui/theme/colors';
import { Typography } from './ui/theme/typography';

type NavTab = 'LIVE' | 'HISTORY' | 'SIMULATOR';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('LIVE');
  const [selectedHistorySession, setSelectedHistorySession] = useState<AEDSession | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Initialize unified singleton services
  const { sessionManager, readRepo, simulatorTransport } = useMemo(() => {
    const dbDriver = new MemoryDatabaseDriver();
    const fsDriver = new MemoryFileSystemDriver();

    const writeRepo = new SessionWriteRepository(dbDriver, fsDriver);
    const readRepository = new SessionReadRepository(dbDriver, fsDriver);

    // Default to Simulator for hardware-agnostic execution
    const transport = TransportFactory.createTransport({ preferredType: 'MOCK_SIMULATOR' }, 'simulator');
    const manager = new SessionManager(transport, writeRepo, {
      disconnectGracePeriodMs: 60000,
      rawLogsDirectory: 'sessions',
    });

    return {
      sessionManager: manager,
      readRepo: readRepository,
      simulatorTransport: transport as MockSimulatorTransport,
    };
  }, []);

  useEffect(() => {
    const initApp = async () => {
      try {
        await sessionManager.initialize();
        await sessionManager.connect();
        setIsReady(true);
      } catch (err) {
        console.error('Failed to initialize AED Event Capture App:', err);
      }
    };

    initApp();

    return () => {
      sessionManager.disconnect();
    };
  }, [sessionManager]);

  if (!isReady) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor={Theme.backgroundBase} />
        <Text style={styles.loadingTitle}>INITIALIZING AED INGESTION SUBSYSTEM...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Theme.backgroundBase} />

      {/* Main Screen Viewport */}
      <View style={styles.content}>
        {selectedHistorySession ? (
          <SessionDetailScreen
            session={selectedHistorySession}
            readRepo={readRepo}
            onBack={() => setSelectedHistorySession(null)}
          />
        ) : (
          <>
            {currentTab === 'LIVE' && <LiveCaptureScreen sessionManager={sessionManager} />}
            {currentTab === 'HISTORY' && (
              <SessionHistoryScreen
                readRepo={readRepo}
                onSelectSession={(session) => setSelectedHistorySession(session)}
              />
            )}
            {currentTab === 'SIMULATOR' && (
              <SimulatorControlScreen simulatorTransport={simulatorTransport} />
            )}
          </>
        )}
      </View>

      {/* Persistent Bottom Medical Tab Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navItem, currentTab === 'LIVE' && !selectedHistorySession && styles.navItemActive]}
          onPress={() => {
            setSelectedHistorySession(null);
            setCurrentTab('LIVE');
          }}
        >
          <Text
            style={[
              styles.navText,
              currentTab === 'LIVE' && !selectedHistorySession && styles.navTextActive,
            ]}
          >
            ● LIVE CAPTURE
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, (currentTab === 'HISTORY' || selectedHistorySession) && styles.navItemActive]}
          onPress={() => {
            setSelectedHistorySession(null);
            setCurrentTab('HISTORY');
          }}
        >
          <Text
            style={[
              styles.navText,
              (currentTab === 'HISTORY' || selectedHistorySession) && styles.navTextActive,
            ]}
          >
            📋 AUDIT LOGS
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, currentTab === 'SIMULATOR' && !selectedHistorySession && styles.navItemActive]}
          onPress={() => {
            setSelectedHistorySession(null);
            setCurrentTab('SIMULATOR');
          }}
        >
          <Text
            style={[
              styles.navText,
              currentTab === 'SIMULATOR' && !selectedHistorySession && styles.navTextActive,
            ]}
          >
            ⚡ SIMULATOR
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.backgroundBase,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Theme.backgroundBase,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingTitle: {
    ...Typography.badgePill,
    color: Theme.textMediumEmphasis,
  },
  content: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: Theme.surfaceCard,
    borderTopWidth: 1,
    borderTopColor: Theme.borderSubtle,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  navItem: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  navItemActive: {
    backgroundColor: Theme.surfaceElevated,
  },
  navText: {
    ...Typography.badgePill,
    color: Theme.textLowEmphasis,
    fontSize: 11,
  },
  navTextActive: {
    color: Theme.textHighEmphasis,
    fontWeight: '700',
  },
});

export default App;
