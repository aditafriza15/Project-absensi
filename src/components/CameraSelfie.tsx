import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

interface CameraSelfieProps {
  photoUri: string | null;
  onPhotoSelected: (uri: string | null) => void;
}

export const CameraSelfie: React.FC<CameraSelfieProps> = ({
  photoUri,
  onPhotoSelected,
}) => {
  const [isOpeningCamera, setIsOpeningCamera] = useState(false);

  const takeSelfie = async () => {
    try {
      setIsOpeningCamera(true);
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Izin Kamera Dibutuhkan',
          'Harap berikan izin kamera untuk mengambil foto selfie saat absensi.'
        );
        setIsOpeningCamera(false);
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.front,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        onPhotoSelected(result.assets[0].uri);
      }
    } catch (e) {
      console.error('Error opening camera:', e);
      Alert.alert('Error', 'Gagal membuka kamera: ' + (e as Error).message);
    } finally {
      setIsOpeningCamera(false);
    }
  };

  const pickFromGallery = async () => {
    try {
      setIsOpeningCamera(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        onPhotoSelected(result.assets[0].uri);
      }
    } catch (e) {
      console.error('Error picking image:', e);
    } finally {
      setIsOpeningCamera(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Ionicons name="camera-sharp" size={20} color="#0284c7" />
        <Text style={styles.title}>Foto Selfie Kehadiran</Text>
      </View>

      <Text style={styles.subtitle}>
        Ambil foto wajah untuk verifikasi bukti kehadiran absensi.
      </Text>

      {photoUri ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: photoUri }} style={styles.previewImage} />
          <View style={styles.previewInfo}>
            <View style={styles.badgeSuccess}>
              <Ionicons name="checkmark-circle" size={16} color="#15803d" />
              <Text style={styles.badgeSuccessText}>Foto Siap Digunakan</Text>
            </View>
            <TouchableOpacity
              style={styles.retakeBtn}
              onPress={takeSelfie}
              disabled={isOpeningCamera}
            >
              <Ionicons name="camera-reverse-outline" size={16} color="#0284c7" />
              <Text style={styles.retakeText}>Ambil Ulang</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.placeholderContainer}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="person-circle-outline" size={54} color="#94a3b8" />
          </View>
          <TouchableOpacity
            style={styles.captureBtn}
            onPress={takeSelfie}
            disabled={isOpeningCamera}
          >
            {isOpeningCamera ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="camera" size={18} color="#ffffff" />
                <Text style={styles.captureBtnText}>Buka Kamera & Foto Selfie</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.securityNoticeRow}>
            <Ionicons name="shield-checkmark" size={14} color="#15803d" />
            <Text style={styles.securityNoticeText}>
              Kamera Langsung Wajib (Foto Galeri Dinonaktifkan demi Keamanan)
            </Text>
          </View>
        </View>
      )}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
  },
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  previewInfo: {
    flex: 1,
    gap: 10,
  },
  badgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  badgeSuccessText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803d',
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  retakeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284c7',
  },
  placeholderContainer: {
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  emptyIconBox: {
    marginBottom: 10,
  },
  captureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284c7',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 8,
  },
  captureBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  securityNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginTop: 4,
  },
  securityNoticeText: {
    fontSize: 11,
    color: '#15803d',
    fontWeight: '600',
  },
});
