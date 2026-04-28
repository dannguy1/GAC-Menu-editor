/**
 * App.js — root component with auth gate, location selection, and navigation.
 * All primary state lives here. Implements FR-A01, FR-A02, FR-A04, FR-A06,
 * FR-A07, FR-D05, FR-L06, FR-L07, docs/02_System_Design.md §2.2, §8.1, §10.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

import LoginScreen from './screens/LoginScreen';
import LocationPickerScreen from './screens/LocationPickerScreen';
import MenuListScreen from './screens/MenuListScreen';
import MenuEditScreen from './screens/MenuEditScreen';
import FactsListScreen from './screens/FactsListScreen';
import FactEditScreen from './screens/FactEditScreen';
import SettingsScreen from './screens/SettingsScreen';
import Toast from './components/Toast';

import {
  getLocations,
  getItems,
  getCategories,
  getFacts,
  setServerHost as apiSetServerHost,
  AuthError,
} from './services/api';
import {
  getToken,
  clearToken,
  getServerHost,
  saveLastLocation,
  getLastLocation,
} from './services/auth';

export default function App() {
  // -------------------------------------------------------------------------
  // Auth state
  // -------------------------------------------------------------------------
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState(null);
  const [passwordIsDefault, setPasswordIsDefault] = useState(false);

  // -------------------------------------------------------------------------
  // Location state
  // -------------------------------------------------------------------------
  const [locations, setLocations] = useState([]);
  const [activeLocation, setActiveLocation] = useState(null);

  // -------------------------------------------------------------------------
  // Navigation state
  // -------------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState('menu');
  const [editingItem, setEditingItem] = useState(undefined); // undefined = list, null = new, object = edit
  const [editingFact, setEditingFact] = useState(undefined);

  // -------------------------------------------------------------------------
  // Data state
  // -------------------------------------------------------------------------
  const [menuItems, setMenuItems] = useState([]);
  const [facts, setFacts] = useState([]);
  const [categories, setCategories] = useState([]);

  // -------------------------------------------------------------------------
  // Server / connection state
  // -------------------------------------------------------------------------
  const [serverHost, setServerHost] = useState('http://192.168.10.3:8100');
  const [isConnected, setIsConnected] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  // -------------------------------------------------------------------------
  // Toast state
  // -------------------------------------------------------------------------
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  // -------------------------------------------------------------------------
  // Orientation (landscape two-panel split — §10 NFR-U03)
  // -------------------------------------------------------------------------
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  // -------------------------------------------------------------------------
  // Offline cache key helpers (FR-D05)
  // -------------------------------------------------------------------------
  function cacheKeyItems(locationId) { return `gac_cache_items_${locationId}`; }
  function cacheKeyFacts(locationId) { return `gac_cache_facts_${locationId}`; }
  function cacheKeyCategories(locationId) { return `gac_cache_cats_${locationId}`; }

  async function persistCache(locationId, items, factsData, cats) {
    try {
      await AsyncStorage.multiSet([
        [cacheKeyItems(locationId), JSON.stringify(items)],
        [cacheKeyFacts(locationId), JSON.stringify(factsData)],
        [cacheKeyCategories(locationId), JSON.stringify(cats)],
      ]);
    } catch (_) {}
  }

  async function loadCache(locationId) {
    try {
      const values = await AsyncStorage.multiGet([
        cacheKeyItems(locationId),
        cacheKeyFacts(locationId),
        cacheKeyCategories(locationId),
      ]);
      return {
        items: values[0][1] ? JSON.parse(values[0][1]) : null,
        facts: values[1][1] ? JSON.parse(values[1][1]) : null,
        categories: values[2][1] ? JSON.parse(values[2][1]) : null,
      };
    } catch (_) {
      return { items: null, facts: null, categories: null };
    }
  }

  // -------------------------------------------------------------------------
  // App foreground tracking
  // -------------------------------------------------------------------------
  const appState = useRef(AppState.currentState);

  function showToast(message, type = 'success') {
    setToast({ visible: true, message, type });
  }

  function hideToast() {
    setToast((t) => ({ ...t, visible: false }));
  }

  // -------------------------------------------------------------------------
  // Startup: restore saved host & token, validate token
  // -------------------------------------------------------------------------
  useEffect(() => {
    async function init() {
      const savedHost = await getServerHost();
      const host = savedHost || 'http://192.168.10.3:8100';
      setServerHost(host);
      apiSetServerHost(host);

      const savedToken = await getToken();
      if (savedToken) {
        // Validate token by calling the JWT-protected locations endpoint (§8.1)
        try {
          const data = await getLocations(savedToken);
          setToken(savedToken);
          setIsAuthenticated(true);
          setIsConnected(true);
          setLocations(data.locations || []);

          // Restore last selected location
          const lastLocId = await getLastLocation();
          if (lastLocId && data.locations) {
            const lastLoc = data.locations.find((l) => l.location_id === lastLocId);
            if (lastLoc) {
              setActiveLocation(lastLoc);
              await loadLocationData(savedToken, lastLoc.location_id);
            }
          }
        } catch (err) {
          // 401 or network error — clear token and show login
          await clearToken();
          setIsAuthenticated(false);
          setIsConnected(false);
        }
      }
    }
    init();
  }, []);

  // Refresh data when app comes back to foreground (FR-D04)
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (appState.current !== 'active' && nextState === 'active' && isAuthenticated && activeLocation) {
        await loadLocationData(token, activeLocation.location_id);
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [isAuthenticated, activeLocation, token]);

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------
  async function loadLocations(tok) {
    setLoadingLocations(true);
    try {
      const data = await getLocations(tok || token);
      setLocations(data.locations || []);
      setIsConnected(true);
    } catch (err) {
      handleApiError(err);
    } finally {
      setLoadingLocations(false);
    }
  }

  async function loadLocationData(tok, locationId) {
    setLoadingData(true);
    try {
      const [itemsResp, factsResp, catsResp] = await Promise.all([
        getItems(tok, locationId),
        getFacts(tok, locationId),
        getCategories(tok, locationId),
      ]);
      const items = itemsResp.items || [];
      const factsData = factsResp.facts || [];
      const cats = catsResp.categories || [];
      setMenuItems(items);
      setFacts(factsData);
      setCategories(cats);
      setIsConnected(true);
      setIsOffline(false);
      await persistCache(locationId, items, factsData, cats);
    } catch (err) {
      if (err instanceof AuthError) {
        handleApiError(err);
      } else {
        // Server unreachable — try cached data (FR-D05)
        const cached = await loadCache(locationId);
        if (cached.items !== null) {
          setMenuItems(cached.items);
          setFacts(cached.facts || []);
          setCategories(cached.categories || []);
          setIsOffline(true);
          setIsConnected(false);
          showToast('Offline — showing cached data', 'warning');
        } else {
          setIsConnected(false);
          setIsOffline(false);
          showToast('Cannot connect to server', 'error');
        }
      }
    } finally {
      setLoadingData(false);
    }
  }

  function handleApiError(err) {
    if (err instanceof AuthError) {
      handleSignOut();
    } else {
      setIsConnected(false);
    }
  }

  // -------------------------------------------------------------------------
  // Auth handlers
  // -------------------------------------------------------------------------
  async function handleLoginSuccess(newToken, isDefault, host) {
    apiSetServerHost(host);
    setToken(newToken);
    setIsAuthenticated(true);
    setIsConnected(true);
    setPasswordIsDefault(isDefault);
    if (isDefault) {
      Alert.alert(
        'Change Default Password',
        'You are using the default password. Please change it in Settings for security.',
        [{ text: 'OK' }]
      );
    }
    await loadLocations(newToken);
  }

  async function handleSignOut() {
    await clearToken();
    setIsAuthenticated(false);
    setToken(null);
    setActiveLocation(null);
    setMenuItems([]);
    setFacts([]);
    setLocations([]);
    setEditingItem(undefined);
    setEditingFact(undefined);
    setActiveTab('menu');
  }

  // -------------------------------------------------------------------------
  // Location handlers
  // -------------------------------------------------------------------------
  async function handleSelectLocation(location) {
    setActiveLocation(location);
    await saveLastLocation(location.location_id);
    await loadLocationData(token, location.location_id);
    setEditingItem(undefined);
    setEditingFact(undefined);
    setActiveTab('menu');
  }

  function handleSwitchLocation() {
    setActiveLocation(null);
    setEditingItem(undefined);
    setEditingFact(undefined);
    loadLocations(token);
  }

  // -------------------------------------------------------------------------
  // Item handlers
  // -------------------------------------------------------------------------
  function handleItemSaved(savedItem, isNew) {
    setMenuItems((prev) =>
      isNew ? [...prev, savedItem] : prev.map((i) => (i.item_id === savedItem.item_id ? savedItem : i))
    );
    // Refresh categories in case a new category was added
    getCategories(token, activeLocation.location_id)
      .then((r) => setCategories(r.categories || []))
      .catch(() => {});
    setEditingItem(undefined);
  }

  function handleItemDeleted(itemId) {
    setMenuItems((prev) => prev.filter((i) => i.item_id !== itemId));
    setEditingItem(undefined);
  }

  // -------------------------------------------------------------------------
  // Fact handlers
  // -------------------------------------------------------------------------
  function handleFactSaved(savedFact, isNew) {
    setFacts((prev) =>
      isNew ? [...prev, savedFact] : prev.map((f) => (f.fact_id === savedFact.fact_id ? savedFact : f))
    );
    setEditingFact(undefined);
  }

  function handleFactDeleted(factId) {
    setFacts((prev) => prev.filter((f) => f.fact_id !== factId));
    setEditingFact(undefined);
  }

  async function handleRefreshAll() {
    await loadLocations(token);
    if (activeLocation) {
      await loadLocationData(token, activeLocation.location_id);
    }
  }

  function handleChangeHost(newHost) {
    setServerHost(newHost);
    apiSetServerHost(newHost);
  }

  // -------------------------------------------------------------------------
  // Render logic
  // -------------------------------------------------------------------------

  // Gate 1: not authenticated → show login
  if (!isAuthenticated) {
    return (
      <View style={styles.root}>
        <ExpoStatusBar style="dark" />
        <LoginScreen
          serverHost={serverHost}
          onLoginSuccess={handleLoginSuccess}
          onChangeHost={handleChangeHost}
        />
        <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
      </View>
    );
  }

  // Gate 2: no active location → show location picker
  if (!activeLocation) {
    return (
      <View style={styles.root}>
        <ExpoStatusBar style="light" />
        <LocationPickerScreen
          locations={locations}
          loading={loadingLocations}
          token={token}
          onSelectLocation={handleSelectLocation}
          onRefresh={() => loadLocations(token)}
        />
        <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
      </View>
    );
  }

  // Gate 3: editing an item (portrait only — landscape shows inline)
  if (editingItem !== undefined && !isLandscape) {
    return (
      <View style={styles.root}>
        <ExpoStatusBar style="light" />
        <MenuEditScreen
          key={editingItem?.item_id || '__new__'}
          item={editingItem}
          categories={categories}
          token={token}
          activeLocation={activeLocation}
          serverHost={serverHost}
          onSaved={handleItemSaved}
          onDeleted={handleItemDeleted}
          onBack={() => setEditingItem(undefined)}
          showToast={showToast}
          readOnly={isOffline}
        />
        <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
      </View>
    );
  }

  // Gate 4: editing a fact (portrait only — landscape shows inline)
  if (editingFact !== undefined && !isLandscape) {
    return (
      <View style={styles.root}>
        <ExpoStatusBar style="light" />
        <FactEditScreen
          key={editingFact?.fact_id || '__new__'}
          fact={editingFact}
          token={token}
          activeLocation={activeLocation}
          onSaved={handleFactSaved}
          onDeleted={handleFactDeleted}
          onBack={() => setEditingFact(undefined)}
          showToast={showToast}
          readOnly={isOffline}
        />
        <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
      </View>
    );
  }

  // Main app with three-tab navigation
  // In landscape: two-panel split for menu and facts tabs (§10 NFR-U03)
  const menuPanel = (
    <MenuListScreen
      menuItems={menuItems}
      categories={categories}
      loading={loadingData}
      serverHost={serverHost}
      activeLocation={activeLocation}
      onEditItem={(item) => setEditingItem(item)}
      onAddItem={isOffline ? undefined : () => setEditingItem(null)}
      onRefresh={() => loadLocationData(token, activeLocation.location_id)}
    />
  );

  const menuEditPanel = editingItem !== undefined ? (
    <MenuEditScreen
      key={editingItem?.item_id || '__new__'}
      item={editingItem}
      categories={categories}
      token={token}
      activeLocation={activeLocation}
      serverHost={serverHost}
      onSaved={handleItemSaved}
      onDeleted={handleItemDeleted}
      onBack={() => setEditingItem(undefined)}
      showToast={showToast}
      readOnly={isOffline}
    />
  ) : (
    <View style={styles.emptyPanel}>
      <Text style={styles.emptyPanelText}>Select an item to edit</Text>
    </View>
  );

  const factsPanel = (
    <FactsListScreen
      facts={facts}
      loading={loadingData}
      onEditFact={(fact) => setEditingFact(fact)}
      onAddFact={isOffline ? undefined : () => setEditingFact(null)}
      onRefresh={() => loadLocationData(token, activeLocation.location_id)}
    />
  );

  const factsEditPanel = editingFact !== undefined ? (
    <FactEditScreen
      key={editingFact?.fact_id || '__new__'}
      fact={editingFact}
      token={token}
      activeLocation={activeLocation}
      onSaved={handleFactSaved}
      onDeleted={handleFactDeleted}
      onBack={() => setEditingFact(undefined)}
      showToast={showToast}
      readOnly={isOffline}
    />
  ) : (
    <View style={styles.emptyPanel}>
      <Text style={styles.emptyPanelText}>Select a fact to edit</Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <ExpoStatusBar style="light" />

      {/* Header with active location name */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSwitchLocation} style={styles.locationBtn} accessibilityLabel="Switch location">
          <Text style={styles.locationName} numberOfLines={1}>
            📍 {activeLocation.name} ▼
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleRefreshAll}
          style={styles.refreshBtn}
          accessibilityLabel="Refresh data"
        >
          <Text style={styles.refreshIcon}>↺</Text>
        </TouchableOpacity>
      </View>

      {/* Offline banner (FR-D05) */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>📵 Offline — read only</Text>
        </View>
      )}

      {/* Screen content */}
      <View style={styles.content}>
        {activeTab === 'menu' && (
          isLandscape ? (
            <View style={styles.splitRow}>
              <View style={styles.splitLeft}>{menuPanel}</View>
              <View style={styles.splitRight}>{menuEditPanel}</View>
            </View>
          ) : menuPanel
        )}
        {activeTab === 'facts' && (
          isLandscape ? (
            <View style={styles.splitRow}>
              <View style={styles.splitLeft}>{factsPanel}</View>
              <View style={styles.splitRight}>{factsEditPanel}</View>
            </View>
          ) : factsPanel
        )}
        {activeTab === 'settings' && (
          <SettingsScreen
            token={token}
            serverHost={serverHost}
            activeLocation={activeLocation}
            menuItems={menuItems}
            facts={facts}
            isConnected={isConnected}
            onSignOut={handleSignOut}
            onChangeHost={handleChangeHost}
            onSwitchLocation={handleSwitchLocation}
            onRefreshAll={handleRefreshAll}
            showToast={showToast}
            readOnly={isOffline}
          />
        )}
      </View>

      {/* Bottom tab bar */}
      <View style={styles.tabBar}>
        {[
          { key: 'menu', icon: '🍽', label: 'Menu' },
          { key: 'facts', icon: 'ℹ️', label: 'Facts' },
          { key: 'settings', icon: '⚙️', label: 'Settings' },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={() => setActiveTab(tab.key)}
              accessibilityLabel={tab.label}
            >
              {isActive && <View style={styles.tabIndicator} />}
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5a7a3a',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
  },
  locationBtn: { flex: 1 },
  locationName: { fontSize: 17, fontWeight: '700', color: '#fff' },
  refreshBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  refreshIcon: { fontSize: 22, color: '#fff' },
  offlineBanner: {
    backgroundColor: '#e65100',
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  offlineBannerText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  content: { flex: 1 },
  splitRow: { flex: 1, flexDirection: 'row' },
  splitLeft: { flex: 1, borderRightWidth: 1, borderRightColor: '#e0d8c8' },
  splitRight: { flex: 1 },
  emptyPanel: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0ece1' },
  emptyPanelText: { color: '#999', fontSize: 15 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0d8c8',
    paddingBottom: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
    minHeight: 56,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 3,
    backgroundColor: '#5a7a3a',
    borderRadius: 2,
  },
  tabIcon: { fontSize: 22 },
  tabLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  tabLabelActive: { color: '#5a7a3a', fontWeight: '600' },
});
