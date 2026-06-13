class GeoManager {
  constructor() {
    this.simulated = { lat: null, lng: null, active: false };
    this.watchId = null;
    this.current = { lat: null, lng: null, accuracy: null };
  }

  startTracking(callback) {
    if (!navigator.geolocation) return;
    if (this.watchId !== null) return; // Already tracking
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        this.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
        if (callback) callback(this.current);
      },
      (err) => console.warn('GPS error', err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  // Haversine formula en metros
  distance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = (deg) => deg * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat/2)**2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  isInRange(location) {
    if (!location.gps) return true; // No GPS required
    const pos = this.simulated.active ? this.simulated : this.current;
    if (pos.lat == null) return false;
    const dist = this.distance(pos.lat, pos.lng, location.gps.lat, location.gps.lng);
    return dist <= (location.gps.radius_meters || 20);
  }

  getDistanceText(location) {
    if (!location.gps) return null;
    const pos = this.simulated.active ? this.simulated : this.current;
    if (pos.lat == null) return 'Obteniendo GPS...';
    const dist = this.distance(pos.lat, pos.lng, location.gps.lat, location.gps.lng);
    if (dist < 1000) return `Estás a ${Math.round(dist)} metros`;
    return `Estás a ${(dist/1000).toFixed(1)} km`;
  }

  simulate(lat, lng) {
    this.simulated = { lat, lng, active: true };
  }

  clearSimulation() {
    this.simulated.active = false;
  }

  // Calculate destination point from lat/lng + bearing (degrees from north) + distance (meters)
  calculateRelativePosition(lat, lng, bearing, distance) {
    const R = 6371000;
    const toRad = (deg) => deg * Math.PI / 180;
    const toDeg = (rad) => rad * 180 / Math.PI;
    const lat1 = toRad(lat);
    const lng1 = toRad(lng);
    const brng = toRad(bearing);
    const d = distance / R;

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(d) +
      Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
    );
    const lng2 = lng1 + Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

    return { lat: parseFloat(toDeg(lat2).toFixed(6)), lng: parseFloat(toDeg(lng2).toFixed(6)) };
  }
}
