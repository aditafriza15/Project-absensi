import AsyncStorage from '@react-native-async-storage/async-storage';
import { AttendanceRecord, AuthUser, LeaveRequest, OfficeConfig, UserProfile } from '../types';

const STORAGE_KEYS = {
  ATTENDANCE: '@absensi_records',
  LEAVE: '@absensi_leave_requests',
  USER_PROFILE: '@absensi_user_profile',
  OFFICE_CONFIG: '@absensi_office_config',
  AUTH_USER: '@absensi_auth_user',
};

export const DEFAULT_PROFILE: UserProfile = {
  name: 'Pengguna',
  employeeId: '',
  userRole: 'karyawan',
  role: 'Karyawan',
  department: 'Operasional',
};

// Default Office config (Monas Jakarta as default coordinate, easily customizable in settings)
export const DEFAULT_OFFICE: OfficeConfig = {
  name: 'Kantor Pusat (Head Office)',
  latitude: -6.175392,
  longitude: 106.827153,
  radiusMeters: 100, // 100 meters
  workStartHour: 8, // 08:30 WIB
  workStartMinute: 30,
  workEndHour: 17, // 17:00 WIB
  workEndMinute: 0,
};

export const StorageService = {
  // Attendance Records
  async getAttendanceRecords(): Promise<AttendanceRecord[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ATTENDANCE);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error reading attendance records:', e);
      return [];
    }
  },

  async saveAttendanceRecord(record: AttendanceRecord): Promise<void> {
    try {
      const records = await this.getAttendanceRecords();
      // Prepend so latest is first
      const updated = [record, ...records];
      await AsyncStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving attendance record:', e);
      throw e;
    }
  },

  async deleteAttendanceRecord(id: string): Promise<void> {
    try {
      const records = await this.getAttendanceRecords();
      const filtered = records.filter(r => r.id !== id);
      await AsyncStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(filtered));
    } catch (e) {
      console.error('Error deleting record:', e);
    }
  },

  async saveAllAttendanceRecords(records: AttendanceRecord[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(records));
    } catch (e) {
      console.error('Error saving all records:', e);
    }
  },

  // Leave Requests
  async getLeaveRequests(): Promise<LeaveRequest[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LEAVE);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error reading leave requests:', e);
      return [];
    }
  },

  async saveLeaveRequest(request: LeaveRequest): Promise<void> {
    try {
      const requests = await this.getLeaveRequests();
      const updated = [request, ...requests];
      await AsyncStorage.setItem(STORAGE_KEYS.LEAVE, JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving leave request:', e);
      throw e;
    }
  },

  async saveAllLeaveRequests(requests: LeaveRequest[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LEAVE, JSON.stringify(requests));
    } catch (e) {
      console.error('Error saving all leave requests:', e);
    }
  },

  async updateLeaveStatus(id: string, status: 'Disetujui' | 'Ditolak'): Promise<void> {
    try {
      const requests = await this.getLeaveRequests();
      const updated = requests.map(item =>
        item.id === id ? { ...item, status } : item
      );
      await AsyncStorage.setItem(STORAGE_KEYS.LEAVE, JSON.stringify(updated));
    } catch (e) {
      console.error('Error updating leave status:', e);
      throw e;
    }
  },

  // User Profile
  async getUserProfile(): Promise<UserProfile> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      if (data) {
        return JSON.parse(data);
      }
      const auth = await this.getAuthUser();
      if (auth) {
        return {
          name: auth.name,
          employeeId: auth.employeeId,
          userRole: auth.userRole,
          role: auth.role,
          department: auth.department,
          avatarUri: auth.avatarUri,
        };
      }
      return DEFAULT_PROFILE;
    } catch (e) {
      console.error('Error reading user profile:', e);
      return DEFAULT_PROFILE;
    }
  },

  async saveUserProfile(profile: UserProfile): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
      const authUser = await this.getAuthUser();
      if (authUser) {
        authUser.name = profile.name;
        authUser.avatarUri = profile.avatarUri;
        await this.saveAuthUser(authUser);
      }
    } catch (e) {
      console.error('Error saving user profile:', e);
      throw e;
    }
  },

  // Office Config
  async getOfficeConfig(): Promise<OfficeConfig> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.OFFICE_CONFIG);
      return data ? JSON.parse(data) : DEFAULT_OFFICE;
    } catch (e) {
      console.error('Error reading office config:', e);
      return DEFAULT_OFFICE;
    }
  },

  async saveOfficeConfig(config: OfficeConfig): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.OFFICE_CONFIG, JSON.stringify(config));
    } catch (e) {
      console.error('Error saving office config:', e);
      throw e;
    }
  },

  // Auth Session
  async getAuthUser(): Promise<AuthUser | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_USER);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Error reading auth user:', e);
      return null;
    }
  },

  async saveAuthUser(user: AuthUser): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(user));
    } catch (e) {
      console.error('Error saving auth user:', e);
      throw e;
    }
  },

  async logout(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    } catch (e) {
      console.error('Error logging out:', e);
    }
  },

  // Hapus semua data sesi lokal saat dibutuhkan
  async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ATTENDANCE,
        STORAGE_KEYS.LEAVE,
        STORAGE_KEYS.OFFICE_CONFIG,
        STORAGE_KEYS.AUTH_USER,
      ]);
    } catch (e) {
      console.error('Error clearing data:', e);
    }
  },
};
