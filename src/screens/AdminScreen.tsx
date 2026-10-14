import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StorageService } from '../services/storage';
import { ApiService } from '../services/api';
import { SecurityService } from '../services/security';
import { AttendanceRecord, LeaveRequest, OfficeConfig, AttendanceStatus } from '../types';

export const AdminScreen: React.FC = () => {
  const [activeSegment, setActiveSegment] = useState<'approvals' | 'allAttendance' | 'manualAttendance'>('approvals');
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [office, setOffice] = useState<OfficeConfig | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [resetNip, setResetNip] = useState('');
  const [isResettingDevice, setIsResettingDevice] = useState(false);
  const [employeeNames, setEmployeeNames] = useState<Record<string, string>>({
    'EMP-202401': 'Budi Santoso',
    'ADMIN-001': 'Siti Rahmawati (HRD)',
  });

  // State Absensi Manual Karyawan (Lupa Bawa HP)
  const [manualNip, setManualNip] = useState('');
  const [manualType, setManualType] = useState<'in' | 'out'>('in');
  const [manualStatus, setManualStatus] = useState<AttendanceStatus>('Tepat Waktu');
  const [manualNotes, setManualNotes] = useState('Lupa bawa HP, diverifikasi langsung oleh Admin');
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  const loadData = useCallback(async () => {
    try {
      // Prioritaskan ambil seluruh data secara live dari server backend
      const [leaves, attends, off] = await Promise.all([
        ApiService.getLeaveRequests(),
        ApiService.getAttendanceHistory(),
        ApiService.getOfficeConfig(),
      ]);

      if (leaves) {
        setLeaveRequests(leaves);
        await StorageService.saveAllLeaveRequests(leaves);
      } else {
        setLeaveRequests(await StorageService.getLeaveRequests());
      }

      if (attends) {
        setAttendanceRecords(attends);
        await StorageService.saveAllAttendanceRecords(attends);

        // Ambil nama lengkap karyawan untuk setiap employeeId yang belum ada di cache
        const uniqueNips = Array.from(
          new Set(attends.map(a => a.employeeId).filter((nip): nip is string => Boolean(nip)))
        );
        for (const nip of uniqueNips) {
          const emp = await ApiService.getEmployee(nip);
          if (emp && emp.name) {
            setEmployeeNames(prev => ({ ...prev, [nip]: emp.name }));
          }
        }
      } else {
        setAttendanceRecords(await StorageService.getAttendanceRecords());
      }

      if (off) {
        setOffice(off);
        await StorageService.saveOfficeConfig(off);
      } else {
        setOffice(await StorageService.getOfficeConfig());
      }
    } catch (e) {
      console.error('Error loading admin data from server:', e);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleUpdateLeaveStatus = async (id: string, status: 'Disetujui' | 'Ditolak') => {
    try {
      const ok = await ApiService.updateLeaveStatus(id, status);
      if (!ok) {
        Alert.alert('Gagal', 'Server backend gagal memproses pembaruan status izin.');
        return;
      }
      await StorageService.updateLeaveStatus(id, status);
      await loadData();
      Alert.alert(
        'Status Berhasil Diperbarui di Server!',
        `Permohonan izin berhasil diubah menjadi: ${status} pada database perusahaan.`
      );
    } catch (e) {
      Alert.alert('Gagal', (e as Error).message);
    }
  };

  const handleResetDevice = async () => {
    const cleanNip = resetNip.trim().toUpperCase();
    if (!cleanNip) {
      Alert.alert('NIP Diperlukan', 'Masukkan NIP karyawan yang ingin di-reset pengikatan HP-nya.');
      return;
    }

    Alert.alert(
      'Reset Kunci Perangkat',
      `Apakah Anda ingin mereset pengikatan HP untuk NIP: ${cleanNip}?\n\nKaryawan dapat menautkan perangkat barunya secara otomatis saat login berikutnya.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Reset Kunci HP',
          onPress: async () => {
            try {
              setIsResettingDevice(true);
              await SecurityService.resetDeviceBinding(cleanNip);
              await ApiService.resetDeviceBinding(cleanNip);
              setResetNip('');
              Alert.alert('Sukses', `Kunci perangkat untuk NIP ${cleanNip} berhasil di-reset.`);
            } catch (err) {
              Alert.alert('Gagal', (err as Error).message);
            } finally {
              setIsResettingDevice(false);
            }
          },
        },
      ]
    );
  };

  const handleManualAttendance = async () => {
    const cleanNip = manualNip.trim().toUpperCase();
    if (!cleanNip) {
      Alert.alert('NIP Diperlukan', 'Masukkan NIP/ID Karyawan yang ingin dicatat absensinya.');
      return;
    }

    try {
      setIsSubmittingManual(true);
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      const dateStr = now.toISOString().split('T')[0];

      // Ambil nama karyawan
      const emp = await ApiService.getEmployee(cleanNip);
      const empName = emp?.name || employeeNames[cleanNip] || (cleanNip === 'EMP-202401' ? 'Budi Santoso' : cleanNip);
      if (emp?.name) {
        setEmployeeNames(prev => ({ ...prev, [cleanNip]: emp.name }));
      }

      const record: AttendanceRecord = {
        id: `manual_${Date.now()}`,
        employeeId: cleanNip,
        employeeName: empName,
        type: manualType,
        timestamp: now.toISOString(),
        date: dateStr,
        time: timeStr,
        latitude: office ? office.latitude : -6.93964,
        longitude: office ? office.longitude : 107.52020,
        address: office?.name || 'Kantor (Jalan Balakasap)',
        distanceToOffice: 0,
        isWithinRadius: true,
        notes: manualNotes.trim() || 'Hadir di lokasi, kendala perangkat fisik terverifikasi Admin',
        status: manualStatus,
      };

      const res = await ApiService.submitAttendance(record, null, cleanNip);
      if (!res.success) {
        Alert.alert('Gagal Menyimpan', res.error || 'Server backend gagal memproses presensi manual.');
        return;
      }

      await StorageService.saveAttendanceRecord(record);
      await loadData();

      Alert.alert(
        'Presensi Manual Berhasil Diotorisasi',
        `Staf dengan NIP ${cleanNip} berhasil dicatat Presensi ${manualType === 'in' ? 'Masuk' : 'Pulang'} pada pukul ${timeStr} WIB (${manualStatus}).\n\n✅ Data presensi telah tersimpan sah pada pangkalan data cloud perusahaan.`
      );

      setManualNip('');
      setManualNotes('Hadir di lokasi, kendala perangkat fisik terverifikasi Admin');
    } catch (e) {
      Alert.alert('Gagal', (e as Error).message);
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const pendingLeaves = leaveRequests.filter(r => r.status === 'Menunggu');
  const totalAttendsToday = attendanceRecords.filter(
    r => r.date === new Date().toISOString().split('T')[0] && r.type === 'in'
  ).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7c3aed']} />
      }
    >
      {/* Admin KPI Header Cards */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { borderLeftColor: '#7c3aed' }]}>
          <Text style={styles.kpiNumber}>{pendingLeaves.length}</Text>
          <Text style={styles.kpiLabel}>Menunggu Verifikasi</Text>
        </View>

        <View style={[styles.kpiCard, { borderLeftColor: '#0284c7' }]}>
          <Text style={styles.kpiNumber}>{totalAttendsToday}</Text>
          <Text style={styles.kpiLabel}>Hadir Hari Ini</Text>
        </View>

        <View style={[styles.kpiCard, { borderLeftColor: '#10b981' }]}>
          <Text style={styles.kpiNumber}>{attendanceRecords.length}</Text>
          <Text style={styles.kpiLabel}>Total Riwayat Presensi</Text>
        </View>
      </View>

      {/* Segmented Controls */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[
            styles.segmentBtn,
            activeSegment === 'approvals' && styles.segmentBtnActive,
          ]}
          onPress={() => setActiveSegment('approvals')}
        >
          <Ionicons
            name="checkbox-outline"
            size={16}
            color={activeSegment === 'approvals' ? '#ffffff' : '#64748b'}
          />
          <Text
            style={[
              styles.segmentText,
              activeSegment === 'approvals' && styles.segmentTextActive,
            ]}
          >
            Izin & Cuti ({leaveRequests.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.segmentBtn,
            activeSegment === 'allAttendance' && styles.segmentBtnActive,
          ]}
          onPress={() => setActiveSegment('allAttendance')}
        >
          <Ionicons
            name="list-outline"
            size={16}
            color={activeSegment === 'allAttendance' ? '#ffffff' : '#64748b'}
          />
          <Text
            style={[
              styles.segmentText,
              activeSegment === 'allAttendance' && styles.segmentTextActive,
            ]}
          >
            Rekap Presensi ({attendanceRecords.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.segmentBtn,
            activeSegment === 'manualAttendance' && styles.segmentBtnActive,
          ]}
          onPress={() => setActiveSegment('manualAttendance')}
        >
          <Ionicons
            name="person-add-outline"
            size={16}
            color={activeSegment === 'manualAttendance' ? '#ffffff' : '#64748b'}
          />
          <Text
            style={[
              styles.segmentText,
              activeSegment === 'manualAttendance' && styles.segmentTextActive,
            ]}
          >
            Presensi Manual
          </Text>
        </TouchableOpacity>
      </View>

      {/* 1. Bagian Persetujuan Izin (Approvals) */}
      {activeSegment === 'approvals' && (
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Persetujuan Izin & Cuti Karyawan</Text>
            <Text style={styles.sectionSubtitle}>
              Tinjau dan verifikasi permohonan izin kerja karyawan
            </Text>
          </View>

          {leaveRequests.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="mail-open-outline" size={44} color="#94a3b8" />
              <Text style={styles.emptyCardTitle}>Tidak Ada Permohonan Izin</Text>
              <Text style={styles.emptyCardSub}>
                Permohonan izin baru dari karyawan akan tampil di sini.
              </Text>
            </View>
          ) : (
            leaveRequests.map(item => (
              <View key={item.id} style={styles.approvalCard}>
                <View style={styles.approvalHeader}>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>{item.type}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      item.status === 'Disetujui'
                        ? styles.pillApproved
                        : item.status === 'Ditolak'
                        ? styles.pillRejected
                        : styles.pillPending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        item.status === 'Disetujui'
                          ? { color: '#15803d' }
                          : item.status === 'Ditolak'
                          ? { color: '#b91c1c' }
                          : { color: '#b45309' },
                      ]}
                    >
                      {item.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.dateRow}>
                  <Ionicons name="calendar-outline" size={13} color="#64748b" />
                  <Text style={styles.dateText}>
                    {item.startDate} s/d {item.endDate}
                  </Text>
                </View>

                <Text style={styles.reasonText}>{item.reason}</Text>

                {item.attachmentUri && (
                  <View style={styles.attachmentRow}>
                    <Image source={{ uri: item.attachmentUri }} style={styles.attachmentImg} />
                    <Text style={styles.attachmentText}>Dokumen Surat Dokter / Bukti Terlampir</Text>
                  </View>
                )}

                {/* Tombol Aksi Admin */}
                <View style={styles.actionBtnRow}>
                  <TouchableOpacity
                    style={[
                      styles.actionApproveBtn,
                      item.status === 'Disetujui' && styles.actionBtnDisabled,
                    ]}
                    disabled={item.status === 'Disetujui'}
                    onPress={() => handleUpdateLeaveStatus(item.id, 'Disetujui')}
                  >
                    <Ionicons name="checkmark-circle" size={16} color="#ffffff" />
                    <Text style={styles.actionApproveText}>Setujui (Approve)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionRejectBtn,
                      item.status === 'Ditolak' && styles.actionBtnDisabled,
                    ]}
                    disabled={item.status === 'Ditolak'}
                    onPress={() => handleUpdateLeaveStatus(item.id, 'Ditolak')}
                  >
                    <Ionicons name="close-circle" size={16} color="#ffffff" />
                    <Text style={styles.actionRejectText}>Tolak</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* 2. Bagian Log Absensi Semua Staf */}
      {activeSegment === 'allAttendance' && (
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Rekapitulasi Presensi Karyawan</Text>
            <Text style={styles.sectionSubtitle}>
              Rekam data kehadiran harian seluruh staf perusahaan
            </Text>
          </View>

          {attendanceRecords.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="clipboard-outline" size={44} color="#94a3b8" />
              <Text style={styles.emptyCardTitle}>Belum Ada Data Presensi</Text>
            </View>
          ) : (
            attendanceRecords.map(item => {
              const displayName =
                item.employeeName ||
                employeeNames[item.employeeId || ''] ||
                (item.employeeId === 'EMP-202401' ? 'Budi Santoso' : item.employeeId) ||
                'Karyawan';

              return (
                <View key={item.id} style={styles.attendLogCard}>
                  <View style={styles.attendLogLeft}>
                    {item.photoUri ? (
                      <Image source={{ uri: item.photoUri }} style={styles.attendThumb} />
                    ) : (
                      <View style={styles.attendThumbPlaceholder}>
                        <Ionicons name="person" size={20} color="#7c3aed" />
                      </View>
                    )}
                    <View style={styles.attendLogMeta}>
                      {/* Nama Karyawan & NIP Badge */}
                      <View style={styles.employeeNameRow}>
                        <Text style={styles.employeeNameText} numberOfLines={1}>
                          {displayName}
                        </Text>
                        {item.employeeId && (
                          <View style={styles.nipBadge}>
                            <Text style={styles.nipBadgeText}>{item.employeeId}</Text>
                          </View>
                        )}
                      </View>

                      {/* Jenis Presensi */}
                      <View style={styles.attendTypeRow}>
                        <Ionicons
                          name={item.type === 'in' ? 'log-in-outline' : 'log-out-outline'}
                          size={13}
                          color={item.type === 'in' ? '#16a34a' : '#ea580c'}
                        />
                        <Text
                          style={[
                            styles.attendType,
                            { color: item.type === 'in' ? '#16a34a' : '#ea580c' },
                          ]}
                        >
                          {item.type === 'in' ? 'Absen Masuk' : 'Absen Pulang'}
                        </Text>
                      </View>

                      <Text style={styles.attendDate}>
                        {item.date} • {item.time} WIB
                      </Text>
                      <Text style={styles.attendDist}>
                        Jarak: {item.distanceToOffice} m •{' '}
                        {item.isWithinRadius ? 'Dalam Radius' : 'Luar Radius'}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.attendStatusTag,
                      item.status === 'Terlambat'
                        ? styles.tagDanger
                        : styles.tagSuccess,
                    ]}
                  >
                    <Text
                      style={[
                        styles.attendStatusText,
                        { color: item.status === 'Terlambat' ? '#b91c1c' : '#15803d' },
                      ]}
                    >
                      {item.status}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {/* 3. Bagian Absensi Manual Karyawan (Lupa Bawa HP) */}
      {activeSegment === 'manualAttendance' && (
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Presensi Manual Staf (Dispensasi)</Text>
            <Text style={styles.sectionSubtitle}>
              Pencatatan resmi kehadiran staf dengan otorisasi langsung Administrator
            </Text>
          </View>

          <View style={styles.manualCard}>
            <View style={styles.infoBanner}>
              <Ionicons name="information-circle" size={20} color="#7c3aed" />
              <Text style={styles.infoBannerText}>
                Fasilitas pencatatan presensi alternatif khusus staf yang hadir di lokasi kerja namun terkendala perangkat seluler. Seluruh data terekam sah di database cloud perusahaan melalui verifikasi resmi HRD.
              </Text>
            </View>

            {/* Input NIP */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>NIP / ID Karyawan *</Text>
              <TextInput
                style={styles.input}
                placeholder="Contoh: EMP-202401"
                placeholderTextColor="#94a3b8"
                value={manualNip}
                onChangeText={setManualNip}
                autoCapitalize="characters"
              />
            </View>

            {/* Tipe Absen: Masuk / Pulang */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Jenis Presensi *</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    manualType === 'in' && styles.toggleBtnActiveIn,
                  ]}
                  onPress={() => {
                    setManualType('in');
                    setManualStatus('Tepat Waktu');
                  }}
                >
                  <Ionicons
                    name="log-in-outline"
                    size={16}
                    color={manualType === 'in' ? '#ffffff' : '#64748b'}
                  />
                  <Text
                    style={[
                      styles.toggleText,
                      manualType === 'in' && styles.toggleTextActive,
                    ]}
                  >
                    Absen Masuk
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    manualType === 'out' && styles.toggleBtnActiveOut,
                  ]}
                  onPress={() => {
                    setManualType('out');
                    setManualStatus('Selesai');
                  }}
                >
                  <Ionicons
                    name="log-out-outline"
                    size={16}
                    color={manualType === 'out' ? '#ffffff' : '#64748b'}
                  />
                  <Text
                    style={[
                      styles.toggleText,
                      manualType === 'out' && styles.toggleTextActive,
                    ]}
                  >
                    Absen Pulang
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Status Kehadiran */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Status Kehadiran *</Text>
              <View style={styles.statusChipRow}>
                {manualType === 'in' ? (
                  <>
                    <TouchableOpacity
                      style={[
                        styles.statusChip,
                        manualStatus === 'Tepat Waktu' && styles.statusChipActive,
                      ]}
                      onPress={() => setManualStatus('Tepat Waktu')}
                    >
                      <Text
                        style={[
                          styles.statusChipText,
                          manualStatus === 'Tepat Waktu' && styles.statusChipTextActive,
                        ]}
                      >
                        Tepat Waktu
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.statusChip,
                        manualStatus === 'Terlambat' && styles.statusChipActive,
                      ]}
                      onPress={() => setManualStatus('Terlambat')}
                    >
                      <Text
                        style={[
                          styles.statusChipText,
                          manualStatus === 'Terlambat' && styles.statusChipTextActive,
                        ]}
                      >
                        Terlambat
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[
                        styles.statusChip,
                        manualStatus === 'Selesai' && styles.statusChipActive,
                      ]}
                      onPress={() => setManualStatus('Selesai')}
                    >
                      <Text
                        style={[
                          styles.statusChipText,
                          manualStatus === 'Selesai' && styles.statusChipTextActive,
                        ]}
                      >
                        Selesai (Tepat Jam)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.statusChip,
                        manualStatus === 'Pulang Cepat' && styles.statusChipActive,
                      ]}
                      onPress={() => setManualStatus('Pulang Cepat')}
                    >
                      <Text
                        style={[
                          styles.statusChipText,
                          manualStatus === 'Pulang Cepat' && styles.statusChipTextActive,
                        ]}
                      >
                        Pulang Cepat
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>

            {/* Catatan / Alasan */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Catatan Otorisasi Administrator / HRD</Text>
              <TextInput
                style={[styles.input, { height: 60 }]}
                placeholder="Keterangan dispensasi atau catatan verifikasi..."
                placeholderTextColor="#94a3b8"
                value={manualNotes}
                onChangeText={setManualNotes}
                multiline
              />
            </View>

            {/* Tombol Simpan */}
            <TouchableOpacity
              style={styles.submitManualBtn}
              onPress={handleManualAttendance}
              disabled={isSubmittingManual}
              activeOpacity={0.8}
            >
              {isSubmittingManual ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark-done-circle" size={18} color="#ffffff" />
                  <Text style={styles.submitManualText}>
                    Otorisasi & Simpan Presensi
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Keamanan & Anti Titip Absen (Device Binding Management) */}
      <View style={styles.securityBox}>
        <View style={styles.securityBoxHeader}>
          <Ionicons name="shield-checkmark" size={18} color="#7c3aed" />
          <Text style={styles.securityBoxTitle}>Otorisasi Perangkat Presensi (Device Binding)</Text>
        </View>
        <Text style={styles.securityBoxSub}>
          Akun karyawan terikat secara tunggal pada 1 (satu) perangkat fisik terverifikasi. Masukkan NIP karyawan di bawah untuk mereset otorisasi apabila terdapat penggantian perangkat resmi.
        </Text>
        <View style={styles.resetInputRow}>
          <TextInput
            style={styles.resetInput}
            placeholder="Masukkan NIP Karyawan"
            placeholderTextColor="#94a3b8"
            value={resetNip}
            onChangeText={setResetNip}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={styles.resetBindingBtn}
            onPress={handleResetDevice}
            disabled={isResettingDevice}
          >
            {isResettingDevice ? (
              <ActivityIndicator size="small" color="#7c3aed" />
            ) : (
              <>
                <Ionicons name="phone-portrait-outline" size={16} color="#7c3aed" />
                <Text style={styles.resetBindingText}>Reset Otorisasi</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1,
  },
  kpiNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  kpiLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: '#7c3aed',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  segmentTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  section: {
    gap: 10,
  },
  sectionTitleRow: {
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  emptyCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
  },
  emptyCardSub: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  approvalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1,
  },
  approvalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    backgroundColor: '#f5f3ff',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd6fe',
  },
  typeBadgeText: {
    color: '#7c3aed',
    fontSize: 12,
    fontWeight: '700',
  },
  statusPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  pillPending: {
    backgroundColor: '#fef3c7',
  },
  pillApproved: {
    backgroundColor: '#dcfce7',
  },
  pillRejected: {
    backgroundColor: '#fee2e2',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  dateText: {
    fontSize: 12,
    color: '#64748b',
  },
  reasonText: {
    fontSize: 13,
    color: '#1e293b',
    lineHeight: 18,
    marginBottom: 8,
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  attachmentImg: {
    width: 36,
    height: 36,
    borderRadius: 6,
  },
  attachmentText: {
    fontSize: 11,
    color: '#475569',
    flex: 1,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
  },
  actionApproveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#16a34a',
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionApproveText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  actionRejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#dc2626',
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionRejectText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  attendLogCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  attendLogLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  attendThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  attendThumbPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendLogMeta: {
    flex: 1,
    gap: 3,
  },
  employeeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  employeeNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  nipBadge: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  nipBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  attendTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  attendType: {
    fontSize: 12,
    fontWeight: '700',
  },
  attendDate: {
    fontSize: 11,
    color: '#64748b',
  },
  attendDist: {
    fontSize: 11,
    color: '#0284c7',
  },
  attendStatusTag: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  tagSuccess: {
    backgroundColor: '#dcfce7',
  },
  tagDanger: {
    backgroundColor: '#fee2e2',
  },
  attendStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  securityBox: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 14,
  },
  securityBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  securityBoxTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  securityBoxSub: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
    marginBottom: 10,
  },
  resetInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  resetInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },
  resetBindingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  resetBindingText: {
    color: '#7c3aed',
    fontSize: 12,
    fontWeight: '700',
  },
  // Manual Attendance Form Styles
  manualCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    elevation: 2,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#6d28d9',
    lineHeight: 16,
  },
  formGroup: {
    marginBottom: 14,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
  },
  toggleBtnActiveIn: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  toggleBtnActiveOut: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  toggleTextActive: {
    color: '#ffffff',
  },
  statusChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  statusChipActive: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  statusChipTextActive: {
    color: '#ffffff',
  },
  submitManualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7c3aed',
    height: 48,
    borderRadius: 12,
    marginTop: 8,
    elevation: 2,
  },
  submitManualText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
