import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { StorageService } from '../services/storage';
import { ApiService } from '../services/api';
import { LeaveRequest, LeaveType } from '../types';

export const LeaveScreen: React.FC = () => {
  const [leaveType, setLeaveType] = useState<LeaveType>('Izin');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [attachmentUri, setAttachmentUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);

  const leaveTypes: LeaveType[] = ['Izin', 'Sakit', 'Cuti', 'Dinas Luar'];

  const loadRequests = useCallback(async () => {
    try {
      const prof = await StorageService.getUserProfile();
      const srvData = await ApiService.getLeaveRequests(prof.employeeId);
      if (srvData) {
        setRequests(srvData);
        await StorageService.saveAllLeaveRequests(srvData);
      } else {
        const local = await StorageService.getLeaveRequests();
        setRequests(local);
      }
    } catch (e) {
      console.error('Error loading leave requests from server:', e);
    }
  }, []);

  useEffect(() => {
    loadRequests();
    // Default today's date formatted
    const now = new Date();
    const dStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setStartDate(dStr);
    setEndDate(dStr);
  }, [loadRequests]);

  const pickAttachment = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAttachmentUri(result.assets[0].uri);
      }
    } catch (e) {
      console.error('Error selecting attachment:', e);
    }
  };

  const takeAttachmentCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Izin Kamera', 'Harap izinkan akses kamera.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAttachmentUri(result.assets[0].uri);
      }
    } catch (e) {
      console.error('Error taking photo:', e);
    }
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      Alert.alert('Alasan Wajib Diisi', 'Silakan tuliskan alasan izin atau sakit secara singkat.');
      return;
    }

    try {
      const prof = await StorageService.getUserProfile();
      const newRequest: LeaveRequest = {
        id: Date.now().toString(),
        employeeId: prof.employeeId,
        type: leaveType,
        startDate,
        endDate,
        reason: reason.trim(),
        attachmentUri: attachmentUri || undefined,
        createdAt: new Date().toISOString(),
        status: 'Menunggu',
      };

      // Kirim ke backend API Laravel (Wajib Server)
      const apiRes = await ApiService.submitLeaveRequest(newRequest, attachmentUri, prof.employeeId);
      if (!apiRes.success) {
        Alert.alert(
          'Gagal Mengirim ke Server',
          apiRes.error || 'Server backend tidak dapat memproses pengajuan izin Anda.'
        );
        setIsSubmitting(false);
        return;
      }

      await StorageService.saveLeaveRequest(newRequest);
      await loadRequests();

      // Reset form
      setReason('');
      setAttachmentUri(null);

      Alert.alert(
        'Pengajuan Terkirim ke Server!',
        `Permohonan ${leaveType} Anda telah berhasil diajukan ke server dan akan segera ditinjau oleh HRD/Admin.`
      );
    } catch (e) {
      Alert.alert('Error', 'Gagal mengirim pengajuan: ' + (e as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderLeaveItem = ({ item }: { item: LeaveRequest }) => {
    const getStatusStyle = (status: string) => {
      switch (status) {
        case 'Disetujui':
          return { bg: '#dcfce7', text: '#15803d' };
        case 'Ditolak':
          return { bg: '#fee2e2', text: '#b91c1c' };
        default:
          return { bg: '#fef3c7', text: '#b45309' };
      }
    };

    const statusStyle = getStatusStyle(item.status);

    return (
      <View style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <View style={styles.typeTag}>
            <Ionicons
              name={
                item.type === 'Sakit'
                  ? 'medical-outline'
                  : item.type === 'Cuti'
                  ? 'airplane-outline'
                  : item.type === 'Dinas Luar'
                  ? 'briefcase-outline'
                  : 'document-text-outline'
              }
              size={15}
              color="#0284c7"
            />
            <Text style={styles.typeTagText}>{item.type}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
              {item.status}
            </Text>
          </View>
        </View>

        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={13} color="#64748b" />
          <Text style={styles.dateText}>
            {item.startDate} {item.startDate !== item.endDate ? `s/d ${item.endDate}` : ''}
          </Text>
        </View>

        <Text style={styles.reasonText}>{item.reason}</Text>

        {item.attachmentUri && (
          <View style={styles.attachmentPreviewRow}>
            <Image source={{ uri: item.attachmentUri }} style={styles.attachmentThumb} />
            <Text style={styles.attachmentNotice}>Lampiran terunggah</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Form Pengajuan Izin */}
      <View style={styles.formCard}>
        <View style={styles.formHeader}>
          <Ionicons name="create-outline" size={20} color="#0284c7" />
          <Text style={styles.formTitle}>Form Pengajuan Izin / Cuti</Text>
        </View>

        {/* Jenis Pengajuan Chips */}
        <Text style={styles.fieldLabel}>Jenis Pengajuan</Text>
        <View style={styles.typeChipsRow}>
          {leaveTypes.map(t => (
            <TouchableOpacity
              key={t}
              style={[
                styles.typeChip,
                leaveType === t && styles.typeChipActive,
              ]}
              onPress={() => setLeaveType(t)}
            >
              <Text
                style={[
                  styles.typeChipText,
                  leaveType === t && styles.typeChipTextActive,
                ]}
              >
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tanggal */}
        <View style={styles.datesRow}>
          <View style={styles.dateField}>
            <Text style={styles.fieldLabel}>Mulai (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94a3b8"
            />
          </View>
          <View style={styles.dateField}>
            <Text style={styles.fieldLabel}>Selesai (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94a3b8"
            />
          </View>
        </View>

        {/* Alasan */}
        <Text style={styles.fieldLabel}>Alasan / Keterangan</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={reason}
          onChangeText={setReason}
          placeholder="Jelaskan alasan izin, sakit, atau cuti..."
          placeholderTextColor="#94a3b8"
          multiline
          numberOfLines={3}
        />

        {/* Lampiran Bukti / Surat Dokter */}
        <Text style={styles.fieldLabel}>Lampiran Dokumen / Surat Dokter (Opsional)</Text>
        {attachmentUri ? (
          <View style={styles.attachmentBox}>
            <Image source={{ uri: attachmentUri }} style={styles.previewAttachment} />
            <TouchableOpacity
              style={styles.removeAttachmentBtn}
              onPress={() => setAttachmentUri(null)}
            >
              <Ionicons name="trash-outline" size={16} color="#dc2626" />
              <Text style={styles.removeText}>Hapus Lampiran</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.attachmentOptionsRow}>
            <TouchableOpacity
              style={styles.attachmentBtn}
              onPress={takeAttachmentCamera}
            >
              <Ionicons name="camera-outline" size={18} color="#0284c7" />
              <Text style={styles.attachmentBtnText}>Foto Surat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.attachmentBtn}
              onPress={pickAttachment}
            >
              <Ionicons name="image-outline" size={18} color="#0284c7" />
              <Text style={styles.attachmentBtnText}>Pilih File/Galeri</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="send" size={18} color="#ffffff" />
              <Text style={styles.submitBtnText}>Kirim Pengajuan Izin</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Riwayat Pengajuan Izin */}
      <View style={styles.historySection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Riwayat Pengajuan Anda</Text>
          <Text style={styles.sectionCount}>({requests.length})</Text>
        </View>

        {requests.length === 0 ? (
          <View style={styles.emptyRequests}>
            <Ionicons name="mail-unread-outline" size={40} color="#94a3b8" />
            <Text style={styles.emptyRequestsText}>Belum ada pengajuan izin/cuti.</Text>
          </View>
        ) : (
          requests.map(item => (
            <View key={item.id} style={{ marginBottom: 10 }}>
              {renderLeaveItem({ item })}
            </View>
          ))
        )}
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
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
    marginTop: 4,
  },
  typeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  typeChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  typeChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  typeChipTextActive: {
    color: '#ffffff',
  },
  datesRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  dateField: {
    flex: 1,
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
  textArea: {
    height: 70,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  attachmentOptionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  attachmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#f0f9ff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderStyle: 'dashed',
  },
  attachmentBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284c7',
  },
  attachmentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  previewAttachment: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  removeAttachmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
  },
  removeText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '600',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284c7',
    paddingVertical: 13,
    borderRadius: 12,
    elevation: 2,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  historySection: {
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  sectionCount: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  emptyRequests: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  emptyRequestsText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  requestCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeTagText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusBadgeText: {
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
    color: '#334155',
    lineHeight: 18,
  },
  attachmentPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
  },
  attachmentThumb: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  attachmentNotice: {
    fontSize: 11,
    color: '#64748b',
  },
});
