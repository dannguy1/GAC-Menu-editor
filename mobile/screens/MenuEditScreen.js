/**
 * MenuEditScreen — add/edit menu items.
 * Implements FR-M02, FR-M03, FR-M04, FR-M05, FR-M08, FR-M10.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import PhotoCapture from '../components/PhotoCapture';
import showConfirmDialog from '../components/ConfirmDialog';
import { createItem, updateItem, deleteItem, uploadImage as apiUploadImage } from '../services/api';

export default function MenuEditScreen({
  item,
  categories,
  token,
  activeLocation,
  serverHost,
  onSaved,
  onDeleted,
  onBack,
  showToast,
  readOnly,
}) {
  const isNew = !item;
  const [itemName, setItemName] = useState(item?.item_name || '');
  const [itemViet, setItemViet] = useState(item?.item_viet || '');
  const [pronunciation, setPronunciation] = useState(item?.pronunciation || '');
  const [description, setDescription] = useState(item?.description || '');
  const [descriptionViet, setDescriptionViet] = useState(item?.description_viet || '');
  const [price, setPrice] = useState(item?.price != null ? String(item.price) : '');
  const [category, setCategory] = useState(item?.category || (categories[0] || ''));
  const [popular, setPopular] = useState(item?.popular ?? false);
  const [available, setAvailable] = useState(item?.available ?? true);
  const [imageUri, setImageUri] = useState(null);
  const [imagePath, setImagePath] = useState(item?.image_path || null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const locationId = activeLocation?.location_id;

  function validate() {
    const e = {};
    if (!itemName.trim()) e.itemName = 'Item name is required';
    if (!description.trim()) e.description = 'Description is required';
    if (!category.trim()) e.category = 'Category is required';
    const p = parseFloat(price);
    if (isNaN(p) || p < 0) e.price = 'Price must be a number ≥ 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      let finalImagePath = imagePath;

      // Upload new image if selected
      if (imageUri) {
        setUploading(true);
        const uploaded = await apiUploadImage(token, locationId, imageUri, itemName, category);
        finalImagePath = uploaded.image_path;
        setUploading(false);
      }

      const payload = {
        item_name: itemName.trim(),
        item_viet: itemViet.trim() || null,
        pronunciation: pronunciation.trim() || null,
        description: description.trim(),
        description_viet: descriptionViet.trim() || null,
        price: parseFloat(price),
        category: category.trim(),
        popular,
        available,
        image_path: finalImagePath,
      };

      if (isNew) {
        const resp = await createItem(token, locationId, payload);
        showToast('Item saved successfully', 'success');
        onSaved(resp.item, true);
      } else {
        const resp = await updateItem(token, locationId, item.item_id, payload);
        showToast('Item saved successfully', 'success');
        onSaved(resp.item, false);
      }
    } catch (err) {
      setUploading(false);
      showToast(err.message || 'Failed to save. Check connection.', 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    showConfirmDialog({
      title: 'Delete Item',
      message: `Delete "${itemName}"? This cannot be undone.`,
      confirmText: '🗑 Delete',
      onConfirm: async () => {
        try {
          await deleteItem(token, locationId, item.item_id);
          showToast('Item deleted', 'success');
          onDeleted(item.item_id);
        } catch (err) {
          showToast(err.message || 'Failed to delete', 'error');
        }
      },
    });
  }

  const displayImageUri =
    imageUri ||
    (imagePath && serverHost
      ? `${serverHost}/locations/${locationId}/${imagePath.replace('./', '')}`
      : null);

  const allCategories = [...new Set([...categories, category].filter(Boolean))];

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} accessibilityLabel="Back">
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{isNew ? 'Add Item' : 'Edit Item'}</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || readOnly}
          style={[styles.saveNavBtn, (saving || readOnly) && styles.btnDisabled]}
          accessibilityLabel="Save item"
        >
          {saving ? <ActivityIndicator color="#5a7a3a" size="small" /> : <Text style={styles.saveNavText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <PhotoCapture imageUri={displayImageUri} uploading={uploading} onImageSelected={setImageUri} />

          <View style={styles.fields}>
            <Field label="Item Name (English) *" error={errors.itemName}>
              <TextInput
                style={[styles.input, errors.itemName && styles.inputError]}
                value={itemName}
                onChangeText={setItemName}
                placeholder="e.g. Honey Walnut Shrimps"
                placeholderTextColor="#888"
                testID="item-name-input"
              />
            </Field>

            <Field label="Vietnamese Name">
              <TextInput
                style={styles.input}
                value={itemViet}
                onChangeText={setItemViet}
                placeholder="Vietnamese name"
                placeholderTextColor="#888"
              />
            </Field>

            <Field label="Pronunciation">
              <TextInput
                style={styles.input}
                value={pronunciation}
                onChangeText={setPronunciation}
                placeholder="Phonetic guide"
                placeholderTextColor="#888"
              />
            </Field>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Field label="Category *" error={errors.category}>
                  <View style={[styles.pickerWrapper, errors.category && styles.inputError]}>
                    <Picker selectedValue={category} onValueChange={setCategory}>
                      {allCategories.map((cat) => (
                        <Picker.Item key={cat} label={cat} value={cat} />
                      ))}
                    </Picker>
                  </View>
                </Field>
              </View>
              <View style={{ width: 110 }}>
                <Field label="Price (USD) *" error={errors.price}>
                  <TextInput
                    style={[styles.input, errors.price && styles.inputError]}
                    value={price}
                    onChangeText={setPrice}
                    placeholder="0.00"
                    placeholderTextColor="#888"
                    keyboardType="decimal-pad"
                    testID="price-input"
                  />
                </Field>
              </View>
            </View>

            <Field label="Description (English) *" error={errors.description}>
              <TextInput
                style={[styles.input, styles.multiline, errors.description && styles.inputError]}
                value={description}
                onChangeText={setDescription}
                placeholder="English description"
                placeholderTextColor="#888"
                multiline
                numberOfLines={3}
              />
            </Field>

            <Field label="Description (Vietnamese)">
              <TextInput
                style={[styles.input, styles.multiline]}
                value={descriptionViet}
                onChangeText={setDescriptionViet}
                placeholder="Vietnamese description"
                placeholderTextColor="#888"
                multiline
                numberOfLines={3}
              />
            </Field>

            <View style={styles.toggleRow}>
              <View style={styles.toggle}>
                <Text style={styles.toggleLabel}>⭐ Popular</Text>
                <Switch
                  value={popular}
                  onValueChange={setPopular}
                  trackColor={{ false: '#ccc', true: '#c8a84b' }}
                  thumbColor={popular ? '#fff' : '#f4f4f4'}
                />
              </View>
              <View style={styles.toggle}>
                <Text style={styles.toggleLabel}>✓ Available</Text>
                <Switch
                  value={available}
                  onValueChange={setAvailable}
                  trackColor={{ false: '#ccc', true: '#5a7a3a' }}
                  thumbColor={available ? '#fff' : '#f4f4f4'}
                />
              </View>
            </View>

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
                <Text style={styles.deleteBtnText}>🗑 Delete Item</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({ label, error, children }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={fieldStyles.label}>{label}</Text>
      {children}
      {error ? <Text style={fieldStyles.error}>{error}</Text> : null}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', color: '#2c2c2c', marginBottom: 6 },
  error: { fontSize: 12, color: '#d32f2f', marginTop: 4 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf9f6' },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#2e7d6f',
    borderBottomWidth: 1,
    borderBottomColor: '#e0d8c8',
  },
  backBtn: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  backText: { color: '#fff', fontSize: 16 },
  navTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#fff' },
  saveNavBtn: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' },
  saveNavText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  form: { paddingBottom: 40 },
  fields: { paddingHorizontal: 16, paddingTop: 16 },
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
  multiline: { height: 80, textAlignVertical: 'top' },
  pickerWrapper: {
    backgroundColor: '#faf9f6',
    borderWidth: 1,
    borderColor: '#e0d8c8',
    borderRadius: 8,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  toggleRow: { flexDirection: 'row', marginVertical: 16 },
  toggle: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 8 },
  toggleLabel: { fontSize: 15, color: '#2c2c2c' },
  saveBtn: { backgroundColor: '#5a7a3a', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  deleteBtn: { backgroundColor: '#d32f2f', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  deleteBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
