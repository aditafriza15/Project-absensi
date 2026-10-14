import * as Location from 'expo-location';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  address: string;
  isMocked: boolean;
}

/**
 * Calculates distance in meters between two lat/lng coordinates using the Haversine formula.
 */
export function calculateDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export const LocationService = {
  async requestPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (e) {
      console.error('Error requesting location permission:', e);
      return false;
    }
  },

  async getCurrentLocation(): Promise<LocationData | null> {
    try {
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        throw new Error('Layanan Lokasi (GPS) di ponsel Anda belum diaktifkan. Silakan aktifkan GPS.');
      }

      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        throw new Error('Izin lokasi ditolak. Buka Pengaturan HP dan izinkan akses lokasi.');
      }

      // Dapatkan posisi GPS hardware terbaru dengan Accuracy.Highest
      let position: Location.LocationObject | null = null;

      try {
        position = await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Highest,
          }),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error('GPS Hardware Timeout')), 12000)
          ),
        ]);
      } catch (freshErr) {
        console.warn('Accuracy.Highest timeout, mencoba Accuracy.High:', freshErr);
        try {
          position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
        } catch {
          // Hanya gunakan lastKnownPosition jika tidak lebih tua dari 5 menit
          const lastKnown = await Location.getLastKnownPositionAsync();
          if (lastKnown && Date.now() - lastKnown.timestamp < 5 * 60 * 1000) {
            position = lastKnown;
          }
        }
      }

      if (!position) {
        throw new Error('Gagal mendapatkan sinyal GPS terkini. Pastikan Anda berada di area terbuka dan GPS HP aktif.');
      }

      const { latitude, longitude, accuracy } = position.coords;

      // Reverse geocoding alamat dengan timeout 3 detik agar tidak memblokir UI
      let formattedAddress = 'Koordinat: ' + latitude.toFixed(5) + ', ' + longitude.toFixed(5);
      try {
        const reversePromise = Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });
        const geocodeTimeout = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 3000)
        );
        const reverseResults = await Promise.race([reversePromise, geocodeTimeout]);

        if (reverseResults && reverseResults.length > 0) {
          const item = reverseResults[0];
          const parts = [
            item.street,
            item.subregion || item.district,
            item.city,
          ].filter(Boolean);
          if (parts.length > 0) {
            formattedAddress = parts.join(', ');
          }
        }
      } catch {
        // Fallback to coordinates
      }

      const isMocked = Boolean((position as any).mocked || (position.coords as any).isFromMockProvider);

      return {
        latitude,
        longitude,
        accuracy,
        address: formattedAddress,
        isMocked,
      };
    } catch (e) {
      console.error('Error getting location:', e);
      throw e;
    }
  },
};
