import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { StorageService } from '../services/storage';
import { ApiService } from '../services/api';
import { LocationService } from '../services/location';
import { OfficeConfig, UserProfile } from '../types';

interface SettingsScreenProps {
  onLogout?: () => void;
  isAdmin?: boolean;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onLogout, isAdmin = false }) => {
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    employeeId: '',
    role: '',
    department: '',
    avatarUri: undefined,
  });

  const [office, setOffice] = useState<OfficeConfig>({
    name: '',
    latitude: 0,
    longitude: 0,
    radiusMeters: 100,
    workStartHour: 8,
    workStartMinute: 30,
    workEndHour: 17,
    workEndMinute: 0,
  });

  const [isLoadingLoc, setIsLoadingLoc] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUserAdmin, setIsUserAdmin] = useState<boolean>(isAdmin);

  // String state untuk input agar user leluasa mengedit tanpa snapping / reset otomatis
  const [latStr, setLatStr] = useState('');
  const [lngStr, setLngStr] = useState('');
  const [radiusStr, setRadiusStr] = useState('100');
  const [startHourStr, setStartHourStr] = useState('08');
  const [startMinStr, setStartMinStr] = useState('30');
  const [endHourStr, setEndHourStr] = useState('17');
  const [endMinStr, setEndMinStr] = useState('00');

  useEffect(() => {
    loadSettings();
  }, [isAdmin]);

  const loadSettings = async () => {
    const prof = await StorageService.getUserProfile();
    const checkAdmin = isAdmin || prof.userRole === 'admin' || prof.employeeId?.startsWith('ADMIN');
    setIsUserAdmin(checkAdmin);

    // Prioritaskan ambil dari server backend
    const srvOffice = await ApiService.getOfficeConfig();
    const off = srvOffice || (await StorageService.getOfficeConfig());
    setProfile(prof);
    setOffice(off);

    // Inisialisasi string input
    setLatStr(String(off.latitude ?? 0));
    setLngStr(String(off.longitude ?? 0));
    setRadiusStr(String(off.radiusMeters ?? 100));
    setStartHourStr(String(off.workStartHour ?? 8).padStart(2, '0'));
    setStartMinStr(String(off.workStartMinute ?? 30).padStart(2, '0'));
    setEndHourStr(String(off.workEndHour ?? 17).padStart(2, '0'));
    setEndMinStr(String(off.workEndMinute ?? 0).padStart(2, '0'));

    if (srvOffice) {
      await StorageService.saveOfficeConfig(srvOffice);
    }
  };

  /**
   * Mengambil foto dari galeri dengan fitur pemotong (Crop 1:1 persegi)
   */
  const pickAvatarFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true, // Mengaktifkan antarmuka crop
        aspect: [1, 1],      // Memaksa aspek rasio 1:1 (persegi)
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const croppedUri = result.assets[0].uri;
        setProfile(prev => ({ ...prev, avatarUri: croppedUri }));
        Alert.alert('Foto Terpotong (Crop)', 'Foto profil berhasil dipilih dan dipotong 1:1. Tekan "Simpan Profil" untuk menyimpan perubahan.');
      }
    } catch (e) {
      Alert.alert('Gagal Membuka Galeri', (e as Error).message);
    }
  };

  /**
   * Mengambil foto langsung dari kamera dengan fitur pemotong (Crop 1:1 persegi)
   */
  const takeAvatarFromCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin Kamera Ditolak', 'Aplikasi memerlukan izin kamera untuk mengambil foto profil.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true, // Mengaktifkan antarmuka crop
        aspect: [1, 1],      // Memaksa aspek rasio 1:1 (persegi)
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const croppedUri = result.assets[0].uri;
        setProfile(prev => ({ ...prev, avatarUri: croppedUri }));
        Alert.alert('Foto Terpotong (Crop)', 'Foto profil berhasil diambil dan dipotong 1:1. Tekan "Simpan Profil" untuk menyimpan perubahan.');
      }
    } catch (e) {
      Alert.alert('Gagal Mengambil Foto', (e as Error).message);
    }
  };

  /**
   * Menu pilihan aksi foto profil (Kamera, Galeri, atau Hapus Foto)
   */
  const handleAvatarAction = () => {
    const options: { text: string; style?: 'cancel' | 'destructive' | 'default'; onPress?: () => void }[] = [
      { text: '📷 Ambil dari Kamera (Crop 1:1)', onPress: takeAvatarFromCamera },
      { text: '🖼️ Pilih dari Galeri (Crop 1:1)', onPress: pickAvatarFromGallery },
    ];

    if (profile.avatarUri) {
      options.push({
        text: '🗑️ Hapus Foto Profil',
        style: 'destructive',
        onPress: () => {
          setProfile(prev => ({ ...prev, avatarUri: undefined }));
        },
      });
    }

    options.push({ text: 'Batal', style: 'cancel' });

    Alert.alert(
      'Ubah Foto Profil',
      'Pilih metode pengambilan foto dengan alat pemotong (crop) persegi 1:1:',
      options
    );
  };

  const setOfficeToCurrentLocation = async () => {
    if (!isUserAdmin) return;
    try {
      setIsLoadingLoc(true);
      const loc = await LocationService.getCurrentLocation();
      if (loc) {
        setOffice(prev => ({
          ...prev,
          latitude: loc.latitude,
          longitude: loc.longitude,
          name: loc.address ? `Kantor (${loc.address.split(',')[0]})` : prev.name,
        }));
        setLatStr(String(loc.latitude));
        setLngStr(String(loc.longitude));
        Alert.alert(
          'Lokasi Terdeteksi',
          `Titik kantor berhasil disesuaikan dengan posisi GPS Anda saat ini:\nLat: ${loc.latitude.toFixed(6)}\nLng: ${loc.longitude.toFixed(6)}`
        );
      }
    } catch (e) {
      Alert.alert('Gagal Mendapatkan Lokasi', (e as Error).message);
    } finally {
      setIsLoadingLoc(false);
    }
  };

  /**
   * Mengatur nilai jam/menit dengan tombol stepper (+ / -)
   */
  const adjustValue = (
    valStr: string,
    setter: (val: string) => void,
    delta: number,
    min: number,
    max: number
  ) => {
    const current = parseInt(valStr, 10);
    const base = isNaN(current) ? min : current;
    let next = base + delta;
    if (next > max) next = min;
    if (next < min) next = max;
    setter(String(next).padStart(2, '0'));
  };

  /**
   * Terapkan preset jam kerja cepat
   */
  const applyPresetHours = (startH: number, startM: number, endH: number, endM: number) => {
    setStartHourStr(String(startH).padStart(2, '0'));
    setStartMinStr(String(startM).padStart(2, '0'));
    setEndHourStr(String(endH).padStart(2, '0'));
    setEndMinStr(String(endM).padStart(2, '0'));
  };

  /**
   * Hitung durasi jam kerja secara dinamis
   */
  const calcShiftDuration = () => {
    const sh = parseInt(startHourStr, 10) || 0;
    const sm = parseInt(startMinStr, 10) || 0;
    const eh = parseInt(endHourStr, 10) || 0;
    const em = parseInt(endMinStr, 10) || 0;
    let totalMin = (eh * 60 + em) - (sh * 60 + sm);
    if (totalMin < 0) totalMin += 24 * 60;
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    if (hours === 0 && mins === 0) return '0 Jam';
    return `${hours} Jam${mins > 0 ? ` ${mins} Mnt` : ''}`;
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await StorageService.saveUserProfile(profile);

      if (isUserAdmin) {
        // Parsing angka aman dan akurat
        const parsedStartH = Math.min(23, Math.max(0, parseInt(startHourStr, 10) || 0));
        const parsedStartM = Math.min(59, Math.max(0, parseInt(startMinStr, 10) || 0));
        const parsedEndH = Math.min(23, Math.max(0, parseInt(endHourStr, 10) || 0));
        const parsedEndM = Math.min(59, Math.max(0, parseInt(endMinStr, 10) || 0));
        const parsedRadius = Math.max(10, parseInt(radiusStr, 10) || 100);
        const parsedLat = parseFloat(latStr.replace(',', '.')) || office.latitude || 0;
        const parsedLng = parseFloat(lngStr.replace(',', '.')) || office.longitude || 0;

        const updatedOffice: OfficeConfig = {
          ...office,
          latitude: parsedLat,
          longitude: parsedLng,
          radiusMeters: parsedRadius,
          workStartHour: parsedStartH,
          workStartMinute: parsedStartM,
          workEndHour: parsedEndH,
          workEndMinute: parsedEndM,
        };

        setOffice(updatedOffice);
        setStartHourStr(String(parsedStartH).padStart(2, '0'));
        setStartMinStr(String(parsedStartM).padStart(2, '0'));
        setEndHourStr(String(parsedEndH).padStart(2, '0'));
        setEndMinStr(String(parsedEndM).padStart(2, '0'));
        setRadiusStr(String(parsedRadius));
        setLatStr(String(parsedLat));
        setLngStr(String(parsedLng));

        await StorageService.saveOfficeConfig(updatedOffice);
        // Simpan konfigurasi kantor langsung ke server backend
        const serverSaved = await ApiService.saveOfficeConfig(updatedOffice);
        const serverMsg = serverSaved
          ? '✅ Data berhasil disinkronisasikan ke cloud server pusat.'
          : '⚠️ Tersimpan secara lokal pada perangkat (server tidak merespons).';

        Alert.alert(
          'Konfigurasi Berhasil Diperbarui',
          `Kebijakan jam kerja operasional (${String(parsedStartH).padStart(2, '0')}:${String(parsedStartM).padStart(2, '0')} - ${String(parsedEndH).padStart(2, '0')}:${String(parsedEndM).padStart(2, '0')} WIB) dan parameter lokasi kantor telah berhasil disimpan.\n\n${serverMsg}`
        );
      } else {
        Alert.alert('Sukses', 'Profil dan informasi identitas berhasil diperbarui!');
      }
    } catch (e) {
      Alert.alert('Kesalahan', 'Gagal memperbarui konfigurasi: ' + (e as Error).message);
    } finally {
      setIsSaving(false);
    }
  };


  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Profil Pengguna & Foto Profil */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons
            name={isUserAdmin ? 'shield-checkmark' : 'person-circle-outline'}
            size={20}
            color={isUserAdmin ? '#7c3aed' : '#0284c7'}
          />
          <Text style={styles.cardTitle}>
            {isUserAdmin ? 'Profil Administrator / HRD' : 'Profil Karyawan'}
          </Text>
        </View>

        {/* Bagian Foto Profil dengan Dukungan Crop 1:1 */}
        <View style={styles.avatarContainer}>
          <TouchableOpacity
            style={styles.avatarTouchable}
            onPress={handleAvatarAction}
            activeOpacity={0.8}
          >
            {profile.avatarUri ? (
              <Image source={{ uri: profile.avatarUri }} style={styles.avatarImg} />
            ) : (
              <View
                style={[
                  styles.avatarPlaceholder,
                  isUserAdmin ? styles.avatarPlaceholderAdmin : styles.avatarPlaceholderEmployee,
                ]}
              >
                <Text
                  style={[
                    styles.avatarInitialsText,
                    isUserAdmin ? { color: '#7c3aed' } : { color: '#0284c7' },
                  ]}
                >
                  {getInitials(profile.name)}
                </Text>
              </View>
            )}

            <View
              style={[
                styles.cameraBadge,
                isUserAdmin && { backgroundColor: '#7c3aed' },
              ]}
            >
              <Ionicons name="camera" size={14} color="#ffffff" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.avatarActionBtn,
              isUserAdmin && styles.avatarActionBtnAdmin,
            ]}
            onPress={handleAvatarAction}
          >
            <Ionicons
              name="crop-outline"
              size={15}
              color={isUserAdmin ? '#7c3aed' : '#0284c7'}
            />
            <Text
              style={[
                styles.avatarActionBtnText,
                isUserAdmin && { color: '#7c3aed' },
              ]}
            >
              {profile.avatarUri ? 'Ganti / Crop Foto Profil' : 'Atur Foto Profil (Crop 1:1)'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>
            Foto akan dipotong rapi dengan rasio kotak 1:1 untuk identitas presensi
          </Text>
        </View>

        <Text style={styles.label}>Nama Lengkap</Text>
        <TextInput
          style={styles.input}
          value={profile.name}
          onChangeText={text => setProfile({ ...profile, name: text })}
          placeholder="Nama Anda"
          placeholderTextColor="#94a3b8"
        />

        <Text style={styles.label}>NIP / ID Karyawan</Text>
        <TextInput
          style={[styles.input, styles.inputDisabled]}
          value={profile.employeeId}
          editable={false}
          placeholder="ID Karyawan"
          placeholderTextColor="#94a3b8"
        />

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.label}>Jabatan</Text>
            <TextInput
              style={styles.input}
              value={profile.role}
              onChangeText={text => setProfile({ ...profile, role: text })}
              placeholder="Jabatan"
              placeholderTextColor="#94a3b8"
            />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Departemen</Text>
            <TextInput
              style={styles.input}
              value={profile.department}
              onChangeText={text => setProfile({ ...profile, department: text })}
              placeholder="Departemen"
              placeholderTextColor="#94a3b8"
            />
          </View>
        </View>
      </View>

      {/* JIKA KARYAWAN: Tampilkan Kartu Informasi Lokasi Kantor Resmi (Hanya Baca / Read-Only) */}
      {!isUserAdmin ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="business" size={20} color="#0284c7" />
            <Text style={styles.cardTitle}>Kebijakan Lokasi & Jam Kerja Perusahaan</Text>
          </View>

          <View style={styles.infoRow}>
            <View style={[styles.infoIconBox, { backgroundColor: '#f0f9ff' }]}>
              <Ionicons name="location" size={18} color="#0284c7" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Titik Lokasi Kantor Resmi</Text>
              <Text style={styles.infoValue}>{office.name || 'Kantor Pusat'}</Text>
              <Text style={styles.infoSub}>
                Koordinat: {office.latitude.toFixed(5)}, {office.longitude.toFixed(5)}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={[styles.infoIconBox, { backgroundColor: '#f0fdf4' }]}>
              <Ionicons name="radio" size={18} color="#16a34a" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Radius Toleransi Presensi</Text>
              <Text style={styles.infoValue}>{office.radiusMeters} Meter dari Titik Pusat</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={[styles.infoIconBox, { backgroundColor: '#fffbeb' }]}>
              <Ionicons name="time" size={18} color="#d97706" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Jam Kerja Operasional Perusahaan</Text>
              <Text style={styles.infoValue}>
                {String(office.workStartHour).padStart(2, '0')}:
                {String(office.workStartMinute).padStart(2, '0')} WIB s/d{' '}
                {String(office.workEndHour).padStart(2, '0')}:
                {String(office.workEndMinute).padStart(2, '0')} WIB
              </Text>
            </View>
          </View>

          <View style={styles.lockedNoticeBox}>
            <Ionicons name="lock-closed" size={15} color="#475569" />
            <Text style={styles.lockedNoticeText}>
              Parameter lokasi dan jam kerja operasional ditetapkan secara terpusat oleh Manajemen / HRD guna menjamin keabsahan data presensi. Perubahan konfigurasi hanya dapat dilakukan oleh Administrator.
            </Text>
          </View>
        </View>
      ) : (
        /* JIKA ADMIN: Tampilkan Form Pengaturan Lokasi Kantor & Jam Kerja */
        <>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="business" size={20} color="#7c3aed" />
              <Text style={[styles.cardTitle, { color: '#7c3aed' }]}>Konfigurasi Titik Lokasi Kantor</Text>
            </View>

            <Text style={styles.label}>Nama Gedung / Kantor Cabang</Text>
            <TextInput
              style={styles.input}
              value={office.name}
              onChangeText={text => setOffice({ ...office, name: text })}
              placeholder="Contoh: Gedung Kantor Pusat"
              placeholderTextColor="#94a3b8"
            />

            {/* Tombol quick sync kantor dengan posisi sekarang */}
            <TouchableOpacity
              style={[styles.quickLocBtn, { borderColor: '#ddd6fe', backgroundColor: '#f5f3ff' }]}
              onPress={setOfficeToCurrentLocation}
              disabled={isLoadingLoc}
            >
              {isLoadingLoc ? (
                <ActivityIndicator size="small" color="#7c3aed" />
              ) : (
                <>
                  <Ionicons name="navigate-circle-outline" size={18} color="#7c3aed" />
                  <Text style={[styles.quickLocBtnText, { color: '#7c3aed' }]}>
                    Tetapkan Titik Kantor Berdasarkan Koordinat GPS Saat Ini
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.twoCol}>
              <View style={styles.col}>
                <Text style={styles.label}>Latitude Kantor</Text>
                <TextInput
                  style={styles.input}
                  value={latStr}
                  onChangeText={setLatStr}
                  keyboardType="numeric"
                  placeholder="-6.2088"
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Longitude Kantor</Text>
                <TextInput
                  style={styles.input}
                  value={lngStr}
                  onChangeText={setLngStr}
                  keyboardType="numeric"
                  placeholder="106.8456"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            <Text style={styles.label}>Radius Toleransi Kehadiran (Meter)</Text>
            <TextInput
              style={styles.input}
              value={radiusStr}
              onChangeText={setRadiusStr}
              keyboardType="numeric"
              placeholder="100"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="time" size={20} color="#7c3aed" />
              <Text style={[styles.cardTitle, { color: '#7c3aed' }]}>Kebijakan Jam Kerja Operasional</Text>
            </View>

            {/* Live Shift Preview Banner */}
            <View style={styles.shiftPreviewCard}>
              <View style={styles.shiftPreviewIcon}>
                <Ionicons name="time" size={22} color="#7c3aed" />
              </View>
              <View style={{ flex: 1, paddingRight: 4 }}>
                <Text style={styles.shiftPreviewLabel}>Jadwal Kerja Aktif:</Text>
                <Text style={styles.shiftPreviewTime}>
                  {startHourStr.padStart(2, '0')}:{startMinStr.padStart(2, '0')} - {endHourStr.padStart(2, '0')}:{endMinStr.padStart(2, '0')} WIB
                </Text>
              </View>
              <View style={styles.durationBadge}>
                <Text style={styles.durationBadgeText}>{calcShiftDuration()}</Text>
              </View>
            </View>

            {/* Preset Buttons Grid (2x2 Symmetric Rows) */}
            <Text style={styles.subHeaderLabel}>Template Jadwal Standar Perusahaan:</Text>
            <View style={styles.presetRow}>
              <TouchableOpacity
                style={[
                  styles.presetCol,
                  startHourStr === '08' && startMinStr === '00' && endHourStr === '17' && endMinStr === '00' && styles.presetGridItemActive,
                ]}
                onPress={() => applyPresetHours(8, 0, 17, 0)}
              >
                <View style={styles.presetItemHeader}>
                  <Text
                    style={[
                      styles.presetItemTitle,
                      startHourStr === '08' && startMinStr === '00' && endHourStr === '17' && endMinStr === '00' && styles.presetItemTitleActive,
                    ]}
                  >
                    08:00 - 17:00
                  </Text>
                  {startHourStr === '08' && startMinStr === '00' && endHourStr === '17' && endMinStr === '00' && (
                    <Ionicons name="checkmark-circle" size={15} color="#ffffff" />
                  )}
                </View>
                <Text
                  style={[
                    styles.presetItemSub,
                    startHourStr === '08' && startMinStr === '00' && endHourStr === '17' && endMinStr === '00' && styles.presetItemSubActive,
                  ]}
                >
                  Reguler Kantor (9 Jam)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.presetCol,
                  startHourStr === '08' && startMinStr === '30' && endHourStr === '17' && endMinStr === '00' && styles.presetGridItemActive,
                ]}
                onPress={() => applyPresetHours(8, 30, 17, 0)}
              >
                <View style={styles.presetItemHeader}>
                  <Text
                    style={[
                      styles.presetItemTitle,
                      startHourStr === '08' && startMinStr === '30' && endHourStr === '17' && endMinStr === '00' && styles.presetItemTitleActive,
                    ]}
                  >
                    08:30 - 17:00
                  </Text>
                  {startHourStr === '08' && startMinStr === '30' && endHourStr === '17' && endMinStr === '00' && (
                    <Ionicons name="checkmark-circle" size={15} color="#ffffff" />
                  )}
                </View>
                <Text
                  style={[
                    styles.presetItemSub,
                    startHourStr === '08' && startMinStr === '30' && endHourStr === '17' && endMinStr === '00' && styles.presetItemSubActive,
                  ]}
                >
                  Fleksibel Operasional
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.presetRow, { marginTop: 8 }]}>
              <TouchableOpacity
                style={[
                  styles.presetCol,
                  startHourStr === '07' && startMinStr === '30' && endHourStr === '16' && endMinStr === '30' && styles.presetGridItemActive,
                ]}
                onPress={() => applyPresetHours(7, 30, 16, 30)}
              >
                <View style={styles.presetItemHeader}>
                  <Text
                    style={[
                      styles.presetItemTitle,
                      startHourStr === '07' && startMinStr === '30' && endHourStr === '16' && endMinStr === '30' && styles.presetItemTitleActive,
                    ]}
                  >
                    07:30 - 16:30
                  </Text>
                  {startHourStr === '07' && startMinStr === '30' && endHourStr === '16' && endMinStr === '30' && (
                    <Ionicons name="checkmark-circle" size={15} color="#ffffff" />
                  )}
                </View>
                <Text
                  style={[
                    styles.presetItemSub,
                    startHourStr === '07' && startMinStr === '30' && endHourStr === '16' && endMinStr === '30' && styles.presetItemSubActive,
                  ]}
                >
                  Shift Pagi Operasional
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.presetCol,
                  startHourStr === '09' && startMinStr === '00' && endHourStr === '18' && endMinStr === '00' && styles.presetGridItemActive,
                ]}
                onPress={() => applyPresetHours(9, 0, 18, 0)}
              >
                <View style={styles.presetItemHeader}>
                  <Text
                    style={[
                      styles.presetItemTitle,
                      startHourStr === '09' && startMinStr === '00' && endHourStr === '18' && endMinStr === '00' && styles.presetItemTitleActive,
                    ]}
                  >
                    09:00 - 18:00
                  </Text>
                  {startHourStr === '09' && startMinStr === '00' && endHourStr === '18' && endMinStr === '00' && (
                    <Ionicons name="checkmark-circle" size={15} color="#ffffff" />
                  )}
                </View>
                <Text
                  style={[
                    styles.presetItemSub,
                    startHourStr === '09' && startMinStr === '00' && endHourStr === '18' && endMinStr === '00' && styles.presetItemSubActive,
                  ]}
                >
                  Shift Siang Operasional
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.subHeaderLabel, { marginTop: 16, marginBottom: 10 }]}>
              Konfigurasi Batas Waktu Presensi:
            </Text>

            {/* Box 1: Jam Masuk Kantor */}
            <View style={styles.timeSectionBox}>
              <View style={styles.timeSectionHeader}>
                <View style={[styles.timeTypeIcon, { backgroundColor: '#f0fdf4' }]}>
                  <Ionicons name="log-in" size={18} color="#16a34a" />
                </View>
                <Text style={styles.timeSectionTitle}>Batas Waktu Presensi Masuk</Text>
                <View style={{ flex: 1 }} />
                <View style={[styles.badgePill, { backgroundColor: '#dcfce7' }]}>
                  <Text style={[styles.badgePillText, { color: '#15803d' }]}>Presensi Masuk</Text>
                </View>
              </View>
              <Text style={styles.timeSectionSub}>
                Presensi yang tercatat melewati waktu ini akan otomatis diklasifikasikan 'Terlambat'.
              </Text>

              <View style={styles.timePickerContainer}>
                {/* Jam Unit */}
                <View style={styles.timePickerCol}>
                  <Text style={styles.timePickerLabel}>JAM (00-23)</Text>
                  <View style={styles.stepperContainer}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => adjustValue(startHourStr, setStartHourStr, -1, 0, 23)}
                    >
                      <Ionicons name="remove" size={18} color="#7c3aed" />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.stepperInput}
                      value={startHourStr}
                      onChangeText={setStartHourStr}
                      onBlur={() => {
                        const v = Math.min(23, Math.max(0, parseInt(startHourStr, 10) || 0));
                        setStartHourStr(String(v).padStart(2, '0'));
                      }}
                      keyboardType="number-pad"
                      maxLength={2}
                      placeholder="08"
                      placeholderTextColor="#94a3b8"
                    />
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => adjustValue(startHourStr, setStartHourStr, 1, 0, 23)}
                    >
                      <Ionicons name="add" size={18} color="#7c3aed" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Colon */}
                <View style={styles.colonWrapper}>
                  <Text style={styles.timeColon}>:</Text>
                </View>

                {/* Menit Unit */}
                <View style={styles.timePickerCol}>
                  <Text style={styles.timePickerLabel}>MENIT (00-59)</Text>
                  <View style={styles.stepperContainer}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => adjustValue(startMinStr, setStartMinStr, -5, 0, 59)}
                    >
                      <Ionicons name="remove" size={18} color="#7c3aed" />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.stepperInput}
                      value={startMinStr}
                      onChangeText={setStartMinStr}
                      onBlur={() => {
                        const v = Math.min(59, Math.max(0, parseInt(startMinStr, 10) || 0));
                        setStartMinStr(String(v).padStart(2, '0'));
                      }}
                      keyboardType="number-pad"
                      maxLength={2}
                      placeholder="00"
                      placeholderTextColor="#94a3b8"
                    />
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => adjustValue(startMinStr, setStartMinStr, 5, 0, 59)}
                    >
                      <Ionicons name="add" size={18} color="#7c3aed" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Timezone */}
                <View style={styles.tzBadge}>
                  <Text style={styles.tzBadgeText}>WIB</Text>
                </View>
              </View>
            </View>

            {/* Box 2: Jam Minimal Pulang */}
            <View style={[styles.timeSectionBox, { marginTop: 14 }]}>
              <View style={styles.timeSectionHeader}>
                <View style={[styles.timeTypeIcon, { backgroundColor: '#fff7ed' }]}>
                  <Ionicons name="log-out" size={18} color="#ea580c" />
                </View>
                <Text style={styles.timeSectionTitle}>Batas Awal Presensi Kepulangan</Text>
                <View style={{ flex: 1 }} />
                <View style={[styles.badgePill, { backgroundColor: '#ffedd5' }]}>
                  <Text style={[styles.badgePillText, { color: '#c2410c' }]}>Presensi Pulang</Text>
                </View>
              </View>
              <Text style={styles.timeSectionSub}>
                Waktu paling awal bagi karyawan untuk dapat melakukan presensi kepulangan secara valid.
              </Text>

              <View style={styles.timePickerContainer}>
                {/* Jam Unit */}
                <View style={styles.timePickerCol}>
                  <Text style={styles.timePickerLabel}>JAM (00-23)</Text>
                  <View style={styles.stepperContainer}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => adjustValue(endHourStr, setEndHourStr, -1, 0, 23)}
                    >
                      <Ionicons name="remove" size={18} color="#7c3aed" />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.stepperInput}
                      value={endHourStr}
                      onChangeText={setEndHourStr}
                      onBlur={() => {
                        const v = Math.min(23, Math.max(0, parseInt(endHourStr, 10) || 0));
                        setEndHourStr(String(v).padStart(2, '0'));
                      }}
                      keyboardType="number-pad"
                      maxLength={2}
                      placeholder="17"
                      placeholderTextColor="#94a3b8"
                    />
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => adjustValue(endHourStr, setEndHourStr, 1, 0, 23)}
                    >
                      <Ionicons name="add" size={18} color="#7c3aed" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Colon */}
                <View style={styles.colonWrapper}>
                  <Text style={styles.timeColon}>:</Text>
                </View>

                {/* Menit Unit */}
                <View style={styles.timePickerCol}>
                  <Text style={styles.timePickerLabel}>MENIT (00-59)</Text>
                  <View style={styles.stepperContainer}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => adjustValue(endMinStr, setEndMinStr, -5, 0, 59)}
                    >
                      <Ionicons name="remove" size={18} color="#7c3aed" />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.stepperInput}
                      value={endMinStr}
                      onChangeText={setEndMinStr}
                      onBlur={() => {
                        const v = Math.min(59, Math.max(0, parseInt(endMinStr, 10) || 0));
                        setEndMinStr(String(v).padStart(2, '0'));
                      }}
                      keyboardType="number-pad"
                      maxLength={2}
                      placeholder="00"
                      placeholderTextColor="#94a3b8"
                    />
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => adjustValue(endMinStr, setEndMinStr, 5, 0, 59)}
                    >
                      <Ionicons name="add" size={18} color="#7c3aed" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Timezone */}
                <View style={styles.tzBadge}>
                  <Text style={styles.tzBadgeText}>WIB</Text>
                </View>
              </View>
            </View>

            {/* Quick Action Button right inside the card */}
            <TouchableOpacity
              style={[styles.quickSaveHoursBtn, isSaving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark-done-circle" size={18} color="#ffffff" />
                  <Text style={styles.quickSaveHoursBtnText}>Terapkan Kebijakan Jam Kerja</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.infoHintBox}>
              <Ionicons name="shield-checkmark" size={16} color="#7c3aed" />
              <Text style={styles.infoHintText}>
                Kebijakan jam kerja operasional ini tersinkronisasi secara terpusat ke cloud server dan berlaku mengikat untuk seluruh staf perusahaan.
              </Text>
            </View>
          </View>
        </>
      )}

      {/* Tombol Simpan */}
      <TouchableOpacity
        style={[styles.saveBtn, isUserAdmin && { backgroundColor: '#7c3aed' }]}
        onPress={handleSave}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <>
            <Ionicons name="save-outline" size={18} color="#ffffff" />
            <Text style={styles.saveBtnText}>
              {isUserAdmin ? 'Simpan Seluruh Pengaturan Perusahaan' : 'Simpan Foto & Profil'}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Tombol Logout */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={() => {
          Alert.alert(
            'Keluar Akun',
            'Apakah Anda yakin ingin keluar dari aplikasi?',
            [
              { text: 'Batal', style: 'cancel' },
              {
                text: 'Keluar',
                style: 'destructive',
                onPress: async () => {
                  await StorageService.logout();
                  if (onLogout) onLogout();
                },
              },
            ]
          );
        }}
      >
        <Ionicons name="log-out-outline" size={18} color="#dc2626" />
        <Text style={styles.logoutBtnText}>Keluar dari Akun (Logout)</Text>
      </TouchableOpacity>

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
  card: {
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  avatarContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  avatarTouchable: {
    position: 'relative',
    width: 90,
    height: 90,
    borderRadius: 45,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatarImg: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#e2e8f0',
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  avatarPlaceholderEmployee: {
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
  },
  avatarPlaceholderAdmin: {
    backgroundColor: '#f5f3ff',
    borderColor: '#ddd6fe',
  },
  avatarInitialsText: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0284c7',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    elevation: 3,
  },
  avatarActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0f9ff',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginTop: 12,
  },
  avatarActionBtnAdmin: {
    backgroundColor: '#f5f3ff',
    borderColor: '#ddd6fe',
  },
  avatarActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  avatarHint: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 5,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0f172a',
  },
  inputDisabled: {
    backgroundColor: '#f1f5f9',
    color: '#64748b',
    borderColor: '#e2e8f0',
  },
  twoCol: {
    flexDirection: 'row',
    gap: 10,
  },
  col: {
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  infoSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  lockedNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  lockedNoticeText: {
    flex: 1,
    fontSize: 11,
    color: '#64748b',
    lineHeight: 16,
  },
  quickLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f0f9ff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginVertical: 10,
  },
  quickLocBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284c7',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 10,
  },
  logoutBtnText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '700',
  },
  shiftPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f5f3ff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd6fe',
    marginBottom: 14,
  },
  shiftPreviewIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftPreviewLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b21a8',
  },
  shiftPreviewTime: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4c1d95',
    marginTop: 2,
  },
  durationBadge: {
    backgroundColor: '#7c3aed',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  durationBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  subHeaderLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetCol: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  presetGridItemActive: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
    elevation: 2,
  },
  presetItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  presetItemTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e293b',
  },
  presetItemTitleActive: {
    color: '#ffffff',
  },
  presetItemSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  presetItemSubActive: {
    color: '#e9d5ff',
  },
  timeSectionBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  timeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeTypeIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  timeSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  timeSectionSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 10,
  },
  badgePill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  timePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timePickerCol: {
    flex: 1,
  },
  timePickerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 4,
    textAlign: 'center',
  },
  colonWrapper: {
    paddingTop: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeColon: {
    fontSize: 20,
    fontWeight: '800',
    color: '#475569',
  },
  tzBadge: {
    paddingTop: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tzBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: '#ede9fe',
    color: '#6d28d9',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    overflow: 'hidden',
  },
  stepperBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperInput: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    paddingVertical: 6,
  },
  quickSaveHoursBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#7c3aed',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 14,
  },
  quickSaveHoursBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  infoHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fdf4ff',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#f5d0fe',
  },
  infoHintText: {
    flex: 1,
    fontSize: 11,
    color: '#86198f',
    lineHeight: 16,
  },
});
