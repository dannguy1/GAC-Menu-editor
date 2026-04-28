/**
 * MenuListScreen — browse and search menu items.
 * Implements FR-M01, FR-M06, FR-M07, FR-M09, NFR-U01.
 */
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import CategoryPicker from '../components/CategoryPicker';
import MenuItemCard from '../components/MenuItemCard';
import SearchBar from '../components/SearchBar';
import { bestScore } from '../services/fuzzySearch';

export default function MenuListScreen({
  menuItems,
  categories,
  loading,
  serverHost,
  activeLocation,
  onEditItem,
  onAddItem,
  onRefresh,
}) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('');

  const filtered = useMemo(() => {
    let items = menuItems;
    if (activeCategory) {
      items = items.filter((i) => i.category === activeCategory);
    }
    if (search) {
      const scored = items
        .map((i) => ({ item: i, score: bestScore(search, i.item_name, i.item_viet) }))
        .filter((s) => s.score >= 0);
      scored.sort((a, b) => a.score - b.score);
      items = scored.map((s) => s.item);
    }
    return items;
  }, [menuItems, activeCategory, search]);

  // Attach locationId for image URLs
  const itemsWithLocation = filtered.map((i) => ({ ...i, _locationId: activeLocation?.location_id }));

  return (
    <View style={styles.container}>
      <SearchBar placeholder="Search by name..." onSearch={setSearch} />
      <CategoryPicker categories={categories} activeCategory={activeCategory} onSelect={setActiveCategory} />

      <View style={styles.countBar}>
        <Text style={styles.count}>{filtered.length} item{filtered.length !== 1 ? 's' : ''}</Text>
      </View>

      <FlatList
        data={itemsWithLocation}
        keyExtractor={(item) => item.item_id}
        renderItem={({ item }) => (
          <MenuItemCard item={item} serverHost={serverHost} onPress={onEditItem} />
        )}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor="#5a7a3a" />}
        ListEmptyComponent={
          <Text style={styles.empty}>No items found.{'\n'}Tap + to add one.</Text>
        }
        contentContainerStyle={styles.list}
      />

      {onAddItem && (
        <TouchableOpacity style={styles.fab} onPress={onAddItem} accessibilityLabel="Add new menu item">
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
