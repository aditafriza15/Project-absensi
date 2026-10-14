import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StorageService } from '../services/storage';
import { ApiService } from '../services/api';
import { SecurityService } from '../services/security';
import { AuthUser } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const passwordInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleLogin = async () => {
    const cleanId = employeeId.trim().toUpperCase();
    const cleanPass = password.trim();

    if (!cleanId) {
      Alert.alert('NIP Wajib Diisi', 'Silakan masukkan NIP / ID Karyawan Anda.');
      return;
    }

    if (!cleanPass) {
      Alert.alert('Kata Sandi Wajib Diisi', 'Silakan masukkan kata sandi Anda.');
      return;
    }

    try {
      setIsLoading(true);

      // Autentikasi langsung ke server backend Laravel
      const apiRes = await ApiService.login(cleanId, cleanPass);

      if (!apiRes.success) {
        Alert.alert(
          'Gagal Masuk',
          apiRes.message || 'NIP atau kata sandi tidak valid. Hubungi HRD jika belum terdaftar.'
        );
        setIsLoading(false);
        return;
      }

      const srvData = apiRes.data;
      const isAdmin = cleanId.startsWith('ADMIN');

      const authUser: AuthUser = {
        employeeId: srvData.employee_id || cleanId,
        name: srvData.name || cleanId,
        userRole: isAdmin ? 'admin' : (srvData.user_role || 'karyawan'),
        role: srvData.role || (isAdmin ? 'Administrator' : 'Karyawan'),
        department: srvData.department || (isAdmin ? 'Human Resources' : 'Operasional'),
      };

      // 3. Verifikasi Keamanan Device Binding (1 Akun = 1 HP)
      if (authUser.userRole !== 'admin') {
        const deviceCheck = await SecurityService.validateDeviceBinding(cleanId);
        if (!deviceCheck.valid) {
          Alert.alert(
            'Perangkat Berbeda Terdeteksi',
            `Akun NIP ${cleanId} telah terikat pada perangkat lain.\n\nSistem mengunci 1 akun hanya pada 1 HP untuk mencegah titip absen. Hubungi Admin/HRD untuk mereset kunci HP jika Anda baru berganti ponsel.`
          );
          setIsLoading(false);
          return;
        }
      }

      // 4. Simpan sesi login dan profil aktif
      await StorageService.saveAuthUser(authUser);
      await StorageService.saveUserProfile({
        name: authUser.name,
        employeeId: authUser.employeeId,
        userRole: authUser.userRole,
        role: authUser.role,
        department: authUser.department,
      });

      onLoginSuccess(authUser);
    } catch (e) {
      Alert.alert('Gagal Masuk', (e as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        showsVerticalScrollIndicator={false}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.innerContainer}>
            {/* Brand Header */}
            <View style={styles.header}>
              <View style={styles.logoBox}>
                <Ionicons name="finger-print" size={36} color="#ffffff" />
              </View>
              <Text style={styles.brandTitle}>Presensi Karyawan</Text>
              <Text style={styles.brandSubtitle}>
                Sistem absensi resmi perusahaan dengan verifikasi GPS dan foto selfie
              </Text>
            </View>

            {/* Form Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Masuk ke Akun Anda</Text>

              {/* NIP Input */}
              <Text style={styles.inputLabel}>NIP / ID Karyawan</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="card-outline" size={18} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Masukkan NIP Anda"
                  placeholderTextColor="#94a3b8"
                  value={employeeId}
                  onChangeText={setEmployeeId}
                  autoCapitalize="characters"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>

              {/* Password Input */}
              <Text style={styles.inputLabel}>Kata Sandi</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={18} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  ref={passwordInputRef}
                  style={styles.textInput}
                  placeholder="Masukkan kata sandi..."
                  placeholderTextColor="#94a3b8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  onFocus={() => {
                    setTimeout(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 150);
                  }}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color="#64748b"
                  />
                </TouchableOpacity>
              </View>

              {/* Tombol Masuk */}
              <TouchableOpacity
                style={styles.loginBtn}
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Text style={styles.loginBtnText}>Masuk Sekarang</Text>
                    <Ionicons name="arrow-forward" size={18} color="#ffffff" />
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Footer info */}
            <View style={styles.footer}>
              <Ionicons name="shield-checkmark" size={14} color="#15803d" />
              <Text style={styles.footerText}>
                Hanya akun terdaftar resmi yang dapat mengakses sistem
              </Text>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 80,
  },
  innerContainer: {
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 290,
    lineHeight: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 14,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 5,
    marginTop: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 6,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
  },
  eyeBtn: {
    padding: 6,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284c7',
    height: 50,
    borderRadius: 12,
    marginTop: 18,
    elevation: 2,
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#64748b',
  },
});
