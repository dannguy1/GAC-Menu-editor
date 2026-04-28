/**
 * Toast notification component.
 * Implements NFR-U02 — toast notifications for all save/delete operations.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

const COLORS = {
  success: '#5a7a3a',
  error: '#d32f2f',
  warning: '#f9a825',
  info: '#1976d2',
};

const DURATION = { success: 2000, error: 3000, warning: 3000, info: 2500 };

export default function Toast({ visible, message, type = 'success', onHide }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      const anim = Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(DURATION[type] || 2000),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]);
      anim.start(({ finished }) => { if (finished) onHide?.(); });
      return () => anim.stop();
    }
  }, [visible, message, type, onHide]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { backgroundColor: COLORS[type] || COLORS.info, opacity }]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
