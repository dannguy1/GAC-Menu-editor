/**
 * ConfirmDialog — confirmation for destructive actions.
 * Implements FR-M08, FR-F06.
 */
import React from 'react';
import { Alert } from 'react-native';

export function showConfirmDialog({ title, message, confirmText = 'Delete', onConfirm, onCancel }) {
  Alert.alert(
    title,
    message,
    [
      { text: 'Cancel', style: 'cancel', onPress: onCancel },
      { text: confirmText, style: 'destructive', onPress: onConfirm },
    ],
    { cancelable: true }
  );
}

export default showConfirmDialog;
