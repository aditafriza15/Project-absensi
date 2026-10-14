import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { LocationCard } from '../components/LocationCard';
import { CameraSelfie } from '../components/CameraSelfie';
import { StorageService, DEFAULT_PROFILE, DEFAULT_OFFICE } from '../services/storage';
import { ApiService } from '../services/api';
import { SecurityService } from '../services/security';
import { LocationService, LocationData, calculateDistanceInMeters } from '../services/location';
import { AttendanceRecord, AttendanceStatus, OfficeConfig, UserProfile } from '../types';

export const AttendanceScreen: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [office, setOffice] = useState<OfficeConfig>(DEFAULT_OFFICE);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isWithinRadius, setIsWithinRadius] = useState<boolean>(false);
  const [locationLoading, setLocationLoading] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Today's attendance state
  const [todayIn, setTodayIn] = useState<AttendanceRecord | null>(null);
  const [todayOut, setTodayOut] = useState<AttendanceRecord | null>(null);

  const getTodayDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const loadData = useCallback(async (): Promise<OfficeConfig | null> => {
    try {
      const userProf = await StorageService.getUserProfile();
      setProfile(userProf);

      // 1. Ambil konfigurasi kantor dari server backend
      const srvOffice = await ApiService.getOfficeConfig();
      const officeConf = srvOffice || (await StorageService.getOfficeConfig());
      setOffice(officeConf);
      if (srvOffice) {
        await StorageService.saveOfficeConfig(srvOffice);
      }

      // 2. Ambil catatan absensi hari ini langsung dari server backend
      const todayStr = getTodayDateString();
      const srvRecords = await ApiService.getAttendanceHistory(userProf.employeeId);
      const allRecords = srvRecords || (await StorageService.getAttendanceRecords());
      const todayRecords = allRecords.filter(r => r.date === todayStr);

      const checkIn = todayRecords.find(r => r.type === 'in') || null;
      const checkOut = todayRecords.find(r => r.type === 'out') || null;

      setTodayIn(checkIn);
      setTodayOut(checkOut);

      return officeConf;
    } catch (e) {
      console.error('Error loading initial data from server:', e);
      return null;
    }
  }, []);

  const fetchLocation = useCallback(async (currentOffice?: OfficeConfig) => {
    try {
      setLocationLoading(true);
      setLocationError(null);
      const loc = await LocationService.getCurrentLocation();
      setLocation(loc);

      const targetOffice = currentOffice || office;
      if (loc && targetOffice && typeof targetOffice.latitude === 'number' && typeof targetOffice.longitude === 'number') {
        const dist = calculateDistanceInMeters(
          loc.latitude,
          loc.longitude,
          targetOffice.latitude,
          targetOffice.longitude
        );
        setDistance(dist);
        setIsWithinRadius(dist <= (targetOffice.radiusMeters || 100));
      }
    } catch (e) {
      const msg = (e as Error).message || 'Gagal membaca GPS';
      setLocationError(msg);
    } finally {
      setLocationLoading(false);
    }
  }, [office]);

  useEffect(() => {
    let isMounted = true;
    const initialize = async () => {
      const officeConf = await loadData();
      if (isMounted) {
        await fetchLocation(officeConf || undefined);
      }
    };
    initialize();
    return () => {
      isMounted = false;
    };
  }, [loadData, fetchLocation]);

  const onPullRefresh = async () => {
    setRefreshing(true);
    const officeConf = await loadData();
    await fetchLocation(officeConf || undefined);
    setRefreshing(false);
  };

  const determineStatus = (type: 'in' | 'out'): AttendanceStatus => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    if (type === 'in') {
      const officeTotalMinutes = office.workStartHour * 60 + office.workStartMinute;
      const currentTotalMinutes = hours * 60 + minutes;
      return currentTotalMinutes <= officeTotalMinutes ? 'Tepat Waktu' : 'Terlambat';
    } else {
      const officeEndMinutes = office.workEndHour * 60 + office.workEndMinute;
      const currentTotalMinutes = hours * 60 + minutes;
      return currentTotalMinutes < officeEndMinutes ? 'Pulang Cepat' : 'Selesai';
    }
  };

  const handleAttendance = async (type: 'in' | 'out') => {
    if (!selfieUri) {
      Alert.alert('Foto Selfie Diperlukan', 'Harap ambil foto selfie terlebih dahulu sebelum melakukan absensi.');
      return;
    }

    if (!location) {
      Alert.alert('Lokasi Belum Terdeteksi', 'Pastikan GPS Anda aktif dan tekan tombol Refresh pada kartu lokasi.');
      return;
    }

    // 1. Anti-Fake GPS Verification
    if (location.isMocked) {
      Alert.alert(
        'Presensi Ditolak (Fake GPS Terdeteksi)',
        'Sistem mendeteksi penggunaan aplikasi Fake GPS / Lokasi Palsu pada ponsel Anda. Matikan aplikasi tersebut demi integritas presensi!'
      );
      return;
    }

    // 2. Anti-Titip Absen (Device Binding Check)
    const deviceCheck = await SecurityService.validateDeviceBinding(profile.employeeId);
    if (!deviceCheck.valid) {
      Alert.alert(
        'Presensi Ditolak (Perangkat Berbeda)',
        `Akun ${profile.name} (${profile.employeeId}) terikat pada perangkat HP lain.\n\nDemi mencegah titip absen, akun hanya bisa digunakan pada HP terdaftar. Hubungi HRD jika Anda baru saja berganti ponsel.`
      );
      return;
    }

    const dist = distance ?? 999999;
    const isWithin = dist <= (office?.radiusMeters || 100);

    const proceedAttendance = async () => {
      try {
        setIsSubmitting(true);
        const now = new Date();
        const dateStr = getTodayDateString();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        const status = determineStatus(type);

        const newRecord: AttendanceRecord = {
          id: Date.now().toString(),
          type,
          timestamp: now.toISOString(),
          date: dateStr,
          time: timeStr,
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address,
          distanceToOffice: dist,
          isWithinRadius: isWithin,
          photoUri: selfieUri,
          notes: notes.trim() || undefined,
          status,
          employeeId: profile.employeeId,
        };

        // Kirim langsung ke backend API Laravel (Wajib Server)
        const apiRes = await ApiService.submitAttendance(newRecord, selfieUri, profile.employeeId);

        if (!apiRes.success) {
          Alert.alert(
            'Gagal Mengirim ke Server',
            apiRes.error || 'Server backend tidak dapat memproses presensi. Pastikan koneksi internet aktif.'
          );
          setIsSubmitting(false);
          return;
        }

        // Simpan ke cache lokal
        await StorageService.saveAttendanceRecord(newRecord);

        if (type === 'in') {
          setTodayIn(newRecord);
        } else {
          setTodayOut(newRecord);
        }

        // Reset selfie and notes
        setSelfieUri(null);
        setNotes('');

        Alert.alert(
          'Absensi Berhasil Dicatat!',
          `Anda berhasil Absen ${type === 'in' ? 'Masuk' : 'Pulang'} pada jam ${timeStr} WIB (${status}).\n\n✅ Data absensi dan foto selfie berhasil tercatat di server database perusahaan.`
        );
      } catch (e) {
        Alert.alert('Error', 'Gagal memproses absensi: ' + (e as Error).message);
      } finally {
        setIsSubmitting(false);
      }
    };

    if (!isWithin) {
      Alert.alert(
        'Peringatan Lokasi!',
        `Anda berada ${dist} meter dari kantor (di luar batas radius ${office.radiusMeters} m). Tetap lanjutkan absensi?`,
        [
          { text: 'Batal', style: 'cancel' },
          { text: 'Lanjutkan', onPress: proceedAttendance },
        ]
      );
    } else {
      proceedAttendance();
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} colors={['#0284c7']} />
      }
    >
      {profile && <Header profile={profile} />}

      {/* Status Kehadiran Hari Ini */}
      <View style={styles.statusTodayCard}>
        <View style={styles.statusHeaderRow}>
          <Text style={styles.statusCardTitle}>Status Kehadiran Hari Ini</Text>
          <View style={styles.badgeToday}>
            <Text style={styles.badgeTodayText}>Hari Ini</Text>
          </View>
        </View>

        <View style={styles.statusColumns}>
          <View style={styles.statusBox}>
            <View style={styles.statusBoxIconRow}>
              <Ionicons name="log-in-outline" size={18} color="#0284c7" />
              <Text style={styles.statusBoxLabel}>Jam Masuk</Text>
            </View>
            <Text style={styles.statusBoxTime}>
              {todayIn ? todayIn.time.substring(0, 5) : '-- : --'}
            </Text>
            {todayIn ? (
              <View style={[
                styles.miniTag,
                todayIn.status === 'Tepat Waktu' ? styles.tagSuccess : styles.tagWarning
              ]}>
                <Text style={[
                  styles.miniTagText,
                  { color: todayIn.status === 'Tepat Waktu' ? '#15803d' : '#b45309' }
                ]}>
                  {todayIn.status}
                </Text>
              </View>
            ) : (
              <Text style={styles.statusEmptyText}>Belum Absen</Text>
            )}
          </View>

          <View style={styles.statusDivider} />

          <View style={styles.statusBox}>
            <View style={styles.statusBoxIconRow}>
              <Ionicons name="log-out-outline" size={18} color="#059669" />
              <Text style={styles.statusBoxLabel}>Jam Pulang</Text>
            </View>
            <Text style={styles.statusBoxTime}>
              {todayOut ? todayOut.time.substring(0, 5) : '-- : --'}
            </Text>
            {todayOut ? (
              <View style={[styles.miniTag, styles.tagSuccess]}>
                <Text style={[styles.miniTagText, { color: '#15803d' }]}>
                  {todayOut.status}
                </Text>
              </View>
            ) : (
              <Text style={styles.statusEmptyText}>
                {todayIn ? 'Siap Pulang' : 'Belum Absen'}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Lokasi GPS */}
      {office && (
        <LocationCard
          office={office}
          location={location}
          distance={distance}
          isWithinRadius={isWithinRadius}
          isLoading={locationLoading}
          errorMessage={locationError}
          onRefresh={() => fetchLocation(office)}
        />
      )}

      {/* Selfie */}
      <CameraSelfie photoUri={selfieUri} onPhotoSelected={setSelfieUri} />

      {/* Catatan / Keterangan Opsional */}
      <View style={styles.notesCard}>
        <Text style={styles.notesTitle}>Catatan Kerja (Opsional)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Tuliskan ringkasan tugas atau catatan hari ini..."
          placeholderTextColor="#94a3b8"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={2}
        />
      </View>

      {/* Tombol Aksi Absensi */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[
            styles.actionBtn,
            styles.btnCheckIn,
            todayIn ? styles.btnDisabled : null,
          ]}
          disabled={Boolean(todayIn) || isSubmitting}
          onPress={() => handleAttendance('in')}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="log-in" size={20} color="#ffffff" />
              <Text style={styles.actionBtnText}>
                {todayIn ? 'Sudah Masuk' : 'Absen Masuk'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionBtn,
            styles.btnCheckOut,
            (!todayIn || todayOut) ? styles.btnDisabled : null,
          ]}
          disabled={!todayIn || Boolean(todayOut) || isSubmitting}
          onPress={() => handleAttendance('out')}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="log-out" size={20} color="#ffffff" />
              <Text style={styles.actionBtnText}>
                {todayOut ? 'Sudah Pulang' : 'Absen Pulang'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  statusTodayCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  badgeToday: {
    backgroundColor: '#e0f2fe',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeTodayText: {
    fontSize: 11,
    color: '#0284c7',
    fontWeight: '600',
  },
  statusColumns: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
  },
  statusBox: {
    flex: 1,
    alignItems: 'center',
  },
  statusDivider: {
    width: 1,
    height: 48,
    backgroundColor: '#e2e8f0',
  },
  statusBoxIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  statusBoxLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  statusBoxTime: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  miniTag: {
    marginTop: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  miniTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tagSuccess: {
    backgroundColor: '#dcfce7',
  },
  tagWarning: {
    backgroundColor: '#fef3c7',
  },
  statusEmptyText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  notesCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  notesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  notesInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: '#0f172a',
    textAlignVertical: 'top',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  btnCheckIn: {
    backgroundColor: '#0284c7',
  },
  btnCheckOut: {
    backgroundColor: '#059669',
  },
  btnDisabled: {
    backgroundColor: '#cbd5e1',
    elevation: 0,
    shadowOpacity: 0,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
