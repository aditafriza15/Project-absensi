export type AttendanceType = 'in' | 'out';

export type AttendanceStatus = 'Tepat Waktu' | 'Terlambat' | 'Pulang Cepat' | 'Selesai';

export interface AttendanceRecord {
  id: string;
  employeeId?: string;
  employeeName?: string;
  type: AttendanceType;
  timestamp: string; // ISO string
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  latitude: number;
  longitude: number;
  address?: string;
  distanceToOffice: number; // in meters
  isWithinRadius: boolean;
  photoUri?: string;
  notes?: string;
  status: AttendanceStatus;
}

export type LeaveType = 'Izin' | 'Sakit' | 'Cuti' | 'Dinas Luar';

export interface LeaveRequest {
  id: string;
  employeeId?: string;
  type: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string;
  attachmentUri?: string;
  createdAt: string;
  status: 'Disetujui' | 'Menunggu' | 'Ditolak';
}

export type UserRole = 'admin' | 'karyawan';

export interface UserProfile {
  name: string;
  employeeId: string;
  userRole?: UserRole;
  role: string; // Jabatan e.g. Software Engineer / HR Manager
  department: string;
  avatarUri?: string;
}

export interface AuthUser {
  employeeId: string;
  name: string;
  userRole: UserRole;
  role: string;
  department: string;
  avatarUri?: string;
  token?: string;
}

export interface OfficeConfig {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number; // e.g. 100 meters
  workStartHour: number; // e.g. 8 for 08:00
  workStartMinute: number;
  workEndHour: number; // e.g. 17 for 17:00
  workEndMinute: number;
}
