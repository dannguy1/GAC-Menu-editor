/**
 * FactEditScreen — add/edit a fact.
 * Implements FR-F02, FR-F03, FR-F04, FR-F05, FR-F06.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import showConfirmDialog from '../components/ConfirmDialog';
import { createFact, updateFact, deleteFact } from '../services/api';

const FACT_TYPES = ['general_info', 'promotion', 'announcement', 'hours', 'policy'];

export default function FactEditScreen({ fact, token, activeLocation, onSaved, onDeleted, onBack, showToast, readOnly }) {
  const isNew = !fact;
  const [topic, setTopic] = useState(fact?.topic || '');
  const [content, setContent] = useState(fact?.content || '');
  const [type, setType] = useState(fact?.type || 'general_info');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const locationId = activeLocation?.location_id;

  function validate() {
    const e = {};
    if (!topic.trim()) e.topic = 'Topic is required';
    if (!content.trim()) e.content = 'Content is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { topic: topic.trim(), content: content.trim(), type };
      if (isNew) {
        const resp = await createFact(token, locationId, payload);
        showToast('Fact saved successfully', 'success');
        onSaved(resp.fact, true);
      } else {
        const resp = await updateFact(token, locationId, fact.fact_id, payload);
        showToast('Fact saved successfully', 'success');
        onSaved(resp.fact, false);
      }
    } catch (err) {
      showToast(err.message || 'Failed to save. Check connection.', 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    showConfirmDialog({
      title: 'Delete Fact',
      message: `Delete "${topic}"? This cannot be undone.`,
      confirmText: '🗑 Delete',
      onConfirm: async () => {
        try {
          await deleteFact(token, locationId, fact.fact_id);
          showToast('Fact deleted', 'success');
          onDeleted(fact.fact_id);
        } catch (err) {
          showToast(err.message || 'Failed to delete', 'error');
        }
      },
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} accessibilityLabel="Back">
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{isNew ? 'Add Fact' : 'Edit Fact'}</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || readOnly}
          style={[styles.saveNavBtn, (saving || readOnly) && styles.btnDisabled]}
        >
          {saving ? <ActivityIndicator color="#5a7a3a" size="small" /> : <Text style={styles.saveNavText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Topic *</Text>
          <TextInput
            style={[styles.input, errors.topic && styles.inputError]}
            value={topic}
            onChangeText={setTopic}
            placeholder="e.g. Restaurant Overview"
            placeholderTextColor="#888"
            testID="fact-topic-input"
          />
          {errors.topic ? <Text style={styles.errorText}>{errors.topic}</Text> : null}

          <Text style={styles.label}>Type</Text>
          <View style={styles.pickerWrapper}>
            <Picker selectedValue={type} onValueChange={setType}>
              {FACT_TYPES.map((t) => (
                <Picker.Item key={t} label={t} value={t} />
              ))}
            </Picker>
          </View>

          <Text style={styles.label}>Content *</Text>
          <TextInput
            style={[styles.input, styles.multiline, errors.content && styles.inputError]}
            value={content}
            onChangeText={setContent}
            placeholder="Fact content..."
            placeholderTextColor="#888"
            multiline
            numberOfLines={6}
            testID="fact-content-input"
          />
          {errors.content ? <Text style={styles.errorText}>{errors.content}</Text> : null}

          {!readOnly && (
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.btnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          )}

          {!isNew && !readOnly && (
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Text style={styles.deleteBtnText}>🗑 Delete Fact</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf9f6' },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#2e7d6f',
  },
  backBtn: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  backText: { color: '#fff', fontSize: 16 },
  navTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#fff' },
  saveNavBtn: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' },
  saveNavText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  form: { padding: 16, paddingBottom: 40 },
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
  inputError: { borderColor: '#d32f2f', borderWidth: 2 },
  multiline: { height: 140, textAlignVertical: 'top' },
  pickerWrapper: {
    backgroundColor: '#faf9f6',
    borderWidth: 1,
    borderColor: '#e0d8c8',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 4,
  },
  errorText: { fontSize: 12, color: '#d32f2f', marginTop: 4 },
  saveBtn: { backgroundColor: '#5a7a3a', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  deleteBtn: { backgroundColor: '#d32f2f', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  deleteBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
