/**
 * LocationCard — location card for the picker screen.
 * Implements FR-L10.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function LocationCard({ location, onPress }) {
  const deployStatus = location.last_deployed_at
    ? `Last deployed: ${new Date(location.last_deployed_at).toLocaleString()}`
    : 'Never deployed';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(location)}
      accessibilityLabel={`Select location ${location.name}`}
    >
      <Text style={styles.icon}>📍</Text>
      <View style={styles.info}>
        <Text style={styles.name}>{location.name}</Text>
        {location.address ? <Text style={styles.address}>{location.address}</Text> : null}
        <Text style={styles.meta}>
          {location.item_count ?? 0} items · {location.fact_count ?? 0} facts
        </Text>
        <Text style={styles.deploy}>{deployStatus}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    minHeight: 44,
  },
  icon: {
    fontSize: 24,
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2c2c2c',
  },
  address: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  meta: {
    fontSize: 12,
    color: '#555',
    marginTop: 4,
  },
  deploy: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    color: '#888',
    marginLeft: 8,
  },
});
