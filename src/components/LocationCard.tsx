import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OfficeConfig } from '../types';
import { LocationData } from '../services/location';

interface LocationCardProps {
  office: OfficeConfig;
  location: LocationData | null;
  distance: number | null;
  isWithinRadius: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  onRefresh: () => void;
}

export const LocationCard: React.FC<LocationCardProps> = ({
  office,
  location,
  distance,
  isWithinRadius,
  isLoading,
  errorMessage,
  onRefresh,
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Ionicons name="location-sharp" size={20} color="#0284c7" />
          <Text style={styles.title}>Validasi Lokasi Kantor</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#0284c7" />
          ) : (
            <View style={styles.refreshInner}>
              <Ionicons name="refresh" size={15} color="#0284c7" />
              <Text style={styles.refreshText}>Refresh</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {errorMessage ? (
        <View style={styles.errorBox}>
          <Ionicons name="warning-outline" size={18} color="#ef4444" />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {location?.isMocked && (
        <View style={[styles.errorBox, { backgroundColor: '#fef2f2', borderColor: '#f87171', borderWidth: 1 }]}>
          <Ionicons name="shield-outline" size={20} color="#b91c1c" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#b91c1c' }}>
              Terdeteksi Fake GPS / Mock Location!
            </Text>
            <Text style={{ fontSize: 11, color: '#7f1d1d', marginTop: 2 }}>
              Aplikasi pemalsu lokasi terdeteksi aktif. Presensi tidak dapat dilakukan demi keamanan.
            </Text>
          </View>
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Titik Kantor:</Text>
          <Text style={styles.value} numberOfLines={1}>{office.name}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Radius Maksimal:</Text>
          <Text style={styles.value}>{office.radiusMeters} meter</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Lokasi Anda Saat Ini:</Text>
          <Text style={styles.valueAddress} numberOfLines={2}>
            {location ? location.address : 'Mendeteksi lokasi...'}
          </Text>
        </View>

        {distance !== null && (
          <View style={[
            styles.statusBadge,
            isWithinRadius ? styles.badgeSuccess : styles.badgeDanger
          ]}>
            <Ionicons
              name={isWithinRadius ? 'checkmark-circle' : 'alert-circle'}
              size={18}
              color={isWithinRadius ? '#15803d' : '#b91c1c'}
            />
            <View style={styles.statusTextContainer}>
              <Text style={[
                styles.statusTitle,
                { color: isWithinRadius ? '#15803d' : '#b91c1c' }
              ]}>
                {isWithinRadius ? 'Dalam Radius Kantor' : 'Di Luar Radius Kantor'}
              </Text>
              <Text style={styles.statusSub}>
                Jarak Anda: {distance} meter dari titik kantor
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  refreshBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  refreshInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  refreshText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284c7',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#b91c1c',
  },
  content: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  label: {
    fontSize: 13,
    color: '#64748b',
    flex: 1,
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
    textAlign: 'right',
  },
  valueAddress: {
    fontSize: 12,
    fontWeight: '500',
    color: '#334155',
    flex: 1.5,
    textAlign: 'right',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginTop: 6,
    gap: 10,
  },
  badgeSuccess: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  badgeDanger: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusSub: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
});
