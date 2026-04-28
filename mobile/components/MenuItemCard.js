/**
 * MenuItemCard — item card for the menu list.
 * Implements FR-M01, FR-M09 - display with popular badge.
 */
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function MenuItemCard({ item, serverHost, onPress }) {
  const imageUri =
    item.image_path && serverHost
      ? `${serverHost}/locations/${item._locationId || ''}/${item.image_path.replace('./', '')}`
      : null;

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(item)} accessibilityLabel={`Edit ${item.item_name}`}>
      <View style={styles.imageContainer}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Text style={styles.placeholderText}>🍽</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{item.item_name}</Text>
          {item.popular && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>⭐ POPULAR</Text>
            </View>
          )}
        </View>
        {item.item_viet ? (
          <Text style={styles.viet} numberOfLines={1}>{item.item_viet}</Text>
        ) : null}
        <View style={styles.footer}>
          <Text style={styles.category}>{item.category}</Text>
          <Text style={styles.price}>${Number(item.price).toFixed(2)}</Text>
        </View>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0d8c8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 6,
  },
  imageContainer: {
    width: 72,
    height: 72,
  },
  image: {
    width: 72,
    height: 72,
    resizeMode: 'cover',
  },
  placeholder: {
    backgroundColor: '#f0ece1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 28,
  },
  info: {
    flex: 1,
    padding: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2c2c2c',
    flexShrink: 1,
  },
  badge: {
    backgroundColor: '#c8a84b',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  viet: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#888',
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  category: {
    fontSize: 12,
    color: '#666',
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5a7a3a',
  },
  chevron: {
    fontSize: 22,
    color: '#888',
    paddingRight: 12,
  },
});
