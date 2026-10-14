import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StorageService } from '../services/storage';
import { ApiService } from '../services/api';
import { AttendanceRecord } from '../types';

export const HistoryScreen: React.FC = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'in' | 'out'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);

  const loadRecords = useCallback(async () => {
    try {
      const profile = await StorageService.getUserProfile();
      // Prioritaskan ambil data langsung dari server backend
      const serverRecords = await ApiService.getAttendanceHistory(profile.employeeId);
      if (serverRecords) {
        setRecords(serverRecords);
        await StorageService.saveAllAttendanceRecords(serverRecords);
      } else {
        const localData = await StorageService.getAttendanceRecords();
        setRecords(localData);
      }
    } catch (e) {
      console.error('Error fetching history from server:', e);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecords();
    setRefreshing(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Hapus Catatan',
      'Apakah Anda yakin ingin menghapus catatan absensi ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            await StorageService.deleteAttendanceRecord(id);
            await loadRecords();
            setSelectedRecord(null);
          },
        },
      ]
    );
  };

  // Compute stats
  const totalIn = records.filter(r => r.type === 'in').length;
  const onTimeCount = records.filter(r => r.status === 'Tepat Waktu').length;
  const lateCount = records.filter(r => r.status === 'Terlambat').length;

  const filteredRecords = records.filter(r => {
    if (filterType === 'all') return true;
    return r.type === filterType;
  });

  const renderItem = ({ item }: { item: AttendanceRecord }) => {
    const isCheckIn = item.type === 'in';
    const isLate = item.status === 'Terlambat';

    return (
      <TouchableOpacity
        style={styles.itemCard}
        activeOpacity={0.7}
        onPress={() => setSelectedRecord(item)}
      >
        <View style={styles.itemLeft}>
          {item.photoUri ? (
            <Image source={{ uri: item.photoUri }} style={styles.avatarThumb} />
          ) : (
            <View style={[styles.avatarThumb, styles.avatarPlaceholder]}>
              <Ionicons
                name={isCheckIn ? 'log-in-outline' : 'log-out-outline'}
                size={22}
                color="#64748b"
              />
            </View>
          )}

          <View style={styles.itemMain}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemType}>
                {isCheckIn ? 'Absen Masuk' : 'Absen Pulang'}
              </Text>
              <View
                style={[
                  styles.statusTag,
                  isLate ? styles.tagDanger : styles.tagSuccess,
                ]}
              >
                <Text
                  style={[
                    styles.statusTagText,
                    { color: isLate ? '#b91c1c' : '#15803d' },
                  ]}
                >
                  {item.status}
                </Text>
              </View>
            </View>

            <View style={styles.itemMetaRow}>
              <Ionicons name="calendar-outline" size={13} color="#64748b" />
              <Text style={styles.itemMetaText}>{item.date}</Text>
              <Text style={styles.dotSeparator}>•</Text>
              <Ionicons name="time-outline" size={13} color="#64748b" />
              <Text style={styles.itemTimeText}>{item.time} WIB</Text>
            </View>

            <View style={styles.itemLocationRow}>
              <Ionicons
                name={item.isWithinRadius ? 'checkmark-circle' : 'alert-circle'}
                size={13}
                color={item.isWithinRadius ? '#15803d' : '#b45309'}
              />
              <Text style={styles.itemLocationText} numberOfLines={1}>
                {item.distanceToOffice} m • {item.address || 'Lokasi GPS'}
              </Text>
            </View>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Rekap Statistik Bulanan */}
      <View style={styles.statsContainer}>
        <View style={[styles.statBox, { borderLeftColor: '#0284c7' }]}>
          <Text style={styles.statNumber}>{totalIn}</Text>
          <Text style={styles.statLabel}>Total Masuk</Text>
        </View>

        <View style={[styles.statBox, { borderLeftColor: '#15803d' }]}>
          <Text style={styles.statNumber}>{onTimeCount}</Text>
          <Text style={styles.statLabel}>Tepat Waktu</Text>
        </View>

        <View style={[styles.statBox, { borderLeftColor: '#dc2626' }]}>
          <Text style={styles.statNumber}>{lateCount}</Text>
          <Text style={styles.statLabel}>Terlambat</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterBtn, filterType === 'all' && styles.filterBtnActive]}
          onPress={() => setFilterType('all')}
        >
          <Text
            style={[styles.filterBtnText, filterType === 'all' && styles.filterBtnTextActive]}
          >
            Semua ({records.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterBtn, filterType === 'in' && styles.filterBtnActive]}
          onPress={() => setFilterType('in')}
        >
          <Text
            style={[styles.filterBtnText, filterType === 'in' && styles.filterBtnTextActive]}
          >
            Masuk ({totalIn})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterBtn, filterType === 'out' && styles.filterBtnActive]}
          onPress={() => setFilterType('out')}
        >
          <Text
            style={[styles.filterBtnText, filterType === 'out' && styles.filterBtnTextActive]}
          >
            Pulang ({records.filter(r => r.type === 'out').length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* History List */}
      <FlatList
        data={filteredRecords}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0284c7']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="document-text-outline" size={48} color="#94a3b8" />
            <Text style={styles.emptyTitle}>Belum Ada Riwayat Absensi</Text>
            <Text style={styles.emptySub}>
              Catatan absensi harian Anda akan tampil secara rapi di sini.
            </Text>
          </View>
        }
      />

      {/* Modal Detail Absensi */}
      <Modal
        visible={Boolean(selectedRecord)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedRecord(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detail Absensi</Text>
              <TouchableOpacity onPress={() => setSelectedRecord(null)}>
                <Ionicons name="close-circle" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {selectedRecord && (
              <View style={styles.modalBody}>
                {selectedRecord.photoUri ? (
                  <Image
                    source={{ uri: selectedRecord.photoUri }}
                    style={styles.modalImage}
                  />
                ) : (
                  <View style={styles.modalNoImage}>
                    <Ionicons name="person-circle" size={54} color="#94a3b8" />
                    <Text style={styles.noImageText}>Tidak ada foto</Text>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Jenis Absensi:</Text>
                  <Text style={styles.detailValue}>
                    {selectedRecord.type === 'in' ? 'Absen Masuk' : 'Absen Pulang'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Waktu:</Text>
                  <Text style={styles.detailValue}>
                    {selectedRecord.date} • {selectedRecord.time} WIB
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <Text style={[styles.detailValue, { fontWeight: '700' }]}>
                    {selectedRecord.status}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Jarak ke Kantor:</Text>
                  <Text style={styles.detailValue}>
                    {selectedRecord.distanceToOffice} meter ({selectedRecord.isWithinRadius ? 'Dalam Radius' : 'Luar Radius'})
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Alamat/GPS:</Text>
                  <Text style={styles.detailValueAddress}>
                    {selectedRecord.address || `${selectedRecord.latitude}, ${selectedRecord.longitude}`}
                  </Text>
                </View>

                {selectedRecord.notes ? (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesLabel}>Catatan Karyawan:</Text>
                    <Text style={styles.notesContent}>{selectedRecord.notes}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(selectedRecord.id)}
                >
                  <Ionicons name="trash-outline" size={16} color="#dc2626" />
                  <Text style={styles.deleteBtnText}>Hapus Catatan Ini</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  filterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  filterBtnActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  filterBtnText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  filterBtnTextActive: {
    color: '#ffffff',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
    gap: 10,
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  avatarThumb: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemMain: {
    flex: 1,
    gap: 3,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: 6,
  },
  itemType: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  statusTag: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  tagSuccess: {
    backgroundColor: '#dcfce7',
  },
  tagDanger: {
    backgroundColor: '#fee2e2',
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemMetaText: {
    fontSize: 11,
    color: '#64748b',
  },
  dotSeparator: {
    fontSize: 10,
    color: '#cbd5e1',
  },
  itemTimeText: {
    fontSize: 11,
    color: '#0284c7',
    fontWeight: '600',
  },
  itemLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemLocationText: {
    fontSize: 11,
    color: '#475569',
    flex: 1,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
  },
  emptySub: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    maxWidth: 240,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalBody: {
    gap: 10,
  },
  modalImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    marginBottom: 6,
  },
  modalNoImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 6,
  },
  noImageText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748b',
    flex: 1,
  },
  detailValue: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1.5,
  },
  detailValueAddress: {
    fontSize: 12,
    color: '#334155',
    textAlign: 'right',
    flex: 1.5,
  },
  notesBox: {
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 4,
  },
  notesLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 2,
  },
  notesContent: {
    fontSize: 12,
    color: '#1e293b',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginTop: 8,
  },
  deleteBtnText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '600',
  },
});
