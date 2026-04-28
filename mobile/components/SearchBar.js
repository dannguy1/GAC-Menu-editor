/**
 * SearchBar component with debounce.
 * Implements FR-M07, FR-F07.
 */
import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

export default function SearchBar({ placeholder = 'Search...', onSearch, testID }) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => onSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder={`🔍 ${placeholder}`}
        placeholderTextColor="#888"
        clearButtonMode="while-editing"
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0d8c8',
  },
  input: {
    backgroundColor: '#faf9f6',
    borderWidth: 1,
    borderColor: '#e0d8c8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#2c2c2c',
  },
});
