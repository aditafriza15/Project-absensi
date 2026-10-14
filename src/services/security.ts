import { Platform } from 'react-native';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = '@absensi_device_uuid_key';
const BOUND_DEVICE_MAP_KEY = '@absensi_registered_device_bindings';

export const SecurityService = {
  /**
   * Mengambil Device ID unik perangkat ponsel.
   * Menggunakan Android ID untuk Android asli, atau fallback persistent UUID untuk emulator/iOS.
   */
  async getDeviceId(): Promise<string> {
    try {
      if (Platform.OS === 'android') {
        const androidId = Application.getAndroidId();
        if (androidId && androidId !== 'unknown') {
          return `android_${androidId}`;
        }
      }

      // Fallback persistent UUID
      let savedUuid = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (!savedUuid) {
        savedUuid = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        await AsyncStorage.setItem(DEVICE_ID_KEY, savedUuid);
      }
      return savedUuid;
    } catch (e) {
      console.warn('Error reading device ID:', e);
      return `dev_${Platform.OS}_${Date.now()}`;
    }
  },

  /**
   * Memvalidasi apakah akun karyawan terikat dengan perangkat ini (Device Binding).
   */
  async validateDeviceBinding(
    employeeId: string
  ): Promise<{ valid: boolean; currentDeviceId: string; registeredDeviceId?: string }> {
    const currentDeviceId = await this.getDeviceId();
    try {
      const data = await AsyncStorage.getItem(BOUND_DEVICE_MAP_KEY);
      const bindings: Record<string, string> = data ? JSON.parse(data) : {};

      // Jika belum pernah ada perangkat terdaftar untuk akun ini -> daftarkan HP ini
      if (!bindings[employeeId]) {
        bindings[employeeId] = currentDeviceId;
        await AsyncStorage.setItem(BOUND_DEVICE_MAP_KEY, JSON.stringify(bindings));
        return { valid: true, currentDeviceId, registeredDeviceId: currentDeviceId };
      }

      // Jika sudah terdaftar, verifikasi apakah cocok
      const registeredDeviceId = bindings[employeeId];
      const valid = registeredDeviceId === currentDeviceId;

      return {
        valid,
        currentDeviceId,
        registeredDeviceId,
      };
    } catch {
      return { valid: true, currentDeviceId };
    }
  },

  /**
   * Reset pengikatan perangkat oleh Admin (misal karyawan ganti HP)
   */
  async resetDeviceBinding(employeeId: string): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(BOUND_DEVICE_MAP_KEY);
      const bindings: Record<string, string> = data ? JSON.parse(data) : {};
      delete bindings[employeeId];
      await AsyncStorage.setItem(BOUND_DEVICE_MAP_KEY, JSON.stringify(bindings));
    } catch (e) {
      console.error('Error resetting device binding:', e);
    }
  },

  /**
   * Deteksi apakah koordinat GPS berasal dari aplikasi Fake GPS (Mock Location Provider)
   */
  isFakeGps(coords: any): boolean {
    if (!coords) return false;
    // Android Location API mock flags
    if (coords.mocked === true || coords.isFromMockProvider === true) {
      return true;
    }
    return false;
  },
};
