/**
 * Live Event List with Smart Auto-Scroll and Jump-to-Live.
 */

import React, { useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AEDEvent } from '../../core/types/events';
import { EventRow } from './EventRow';
import { DarkTheme as Theme } from '../theme/colors';
import { Typography } from '../theme/typography';

interface LiveEventListProps {
  events: AEDEvent[];
  sessionStartTime?: number;
}

export const LiveEventList: React.FC<LiveEventListProps> = ({ events, sessionStartTime }) => {
  const listRef = useRef<FlatList<AEDEvent>>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);

  const handleScroll = (event: { nativeEvent: { layoutMeasurement: { height: number }; contentOffset: { y: number }; contentSize: { height: number } } }) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 40;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;

    if (isCloseToBottom !== isAutoScrollEnabled) {
      setIsAutoScrollEnabled(isCloseToBottom);
    }
  };

  const jumpToLive = () => {
    setIsAutoScrollEnabled(true);
    listRef.current?.scrollToEnd({ animated: true });
  };

  if (events.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.pulseIcon} />
        <Text style={styles.emptyTitle}>WAITING FOR AED TELEMETRY</Text>
        <Text style={styles.emptySubtitle}>
          Ensure USB-C IR dongle is aligned with the AED optical window (distance &lt; 30cm).
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={events}
        keyExtractor={(item) => item.eventId}
        renderItem={({ item, index }) => (
          <EventRow
            event={item}
            sessionStartTime={sessionStartTime}
            isLatest={index === events.length - 1}
          />
        )}
        contentContainerStyle={styles.listContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onContentSizeChange={() => {
          if (isAutoScrollEnabled) {
            listRef.current?.scrollToEnd({ animated: true });
          }
        }}
      />

      {/* Floating Jump to Live Button */}
      {!isAutoScrollEnabled && (
        <TouchableOpacity style={styles.jumpButton} activeOpacity={0.85} onPress={jumpToLive}>
          <Text style={styles.jumpButtonText}>↓ JUMP TO LIVE STREAM ({events.length} EVENTS)</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  listContent: {
    paddingVertical: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  pulseIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Theme.warning,
    marginBottom: 16,
  },
  emptyTitle: {
    ...Typography.headline,
    color: Theme.textHighEmphasis,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    ...Typography.bodyPrimary,
    color: Theme.textLowEmphasis,
    textAlign: 'center',
  },
  jumpButton: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: Theme.info,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  jumpButtonText: {
    ...Typography.badgePill,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
