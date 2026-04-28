/**
 * LoginScreen — server config + authentication.
 * Implements FR-A01-A03, FR-S02, FR-S03.
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
import { login, testConnection } from '../services/api';
import { saveToken, saveServerHost } from '../services/auth';

export default function LoginScreen({ serverHost, onLoginSuccess, onChangeHost }) {
  const [host, setHost] = useState(serverHost || '');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState(null);

  async function handleSignIn() {
    if (!host.trim()) return setError('Please enter the server host');
    if (!username.trim()) return setError('Please enter a username');
    if (!password) return setError('Please enter a password');

    setLoading(true);
    setError('');
    try {
      const data = await login(host.trim(), username, password);
      await saveToken(data.access_token);
      await saveServerHost(host.trim());
      onLoginSuccess(data.access_token, data.password_is_default, host.trim());
    } catch (err) {
      setError(err.message || 'Sign in failed. Check your credentials and connection.');
    } finally {
      setLoading(false);
    }
  }

  async function handleTestConnection() {
    if (!host.trim()) return setError('Please enter the server host');
    setTesting(true);
    setConnectionStatus(null);
    setError('');
    const ok = await testConnection(host.trim());
    setTesting(false);
    setConnectionStatus(ok ? 'connected' : 'failed');
    if (!ok) setError('Cannot reach server. Check host and ensure backend is running.');
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.icon}>🍽</Text>
          <Text style={styles.title}>GAC Menu Editor</Text>
          <Text style={styles.subtitle}>Garlic & Chives Menu Manager</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Server Host</Text>
          <TextInput
            style={styles.input}
            value={host}
            onChangeText={setHost}
            placeholder="192.168.10.3:8100"
            placeholderTextColor="#888"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            testID="host-input"
          />

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="admin"
            placeholderTextColor="#888"
            autoCapitalize="none"
            autoCorrect={false}
            testID="username-input"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#888"
            secureTextEntry
            testID="password-input"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {connectionStatus === 'connected' && (
            <Text style={styles.success}>● Server connected</Text>
          )}

          <TouchableOpacity
            style={[styles.signInBtn, loading && styles.btnDisabled]}
            onPress={handleSignIn}
            disabled={loading}
            accessibilityLabel="Sign in"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.signInBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.testBtn}
            onPress={handleTestConnection}
            disabled={testing}
            accessibilityLabel="Test connection"
          >
            {testing ? (
              <ActivityIndicator color="#5a7a3a" />
            ) : (
              <Text style={styles.testBtnText}>Test Connection</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 40 },
  header: { alignItems: 'center', marginBottom: 40 },
  icon: { fontSize: 56, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#2c2c2c' },
  subtitle: { fontSize: 14, color: '#888', marginTop: 4 },
  form: { width: '100%' },
  label: { fontSize: 14, fontWeight: '600', color: '#2c2c2c', marginBottom: 6, marginTop: 14 },
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
  success: { color: '#5a7a3a', fontSize: 13, marginTop: 8 },
  signInBtn: {
    backgroundColor: '#5a7a3a',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  btnDisabled: { opacity: 0.6 },
  signInBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  testBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  testBtnText: { color: '#5a7a3a', fontSize: 14, fontWeight: '600' },
});
