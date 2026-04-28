/**
 * SettingsScreen — server config, deploy, account, data summary.
 * Implements FR-S03, FR-P04, FR-P06, FR-A04, FR-A05, FR-DM01-DM03.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import SettingsModal from '../components/SettingsModal';
import {
  changePassword,
  deploy,
  exportZip,
  testConnection,
  getVersion,
} from '../services/api';
import { saveServerHost } from '../services/auth';

export default function SettingsScreen({
  token,
  serverHost,
  activeLocation,
  menuItems,
  facts,
  isConnected,
  onSignOut,
  onChangeHost,
  onSwitchLocation,
  onRefreshAll,
  showToast,
}) {
  const [showHostModal, setShowHostModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  // Password change state
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  async function handleDeploy() {
    if (!activeLocation) return;
    setDeploying(true);
    try {
      const result = await deploy(token, activeLocation.location_id);
      const results = result.results || [];
      if (results.length === 0) {
        showToast('No deploy targets configured', 'warning');
      } else {
        const ok = results.filter((r) => r.status === 'success').length;
        const failed = results.filter((r) => r.status !== 'success').length;
        if (failed === 0) {
          showToast(`Published to ${ok} target${ok !== 1 ? 's' : ''}`, 'success');
        } else if (ok === 0) {
          showToast(`Deploy failed: all ${failed} target${failed !== 1 ? 's' : ''} failed`, 'error');
        } else {
          showToast(`Published: ${ok} ok, ${failed} failed`, 'warning');
        }
      }
      onRefreshAll();
    } catch (err) {
      showToast(err.message || 'Deploy failed', 'error');
    } finally {
      setDeploying(false);
    }
  }

  async function handleTestConnection() {
    setTestingConnection(true);
    const ok = await testConnection(serverHost);
    setTestingConnection(false);
    showToast(ok ? '● Server connected' : '✗ Cannot reach server', ok ? 'success' : 'error');
  }

  async function handleSaveHost(newHost) {
    setShowHostModal(false);
    await saveServerHost(newHost);
    onChangeHost(newHost);
    showToast('Server host updated', 'info');
  }

  async function handleForceRefresh() {
    setRefreshing(true);
    try {
      await onRefreshAll();
      showToast('Data refreshed', 'success');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleExport() {
    if (!activeLocation) return;
    try {
      showToast('Preparing export...', 'info');
      await exportZip(token, activeLocation.location_id);
      showToast('Export started', 'success');
    } catch (err) {
      showToast(err.message || 'Export failed', 'error');
    }
  }

  async function handleChangePassword() {
    if (!currentPwd || !newPwd) return setPwdError('Both fields are required');
    if (newPwd.length < 6) return setPwdError('New password must be at least 6 characters');
    setSavingPwd(true);
    setPwdError('');
    try {
      await changePassword(token, currentPwd, newPwd);
      setShowPasswordModal(false);
      setCurrentPwd('');
      setNewPwd('');
      showToast('Password updated', 'success');
    } catch (err) {
      setPwdError(err.message || 'Failed to change password');
    } finally {
      setSavingPwd(false);
    }
  }

  const deployTargetCount = activeLocation?.deploy_targets?.length ?? 0;
  const lastDeployed = activeLocation?.last_deployed_at
    ? new Date(activeLocation.last_deployed_at).toLocaleString()
    : 'Never deployed';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Server Connection */}
      <Section title="Server Connection">
        <Text style={styles.meta}>Host: {serverHost}</Text>
        <Text style={[styles.meta, { color: isConnected ? '#5a7a3a' : '#d32f2f' }]}>
          Status: {isConnected ? '● Connected' : '○ Disconnected'}
        </Text>
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.outlineBtn} onPress={handleTestConnection} disabled={testingConnection}>
            {testingConnection ? <ActivityIndicator size="small" color="#5a7a3a" /> : <Text style={styles.outlineBtnText}>Test Connection</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.outlineBtn} onPress={() => setShowHostModal(true)}>
            <Text style={styles.outlineBtnText}>Change Host</Text>
          </TouchableOpacity>
        </View>
      </Section>

      {/* Deploy */}
      {activeLocation && (
        <Section title="Deploy Data">
          <Text style={styles.meta}>Location: {activeLocation.name}</Text>
          <Text style={styles.meta}>Targets: {deployTargetCount} configured</Text>
          <Text style={styles.meta}>Last deployed: {lastDeployed}</Text>
          <TouchableOpacity
            style={[styles.primaryBtn, deploying && styles.btnDisabled]}
            onPress={handleDeploy}
            disabled={deploying}
          >
            {deploying ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>📤 Deploy Now</Text>}
          </TouchableOpacity>
        </Section>
      )}

      {/* Account */}
      <Section title="Account">
        <TouchableOpacity style={styles.outlineBtn} onPress={() => setShowPasswordModal(true)}>
          <Text style={styles.outlineBtnText}>Change Password</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.outlineBtn, { borderColor: '#d32f2f', marginTop: 8 }]} onPress={onSignOut}>
          <Text style={[styles.outlineBtnText, { color: '#d32f2f' }]}>Sign Out</Text>
        </TouchableOpacity>
      </Section>

      {/* Data Summary */}
      {activeLocation && (
        <Section title="Data Summary">
          <Text style={styles.meta}>Menu Items: {menuItems.length}</Text>
          <Text style={styles.meta}>Facts: {facts.length}</Text>
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.outlineBtn} onPress={handleForceRefresh} disabled={refreshing}>
              {refreshing ? <ActivityIndicator size="small" color="#5a7a3a" /> : <Text style={styles.outlineBtnText}>↺ Force Refresh</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.outlineBtn} onPress={handleExport}>
              <Text style={styles.outlineBtnText}>📦 Export ZIP</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.outlineBtn, { marginTop: 8 }]} onPress={onSwitchLocation}>
            <Text style={styles.outlineBtnText}>Switch Location</Text>
          </TouchableOpacity>
        </Section>
      )}

      {/* About */}
      <Section title="About">
        <Text style={styles.meta}>GAC Menu Editor v1.0.0</Text>
        <Text style={styles.meta}>Expo SDK 54 | React Native 0.81</Text>
      </Section>

      {/* Host Modal */}
      <SettingsModal
        visible={showHostModal}
        currentHost={serverHost}
        onSave={handleSaveHost}
        onCancel={() => setShowHostModal(false)}
      />

      {/* Password Change Modal */}
      <Modal visible={showPasswordModal} transparent animationType="slide" onRequestClose={() => { setShowPasswordModal(false); setCurrentPwd(''); setNewPwd(''); setPwdError(''); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.handle} />
            <Text style={styles.modalTitle}>Change Password</Text>

            <Text style={styles.label}>Current Password</Text>
            <TextInput
              style={styles.input}
              value={currentPwd}
              onChangeText={setCurrentPwd}
              secureTextEntry
              placeholder="Current password"
              placeholderTextColor="#888"
            />

            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={styles.input}
              value={newPwd}
              onChangeText={setNewPwd}
              secureTextEntry
              placeholder="New password (min 6 chars)"
              placeholderTextColor="#888"
            />

            {pwdError ? <Text style={styles.errorText}>{pwdError}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryBtn, savingPwd && styles.btnDisabled]}
              onPress={handleChangePassword}
              disabled={savingPwd}
            >
              {savingPwd ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Update Password</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowPasswordModal(false); setCurrentPwd(''); setNewPwd(''); setPwdError(''); }}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Section({ title, children }) {
  return (
    <View style={sectionStyles.section}>
      <Text style={sectionStyles.title}>{title}</Text>
      <View style={sectionStyles.body}>{children}</View>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  section: { marginBottom: 20 },
  title: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  body: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0d8c8',
    padding: 16,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0ece1' },
  content: { padding: 16, paddingBottom: 40 },
  meta: { fontSize: 14, color: '#555', marginBottom: 4 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  primaryBtn: {
    backgroundColor: '#5a7a3a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  outlineBtn: {
    borderWidth: 1,
    borderColor: '#5a7a3a',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  outlineBtnText: { color: '#5a7a3a', fontSize: 13, fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },
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
  errorText: { fontSize: 12, color: '#d32f2f', marginTop: 8 },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { color: '#888', fontSize: 14 },
});
