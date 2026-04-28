/**
 * Image helper — camera/gallery picker and upload.
 * Implements FR-I01, FR-I02, FR-I03.
 */
import * as ImagePicker from 'expo-image-picker';
import { uploadImage as apiUploadImage } from './api';

/**
 * Request camera permission and capture a photo.
 * Returns { uri, cancelled } where uri is the local image URI on success.
 */
export async function pickFromCamera() {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Camera permission is required to take photos.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.9,
  });

  if (result.canceled) {
    return { cancelled: true, uri: null };
  }
  return { cancelled: false, uri: result.assets[0].uri };
}

/**
 * Request media library permission and pick an image.
 * Returns { uri, cancelled }.
 */
export async function pickFromGallery() {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Photo library permission is required to select images.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.9,
  });

  if (result.canceled) {
    return { cancelled: true, uri: null };
  }
  return { cancelled: false, uri: result.assets[0].uri };
}

/**
 * Upload an image to the backend for a specific location.
 * Returns { image_path } on success.
 */
export async function uploadImage(uri, locationId, itemName, category, token) {
  return apiUploadImage(token, locationId, uri, itemName, category);
}
