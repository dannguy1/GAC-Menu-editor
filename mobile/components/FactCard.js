/**
 * FactCard — fact card for the facts list.
 * Implements FR-F01.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function FactCard({ fact, onPress }) {
  const preview = fact.content ? fact.content.substring(0, 80) + (fact.content.length > 80 ? '…' : '') : '';

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(fact)} accessibilityLabel={`Edit fact: ${fact.topic}`}>
      <View style={styles.header}>
        <Text style={styles.topic} numberOfLines={1}>{fact.topic}</Text>
        <Text style={styles.type}>{fact.type || 'general_info'}</Text>
      </View>
      <Text style={styles.content} numberOfLines={2}>{preview}</Text>
      <Text style={styles.chevron}>Edit ›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0d8c8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  topic: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2c2c2c',
    flex: 1,
  },
  type: {
    fontSize: 11,
    color: '#888',
    marginLeft: 8,
  },
  content: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  chevron: {
    fontSize: 12,
    color: '#5a7a3a',
    fontWeight: '600',
    marginTop: 8,
    alignSelf: 'flex-end',
  },
});
