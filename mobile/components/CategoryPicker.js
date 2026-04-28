/**
 * CategoryPicker — horizontal scrolling category filter tabs.
 * Implements FR-M06.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';

export default function CategoryPicker({ categories, activeCategory, onSelect }) {
  const all = ['All', ...categories];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      {all.map((cat) => {
        const isActive = (cat === 'All' && !activeCategory) || cat === activeCategory;
        return (
          <TouchableOpacity
            key={cat}
            style={[styles.tab, isActive && styles.activeTab]}
            onPress={() => onSelect(cat === 'All' ? '' : cat)}
            accessibilityLabel={`Filter by ${cat}`}
          >
            <Text style={[styles.label, isActive && styles.activeLabel]}>{cat}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0d8c8',
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0ece1',
    minHeight: 44,
    justifyContent: 'center',
  },
  activeTab: {
    backgroundColor: '#5a7a3a',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  activeLabel: {
    color: '#fff',
  },
});
