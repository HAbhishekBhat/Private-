/**
 * SimulatorControlScreen: Interactive QA, Training, and Hardware Emulation Panel.
 */

import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MockSimulatorTransport, SimulationScenario } from '../../transport/MockSimulatorTransport';
import { DarkTheme as Theme } from '../theme/colors';
import { Typography } from '../theme/typography';

interface SimulatorControlScreenProps {
  simulatorTransport: MockSimulatorTransport;
}

export const SimulatorControlScreen: React.FC<SimulatorControlScreenProps> = ({ simulatorTransport }) => {
  const [activeScenario, setActiveScenario] = useState<string | null>(null);

  const runScenario = (scenario: SimulationScenario, name: string) => {
    setActiveScenario(name);
    simulatorTransport.playScenario(scenario, 1.5); // 1.5x speed for rapid testing
    Alert.alert('Simulation Started', `Executing ${name}. Switch to Live Capture tab to view real-time ingestion.`);
  };

  const stopScenario = () => {
    simulatorTransport.stopSimulation();
    setActiveScenario(null);
  };

  const injectManualEvent = (name: string, code: number, payload: Uint8Array = new Uint8Array(0)) => {
    simulatorTransport.emitEvent(code, payload);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>AED HARDWARE SIMULATION SUITE</Text>
      <Text style={styles.headerSubtitle}>
        Emulate optical IR telemetry transmissions to validate cross-platform decoding and dual-write audit logs.
      </Text>

      {/* Automated Emergency Scenarios */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AUTOMATED CLINICAL SCENARIOS</Text>

        <TouchableOpacity
          style={styles.scenarioCard}
          onPress={() => runScenario('ADULT_CARDIAC_ARREST_SHOCKABLE', 'Adult Cardiac Arrest (Shockable VF)')}
        >
          <Text style={styles.scenarioName}>1. Adult Cardiac Arrest (Shockable VF)</Text>
          <Text style={styles.scenarioDesc}>
            Power On → Self-Test → Pads On → Analyzing → Shock Advised → Charging → Shock Delivered (200J) → CPR Metronome → ROSC
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.scenarioCard}
          onPress={() => runScenario('NON_SHOCKABLE_RHYTHM', 'Non-Shockable Rhythm (Asystole/PEA)')}
        >
          <Text style={styles.scenarioName}>2. Non-Shockable Rhythm</Text>
          <Text style={styles.scenarioDesc}>
            Power On → Pads On → Analyzing → No Shock Advised → Start CPR
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.scenarioCard}
          onPress={() => runScenario('DISCONNECT_RECOVERY_TEST', 'Cable Disconnect & Grace Recovery Test')}
        >
          <Text style={styles.scenarioName}>3. Hardware Disconnect Recovery</Text>
          <Text style={styles.scenarioDesc}>
            Simulates dongle dislodgement for 1.5s mid-session, verifying seamless session continuity.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.scenarioCard}
          onPress={() => runScenario('CORRUPT_FRAME_BURST_TEST', 'Noise & Corrupted Frame Burst')}
        >
          <Text style={styles.scenarioName}>4. Noise & Checksum Failure Burst</Text>
          <Text style={styles.scenarioDesc}>
            Injects corrupt checksum and unknown opcode frames, validating error containment and raw retention.
          </Text>
        </TouchableOpacity>

        {activeScenario && (
          <TouchableOpacity style={styles.stopButton} onPress={stopScenario}>
            <Text style={styles.stopButtonText}>STOP ACTIVE SIMULATION</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Manual Diagnostic Triggers */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>MANUAL TELEMETRY INJECTION</Text>
        <View style={styles.buttonGrid}>
          <TouchableOpacity
            style={styles.manualBtn}
            onPress={() => injectManualEvent('Pads OK', 0x11, new Uint8Array([0x00, 0x44]))}
          >
            <Text style={styles.manualBtnText}>Pads Connected</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.manualBtn}
            onPress={() => injectManualEvent('Analyze', 0x20)}
          >
            <Text style={styles.manualBtnText}>Analyzing</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.manualBtn, { borderColor: Theme.criticalBorder }]}
            onPress={() => injectManualEvent('Shock Advised', 0x30, new Uint8Array([0x00, 0xb4]))}
          >
            <Text style={[styles.manualBtnText, { color: Theme.critical }]}>Shock Advised</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.manualBtn, { borderColor: Theme.critical, backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}
            onPress={() => injectManualEvent('Shock Delivered', 0x34, new Uint8Array([0x00, 0xc8, 0x20, 0x44]))}
          >
            <Text style={[styles.manualBtnText, { color: '#FFFFFF' }]}>Shock Delivered (200J)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.backgroundBase,
  },
  content: {
    padding: 16,
  },
  headerTitle: {
    ...Typography.headline,
    color: Theme.textHighEmphasis,
    marginBottom: 4,
  },
  headerSubtitle: {
    ...Typography.bodyPrimary,
    color: Theme.textLowEmphasis,
    marginBottom: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    ...Typography.badgePill,
    color: Theme.textMediumEmphasis,
    marginBottom: 10,
  },
  scenarioCard: {
    backgroundColor: Theme.surfaceCard,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.borderSubtle,
    marginBottom: 10,
  },
  scenarioName: {
    ...Typography.titleMedium,
    color: Theme.textHighEmphasis,
    marginBottom: 4,
  },
  scenarioDesc: {
    ...Typography.bodySecondary,
    color: Theme.textLowEmphasis,
  },
  stopButton: {
    backgroundColor: Theme.critical,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  stopButtonText: {
    ...Typography.badgePill,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  manualBtn: {
    backgroundColor: Theme.surfaceCard,
    borderWidth: 1,
    borderColor: Theme.borderSubtle,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    flexGrow: 1,
    alignItems: 'center',
  },
  manualBtnText: {
    ...Typography.badgePill,
    color: Theme.textHighEmphasis,
    fontSize: 11,
  },
});
