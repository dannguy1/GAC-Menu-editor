/**
 * PhotoCapture — image capture area with camera/gallery picker and preview.
 * Implements FR-I01, FR-I02.
 */
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { pickFromCamera, pickFromGallery } from '../services/imageHelper';

export default function PhotoCapture({ imageUri, uploading, onImageSelected }) {
  function handleTap() {
    Alert.alert('Select Image', 'Choose a source', [
      { text: '📷 Take Photo', onPress: () => handlePick('camera') },
      { text: '🖼 Choose from Gallery', onPress: () => handlePick('gallery') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function handlePick(source) {
    try {
      const result = source === 'camera' ? await pickFromCamera() : await pickFromGallery();
      if (!result.cancelled && result.uri) {
        onImageSelected(result.uri);
      }
    } catch (err) {
      Alert.alert('Permission Error', err.message);
    }
  }

  return (
    <TouchableOpacity style={styles.container} onPress={handleTap} accessibilityLabel="Tap to capture or choose image">
      {uploading && (
        <View style={styles.uploadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.preview} />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.icon}>📷</Text>
          <Text style={styles.hint}>Tap to take photo</Text>
          <Text style={styles.hint2}>or choose from gallery</Text>
        </View>
      )}
      <View style={styles.tapHint}>
        <Text style={styles.tapHintText}>Tap to change</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 180,
    backgroundColor: '#f0ece1',
    borderBottomWidth: 1,
    borderBottomColor: '#e0d8c8',
    overflow: 'hidden',
  },
  preview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 40,
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: '#555',
    fontWeight: '600',
  },
  hint2: {
    fontSize: 12,
    color: '#888',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  tapHint: {
    position: 'absolute',
    bottom: 8,
    right: 12,
  },
  tapHintText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
});
