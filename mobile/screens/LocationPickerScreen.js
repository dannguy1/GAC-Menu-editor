/**
 * LocationPickerScreen — select active location.
 * Implements FR-L01, FR-L06, FR-L07, FR-L10.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import LocationCard from '../components/LocationCard';
import { createLocation } from '../services/api';

export default function LocationPickerScreen({ locations, loading, token, onSelectLocation, onRefresh }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState('');

  async function handleAddLocation() {
    if (!newName.trim()) return setAddError('Location name is required');
    setSaving(true);
    setAddError('');
    try {
      await createLocation(token, newName.trim(), newAddress.trim() || undefined);
      setShowAddModal(false);
      setNewName('');
      setNewAddress('');
      onRefresh();
    } catch (err) {
      setAddError(err.message || 'Failed to create location');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Select Location</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#5a7a3a" style={styles.loader} />
      ) : (
        <FlatList
          data={locations}
          keyExtractor={(item) => item.location_id}
          renderItem={({ item }) => (
            <LocationCard location={item} onPress={onSelectLocation} />
          )}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor="#5a7a3a" />}
          ListEmptyComponent={
            <Text style={styles.empty}>No locations configured.{'\n'}Tap + to add one.</Text>
          }
          contentContainerStyle={styles.list}
        />
      )}

      {/* FAB for adding location */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddModal(true)}
        accessibilityLabel="Add new location"
      >
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>

      {/* Add Location Modal */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalSheet}>
            <View style={styles.handle} />
            <Text style={styles.modalTitle}>Add Location</Text>

            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Garden Grove"
              placeholderTextColor="#888"
              autoCapitalize="words"
              autoCorrect={false}
              spellCheck={false}
              textContentType="none"
              autoComplete="off"
              testID="location-name-input"
            />

            <Text style={styles.label}>Address</Text>
            <TextInput
              style={styles.input}
              value={newAddress}
              onChangeText={setNewAddress}
              placeholder="e.g. 9892 Westminster Ave"
              placeholderTextColor="#888"
              autoCapitalize="words"
              autoCorrect={false}
              spellCheck={false}
              textContentType="none"
              autoComplete="off"
            />

            {addError ? <Text style={styles.error}>{addError}</Text> : null}

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.btnDisabled]}
              onPress={handleAddLocation}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Add Location</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddModal(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0ece1' },
  header: { padding: 16, backgroundColor: '#5a7a3a' },
  title: { fontSize: 20, fontWeight: '800', color: '#fff' },
  loader: { marginTop: 60 },
  list: { paddingVertical: 12, paddingBottom: 80 },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  handle: { width: 40, height: 4, backgroundColor: '#ccc', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#2c2c2c', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#2c2c2c', marginBottom: 6, marginTop: 12 },
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
  error: { color: '#d32f2f', fontSize: 13, marginTop: 8 },
  saveBtn: {
    backgroundColor: '#5a7a3a',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { color: '#888', fontSize: 14 },
});
