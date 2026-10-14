import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LoginScreen } from './src/screens/LoginScreen';
import { AttendanceScreen } from './src/screens/AttendanceScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { LeaveScreen } from './src/screens/LeaveScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { AdminScreen } from './src/screens/AdminScreen';
import { StorageService } from './src/services/storage';
import { ApiService } from './src/services/api';
import { AuthUser } from './src/types';

type TabKey = 'absensi' | 'riwayat' | 'izin' | 'pengaturan' | 'adminPanel';

interface MainNavigatorProps {
  user: AuthUser;
  onLogout: () => void;
}

function MainNavigator({ user, onLogout }: MainNavigatorProps) {
  const isAdmin = user.userRole === 'admin';
  const [activeTab, setActiveTab] = useState<TabKey>(isAdmin ? 'adminPanel' : 'absensi');
  const [currentUser, setCurrentUser] = useState<AuthUser>(user);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const syncProfileAvatar = async () => {
      const prof = await StorageService.getUserProfile();
      if (prof.avatarUri !== currentUser.avatarUri || prof.name !== currentUser.name) {
        setCurrentUser(prev => ({
          ...prev,
          name: prof.name || prev.name,
          avatarUri: prof.avatarUri,
        }));
      }
    };
    syncProfileAvatar();
  }, [activeTab]);

  useEffect(() => {
    let isMounted = true;
    const testServer = async () => {
      const res = await ApiService.checkHealth();
      if (isMounted) {
        setServerStatus(res.online ? 'online' : 'offline');
      }
    };
    testServer();
    const interval = setInterval(testServer, 15000); // Check every 15s
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleLogoutConfirm = () => {
    Alert.alert(
      'Konfirmasi Keluar',
      'Apakah Anda yakin ingin keluar dari akun?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Keluar',
          style: 'destructive',
          onPress: async () => {
            await StorageService.logout();
            onLogout();
          },
        },
      ]
    );
  };

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'adminPanel':
        return <AdminScreen />;
      case 'absensi':
        return <AttendanceScreen />;
      case 'riwayat':
        return <HistoryScreen />;
      case 'izin':
        return <LeaveScreen />;
      case 'pengaturan':
        return <SettingsScreen onLogout={onLogout} isAdmin={isAdmin} />;
      default:
        return isAdmin ? <AdminScreen /> : <AttendanceScreen />;
    }
  };

  const getScreenTitle = () => {
    switch (activeTab) {
      case 'adminPanel':
        return 'Panel Admin & HRD';
      case 'absensi':
        return 'Presensi Masuk & Pulang';
      case 'riwayat':
        return isAdmin ? 'Semua Log Presensi' : 'Riwayat Kehadiran Saya';
      case 'izin':
        return 'Form Pengajuan Izin';
      case 'pengaturan':
        return isAdmin ? 'Pengaturan Kantor & Radius' : 'Pengaturan & Profil';
      default:
        return 'Absensi Karyawan';
    }
  };

  return (
    <View style={[styles.appWrapper, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Top Header Bar */}
      <View style={styles.topAppBar}>
        <View style={styles.topAppBarLeft}>
          <View style={[styles.appLogoBox, isAdmin && styles.logoBoxAdmin]}>
            {currentUser.avatarUri ? (
              <Image source={{ uri: currentUser.avatarUri }} style={styles.headerAvatarImg} />
            ) : (
              <Ionicons
                name={isAdmin ? 'shield-checkmark' : 'finger-print'}
                size={20}
                color="#ffffff"
              />
            )}
          </View>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.appTitle} numberOfLines={1}>
              {getScreenTitle()}
            </Text>
            <View style={styles.userMetaRow}>
              <Text style={styles.appSubtitle} numberOfLines={1}>
                {currentUser.name}
              </Text>
              <View
                style={[
                  styles.rolePill,
                  isAdmin ? styles.rolePillAdmin : styles.rolePillEmployee,
                ]}
              >
                <Text
                  style={[
                    styles.rolePillText,
                    isAdmin ? { color: '#6d28d9' } : { color: '#0369a1' },
                  ]}
                >
                  {isAdmin ? 'ADMIN' : user.employeeId}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.topAppBarRight}>
          <View
            style={[
              styles.serverStatusBadge,
              serverStatus === 'online'
                ? styles.badgeServerOnline
                : serverStatus === 'offline'
                ? styles.badgeServerOffline
                : styles.badgeServerChecking,
            ]}
          >
            <View
              style={[
                styles.serverStatusDot,
                {
                  backgroundColor:
                    serverStatus === 'online'
                      ? '#16a34a'
                      : serverStatus === 'offline'
                      ? '#d97706'
                      : '#94a3b8',
                },
              ]}
            />
            <Text
              style={[
                styles.serverStatusText,
                {
                  color:
                    serverStatus === 'online'
                      ? '#15803d'
                      : serverStatus === 'offline'
                      ? '#b45309'
                      : '#64748b',
                },
              ]}
            >
              {serverStatus === 'online' ? 'Cloud' : serverStatus === 'offline' ? 'Offline' : 'Cek...'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.headerLogoutBtn}
            onPress={handleLogoutConfirm}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={17} color="#dc2626" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Screen Body */}
      <View style={styles.screenBody}>{renderActiveScreen()}</View>

      {/* Bottom Navigation Bar */}
      <View style={[styles.bottomTabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {isAdmin ? (
          <>
            {/* Navigasi Khusus Admin */}
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => setActiveTab('adminPanel')}
              activeOpacity={0.7}
            >
              <Ionicons
                name={activeTab === 'adminPanel' ? 'shield-checkmark' : 'shield-checkmark-outline'}
                size={22}
                color={activeTab === 'adminPanel' ? '#7c3aed' : '#94a3b8'}
              />
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === 'adminPanel' && styles.tabLabelActiveAdmin,
                ]}
              >
                Kelola Izin
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => setActiveTab('riwayat')}
              activeOpacity={0.7}
            >
              <Ionicons
                name={activeTab === 'riwayat' ? 'time' : 'time-outline'}
                size={22}
                color={activeTab === 'riwayat' ? '#7c3aed' : '#94a3b8'}
              />
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === 'riwayat' && styles.tabLabelActiveAdmin,
                ]}
              >
                Log Rekap
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => setActiveTab('pengaturan')}
              activeOpacity={0.7}
            >
              <Ionicons
                name={activeTab === 'pengaturan' ? 'business' : 'business-outline'}
                size={22}
                color={activeTab === 'pengaturan' ? '#7c3aed' : '#94a3b8'}
              />
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === 'pengaturan' && styles.tabLabelActiveAdmin,
                ]}
              >
                Lokasi Kantor
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Navigasi Khusus Karyawan */}
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => setActiveTab('absensi')}
              activeOpacity={0.7}
            >
              <Ionicons
                name={activeTab === 'absensi' ? 'finger-print' : 'finger-print-outline'}
                size={22}
                color={activeTab === 'absensi' ? '#0284c7' : '#94a3b8'}
              />
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === 'absensi' && styles.tabLabelActive,
                ]}
              >
                Absensi
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => setActiveTab('riwayat')}
              activeOpacity={0.7}
            >
              <Ionicons
                name={activeTab === 'riwayat' ? 'time' : 'time-outline'}
                size={22}
                color={activeTab === 'riwayat' ? '#0284c7' : '#94a3b8'}
              />
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === 'riwayat' && styles.tabLabelActive,
                ]}
              >
                Riwayat
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => setActiveTab('izin')}
              activeOpacity={0.7}
            >
              <Ionicons
                name={activeTab === 'izin' ? 'document-text' : 'document-text-outline'}
                size={22}
                color={activeTab === 'izin' ? '#0284c7' : '#94a3b8'}
              />
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === 'izin' && styles.tabLabelActive,
                ]}
              >
                Ajukan Izin
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => setActiveTab('pengaturan')}
              activeOpacity={0.7}
            >
              <Ionicons
                name={activeTab === 'pengaturan' ? 'settings' : 'settings-outline'}
                size={22}
                color={activeTab === 'pengaturan' ? '#0284c7' : '#94a3b8'}
              />
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === 'pengaturan' && styles.tabLabelActive,
                ]}
              >
                Profil
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const user = await StorageService.getAuthUser();
        setCurrentUser(user);
      } catch (e) {
        console.error('Error checking auth status:', e);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkLoginStatus();
  }, []);

  if (isCheckingAuth) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0284c7" />
        <Text style={styles.loadingText}>Memuat Presensi...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      {currentUser ? (
        <MainNavigator
          user={currentUser}
          onLogout={() => setCurrentUser(null)}
        />
      ) : (
        <LoginScreen onLoginSuccess={(user) => setCurrentUser(user)} />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  appWrapper: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  topAppBar: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 2,
  },
  topAppBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  headerTitleWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  appLogoBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBoxAdmin: {
    backgroundColor: '#7c3aed',
  },
  headerAvatarImg: {
    width: 38,
    height: 38,
    borderRadius: 10,
  },
  appTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  userMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  appSubtitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    maxWidth: 120,
  },
  rolePill: {
    paddingVertical: 1,
    paddingHorizontal: 5,
    borderRadius: 5,
    borderWidth: 1,
  },
  rolePillEmployee: {
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
  },
  rolePillAdmin: {
    backgroundColor: '#f5f3ff',
    borderColor: '#ddd6fe',
  },
  rolePillText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  topAppBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  serverStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeServerOnline: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  badgeServerOffline: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  badgeServerChecking: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  serverStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  serverStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  headerLogoutBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  screenBody: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  bottomTabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#0284c7',
    fontWeight: '700',
  },
  tabLabelActiveAdmin: {
    color: '#7c3aed',
    fontWeight: '700',
  },
});
