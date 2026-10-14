import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserProfile } from '../types';

interface HeaderProps {
  profile: UserProfile;
}

export const Header: React.FC<HeaderProps> = ({ profile }) => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDayDate = (date: Date) => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const day = days[date.getDay()];
    const d = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}, ${d} ${month} ${year}`;
  };

  const formatTime = (date: Date) => {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.greeting}>Halo, Selamat Datang</Text>
          <Text style={styles.name} numberOfLines={1}>{profile.name}</Text>
          <Text style={styles.badgeText}>
            {profile.employeeId} • {profile.department}
          </Text>
        </View>
      </View>

      <View style={styles.clockSection}>
        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={15} color="#475569" />
          <Text style={styles.dateText}>{formatDayDate(currentTime)}</Text>
        </View>
        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={24} color="#0284c7" />
          <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
          <Text style={styles.timeZone}>WIB</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  greeting: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 1,
  },
  badgeText: {
    fontSize: 12,
    color: '#0284c7',
    fontWeight: '600',
    marginTop: 2,
  },
  clockSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0284c7',
    letterSpacing: 1,
  },
  timeZone: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
    marginTop: 6,
  },
});
