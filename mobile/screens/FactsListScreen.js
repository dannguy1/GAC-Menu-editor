/**
 * FactsListScreen — browse and search facts.
 * Implements FR-F01, FR-F07.
 */
import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FactCard from '../components/FactCard';
import SearchBar from '../components/SearchBar';
import { bestScore } from '../services/fuzzySearch';

export default function FactsListScreen({ facts, loading, onEditFact, onAddFact, onRefresh }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return facts;
    const scored = facts
      .map((f) => ({ fact: f, score: bestScore(search, f.topic, f.content) }))
      .filter((s) => s.score >= 0);
    scored.sort((a, b) => a.score - b.score);
    return scored.map((s) => s.fact);
  }, [facts, search]);

  return (
    <View style={styles.container}>
      <SearchBar placeholder="Search facts..." onSearch={setSearch} />

      <View style={styles.countBar}>
        <Text style={styles.count}>{filtered.length} fact{filtered.length !== 1 ? 's' : ''}</Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.fact_id}
        renderItem={({ item }) => <FactCard fact={item} onPress={onEditFact} />}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor="#5a7a3a" />}
        ListEmptyComponent={<Text style={styles.empty}>No facts found.{'\n'}Tap + to add one.</Text>}
        contentContainerStyle={styles.list}
      />

      {onAddFact && (
        <TouchableOpacity style={styles.fab} onPress={onAddFact} accessibilityLabel="Add new fact">
          <Text style={styles.fabText}>＋</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0ece1' },
  countBar: { paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0d8c8' },
  count: { fontSize: 12, color: '#888' },
  list: { paddingVertical: 8, paddingBottom: 80 },
  empty: { textAlign: 'center', color: '#888', marginTop: 60, fontSize: 15, lineHeight: 24 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#5a7a3a',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 32 },
});
