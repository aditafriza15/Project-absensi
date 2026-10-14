import { AttendanceRecord, LeaveRequest, OfficeConfig, UserProfile } from '../types';

// Encrypted / obfuscated fallback helper so URL is not plain string in binaries
const _0x1a = ['aHR0cHM6Ly9hcGktYWJzZW5zaS5hZHRwbHVzLm15LmlkL2FwaQ=='];
const getEncodedFallback = () => {
  try {
    if (typeof atob === 'function') {
      return atob(_0x1a[0]);
    }
  } catch {}
  return 'https://api-absensi.adtplus.my.id/api';
};

// Priority: 1. Environment Variable (.env) -> 2. Obfuscated Fallback
export const DEFAULT_API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || getEncodedFallback();

export const ApiService = {
  getBaseUrl(): string {
    return DEFAULT_API_BASE_URL.replace(/\/+$/, '');
  },

  /**
   * Cek status koneksi backend server
   */
  async checkHealth(): Promise<{ online: boolean; message?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(`${this.getBaseUrl()}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (response.ok) {
        return { online: true, message: 'Server Online' };
      }
      return { online: false, message: `Server HTTP ${response.status}` };
    } catch (e) {
      return { online: false, message: (e as Error).message };
    }
  },

  /**
   * Autentikasi Login Karyawan / Admin ke Server Backend
   */
  async login(
    employeeId: string,
    password: string
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${this.getBaseUrl()}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          employee_id: employeeId,
          password: password,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const json = await response.json();
        return { success: true, data: json.data };
      }
      return { success: false, message: 'NIP atau kata sandi tidak cocok di server.' };
    } catch (e) {
      return { success: false, message: (e as Error).message || 'Server sedang offline.' };
    }
  },

  /**
   * Kirim data absensi masuk / pulang bersama foto selfie ke backend Laravel
  /**
   * Kirim data absensi masuk / pulang bersama foto selfie ke backend Laravel
   */
  async submitAttendance(
    record: AttendanceRecord,
    photoUri: string | null,
    employeeId?: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const targetEmpId = employeeId || record.employeeId || '';
      const formData = new FormData();
      formData.append('employee_id', targetEmpId);
      formData.append('type', record.type);
      formData.append('date', record.date);
      formData.append('time', record.time);
      formData.append('latitude', String(record.latitude));
      formData.append('longitude', String(record.longitude));
      formData.append('distance_to_office', String(record.distanceToOffice));
      formData.append('is_within_radius', record.isWithinRadius ? '1' : '0');
      formData.append('status', record.status);

      if (record.address) {
        formData.append('address', record.address);
      }
      if (record.notes) {
        formData.append('notes', record.notes);
      }

      if (photoUri) {
        let filename = photoUri.split('/').pop() || 'selfie.jpg';
        if (!/\.(jpg|jpeg|png)$/i.test(filename)) {
          filename = `${filename}.jpg`;
        }
        const isPng = /\.png$/i.test(filename);
        const mimeType = isPng ? 'image/png' : 'image/jpeg';

        formData.append('photo', {
          uri: photoUri,
          name: filename,
          type: mimeType,
        } as any);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s upload timeout

      const response = await fetch(`${this.getBaseUrl()}/attendance`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let json: any = null;
      try {
        json = await response.json();
      } catch {
        // Response bukan JSON
      }

      if (response.ok && json) {
        return { success: true, data: json.data };
      }

      // Jika gagal dan menyertakan foto (misal backend error upload/kolom foto), retry tanpa foto agar absensi tidak gagal
      if (photoUri) {
        try {
          const fallbackData = new FormData();
          fallbackData.append('employee_id', targetEmpId);
          fallbackData.append('type', record.type);
          fallbackData.append('date', record.date);
          fallbackData.append('time', record.time);
          fallbackData.append('latitude', String(record.latitude));
          fallbackData.append('longitude', String(record.longitude));
          fallbackData.append('distance_to_office', String(record.distanceToOffice));
          fallbackData.append('is_within_radius', record.isWithinRadius ? '1' : '0');
          fallbackData.append('status', record.status);
          if (record.address) fallbackData.append('address', record.address);
          if (record.notes) fallbackData.append('notes', record.notes);

          const fallbackRes = await fetch(`${this.getBaseUrl()}/attendance`, {
            method: 'POST',
            headers: { Accept: 'application/json' },
            body: fallbackData,
          });
          const fallbackJson = await fallbackRes.json().catch(() => null);
          if (fallbackRes.ok && fallbackJson) {
            return { success: true, data: fallbackJson.data };
          }
        } catch {
          // Abaikan fallback error
        }
      }

      let errorMsg = json?.message || `Server HTTP ${response.status}`;
      if (json?.errors) {
        const errorList = Object.values(json.errors).flat().join(', ');
        if (errorList) errorMsg = errorList;
      }

      return {
        success: false,
        error: errorMsg,
      };
    } catch (e) {
      return {
        success: false,
        error: (e as Error).message || 'Gagal terhubung ke server',
      };
    }
  },

  /**
   * Mengambil riwayat absensi langsung dari server backend
   */
  async getAttendanceHistory(employeeId?: string): Promise<AttendanceRecord[] | null> {
    try {
      const url = employeeId
        ? `${this.getBaseUrl()}/attendance?employee_id=${employeeId}`
        : `${this.getBaseUrl()}/attendance`;

      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      if (response.ok) {
        const json = await response.json();
        const list = json.data || [];
        return list.map((item: any): AttendanceRecord => ({
          id: String(item.id),
          employeeId: item.employee_id,
          employeeName: item.employee_name || item.name || item.employee?.name || item.user?.name || undefined,
          type: item.type,
          timestamp: item.created_at || new Date().toISOString(),
          date: item.date,
          time: item.time,
          latitude: parseFloat(item.latitude) || 0,
          longitude: parseFloat(item.longitude) || 0,
          address: item.address || undefined,
          distanceToOffice: parseInt(item.distance_to_office, 10) || 0,
          isWithinRadius: Boolean(item.is_within_radius),
          photoUri: item.photo_path || undefined,
          notes: item.notes || undefined,
          status: item.status,
        }));
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Mengambil detail profil karyawan dari server backend
   */
  async getEmployee(employeeId: string): Promise<UserProfile | null> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/employee/${employeeId}`, {
        headers: { Accept: 'application/json' },
      });
      if (response.ok) {
        const json = await response.json();
        const data = json.data;
        if (data) {
          return {
            name: data.name || employeeId,
            employeeId: data.employee_id || employeeId,
            role: data.role || 'Karyawan',
            department: data.department || 'Operasional',
            avatarUri: data.avatar_path || undefined,
          };
        }
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Mengambil pengajuan izin / cuti dari server backend
   */
  async getLeaveRequests(employeeId?: string): Promise<LeaveRequest[] | null> {
    try {
      const url = employeeId
        ? `${this.getBaseUrl()}/leave?employee_id=${employeeId}`
        : `${this.getBaseUrl()}/leave`;

      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      if (response.ok) {
        const json = await response.json();
        const list = json.data || [];
        return list.map((item: any): LeaveRequest => ({
          id: String(item.id),
          employeeId: item.employee_id,
          type: item.type,
          startDate: item.start_date,
          endDate: item.end_date,
          reason: item.reason,
          attachmentUri: item.attachment_path || undefined,
          createdAt: item.created_at || new Date().toISOString(),
          status: item.status,
        }));
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Kirim formulir izin / cuti ke server
   */
  async submitLeaveRequest(
    leave: LeaveRequest,
    attachmentUri: string | null,
    employeeId?: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const targetEmpId = employeeId || leave.employeeId || '';
      const formData = new FormData();
      formData.append('employee_id', targetEmpId);
      formData.append('type', leave.type);
      formData.append('start_date', leave.startDate);
      formData.append('end_date', leave.endDate);
      formData.append('reason', leave.reason);

      if (attachmentUri) {
        const filename = attachmentUri.split('/').pop() || 'surat.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('attachment', {
          uri: attachmentUri,
          name: filename,
          type,
        } as any);
      }

      const response = await fetch(`${this.getBaseUrl()}/leave`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: formData,
      });

      const json = await response.json();
      if (response.ok) {
        return { success: true, data: json.data };
      }
      return { success: false, error: json.message || `Gagal kirim izin (${response.status})` };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },

  /**
   * Admin: Update status izin (Approve / Reject) di server
   */
  async updateLeaveStatus(
    id: string,
    status: 'Disetujui' | 'Ditolak'
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/leave/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  /**
   * Ambil konfigurasi titik kantor dari server
   */
  async getOfficeConfig(): Promise<OfficeConfig | null> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/office`, {
        headers: { Accept: 'application/json' },
      });
      if (response.ok) {
        const json = await response.json();
        const data = json.data;
        if (!data) return null;

        const [startH, startM] = (data.work_start_time || '08:30').split(':').map(Number);
        const [endH, endM] = (data.work_end_time || '17:00').split(':').map(Number);

        const cleanLat = parseFloat(String(data.latitude || '').replace(',', '.'));
        const cleanLng = parseFloat(String(data.longitude || '').replace(',', '.'));
        const cleanRadius = parseInt(String(data.radius_meters || '').replace(',', '.'), 10);

        return {
          name: data.name || 'Kantor Pusat',
          latitude: !isNaN(cleanLat) ? cleanLat : -6.175392,
          longitude: !isNaN(cleanLng) ? cleanLng : 106.827153,
          radiusMeters: !isNaN(cleanRadius) ? cleanRadius : 100,
          workStartHour: isNaN(startH) ? 8 : startH,
          workStartMinute: isNaN(startM) ? 30 : startM,
          workEndHour: isNaN(endH) ? 17 : endH,
          workEndMinute: isNaN(endM) ? 0 : endM,
        };
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Update konfigurasi kantor ke server
   */
  async saveOfficeConfig(config: OfficeConfig): Promise<boolean> {
    try {
      const payload = {
        name: config.name,
        latitude: config.latitude,
        longitude: config.longitude,
        radius_meters: config.radiusMeters,
        work_start_time: `${String(config.workStartHour).padStart(2, '0')}:${String(config.workStartMinute).padStart(2, '0')}`,
        work_end_time: `${String(config.workEndHour).padStart(2, '0')}:${String(config.workEndMinute).padStart(2, '0')}`,
      };

      const response = await fetch(`${this.getBaseUrl()}/office`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  /**
   * Reset Device Binding karyawan di server backend
   */
  async resetDeviceBinding(employeeId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/employee/${employeeId}/reset-device`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  },
};
