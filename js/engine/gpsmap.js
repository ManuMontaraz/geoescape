// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Manuel Arjona Blanco <manuel@manumontaraz.es>

class GpsBlockMap {
  constructor(geoManager, isTestMode, itemManager, npcManager) {
    this.geo = geoManager;
    this.isTest = isTestMode;
    this.itemManager = itemManager;
    this.npcManager = npcManager;
    this.map = null;
    this.playerMarker = null;

    this.itemMarkers = {};
    this.npcMarkers = {};
    this.itemRadiusCircles = {};
    this.npcRadiusCircles = {};
    this.locationMarkers = [];
    this.active = false;
    this.timer = null;
    this.campaignId = null;
    this.campaign = null;
    this._lastPosition = null;
    this._compassOffset = null;
    this._lastAlpha = null;
    this._orientationListener = null;
    this._isCalibrated = false;
  }

  setTestMode(isTest) {
    this.isTest = isTest;
  }

  _isLocationVisible(loc) {
    const vc = loc.visible_condition;
    if (!vc) return true;
    if (!vc.operator && !vc.conditions) return this._evaluateSingleCondition(vc);
    const op = vc.operator || 'and';
    const conditions = vc.conditions || [vc];
    switch (op) {
      case 'and':  return conditions.every(c => this._evaluateSingleCondition(c));
      case 'nand': return !conditions.every(c => this._evaluateSingleCondition(c));
      case 'or':   return conditions.some(c => this._evaluateSingleCondition(c));
      case 'nor':  return !conditions.some(c => this._evaluateSingleCondition(c));
      default:     return true;
    }
  }

  _evaluateSingleCondition(cond) {
    if (!cond) return true;
    if (cond.has_item) return window.game?.inventory?.has(cond.has_item) || false;
    if (cond.var !== undefined) {
      const varValue = window.game?.variables?.[cond.var];
      return String(varValue).toLowerCase() === String(cond.eq).toLowerCase();
    }
    return true;
  }

  open(campaign, campaignId) {
    this.active = true;
    this.campaignId = campaignId;
    this.campaign = campaign;
    this._isCalibrated = false;
    this._compassOffset = null;
    this._lastPosition = null;
    // Reset to circle if it was previously an arrow
    const iconContainer = document.getElementById('gps-player-icon');
    if (iconContainer) {
      iconContainer.innerHTML = `
        <div id="gps-player-circle" style="width:16px;height:16px;background:#e94560;border:3px solid #fff;border-radius:50%;box-shadow:0 0 8px #e94560;"></div>
      `;
      iconContainer.style.transform = '';
    }
    document.getElementById('gps-block-panel').classList.remove('hidden');
    document.getElementById('gps-bar-normal').classList.toggle('hidden', this.isTest);
    document.getElementById('gps-bar-test').classList.toggle('hidden', !this.isTest);
    // Hide the game's top-bar (it's replaced by the GPS panel's top-bar)
    const topBar = document.getElementById('top-bar');
    if (topBar) topBar.classList.add('hidden');

    const pos = this.geo.simulated.active ? this.geo.simulated : this.geo.current;
    const hasPos = pos.lat != null;

    // Compute center from campaign origin or player position
    const locs = campaign.locations || [];
    let center = [40.4168, -3.7038];
    if (campaign.origin) {
      center = [campaign.origin.lat, campaign.origin.lng];
    } else if (hasPos) {
      center = [pos.lat, pos.lng];
    } else if (locs.length > 0 && locs[0].gps && locs[0].gps.lat != null && locs[0].gps.lng != null) {
      center = [locs[0].gps.lat, locs[0].gps.lng];
    }

    if (!this.map) {
      const container = document.getElementById('gps-map');
      this.map = L.map(container, { zoomControl: true }).setView(center, 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(this.map);

      const playerIcon = L.divIcon({
        className: 'gps-player-marker',
        html: '<div id="gps-player-icon" style="width:22px;height:22px;display:flex;align-items:center;justify-content:center;transform-origin:center center;"><div id="gps-player-circle" style="width:16px;height:16px;background:#e94560;border:3px solid #fff;border-radius:50%;box-shadow:0 0 8px #e94560;"></div></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });
      this.playerMarker = L.marker(center, {icon: playerIcon, zIndexOffset: 1000}).addTo(this.map);
    }

    // Always register orientation listener when opening (re-opening after close removes it)
    this._setupOrientation();

    // Always refresh location markers (clear and rebuild to pick up edits)
    this._removeLocationMarkers();
    this._addLocationMarkers(locs);
    this._updatePlayer();
    this._refreshEntityMarkers();

    // Fit to all markers (locations + items + npcs + player)
    const allMarkers = [
      this.playerMarker,
      ...this.locationMarkers.map(m => m.marker),
      ...Object.values(this.itemMarkers),
      ...Object.values(this.npcMarkers)
    ].filter(Boolean);
    const group = new L.featureGroup(allMarkers);
    if (group.getLayers().length > 0) {
      this.map.fitBounds(group.getBounds(), {padding: [50, 50], maxZoom: 18});
    }

    this._updateDistanceText();
    this._startTimer();
  }

  close() {
    this.active = false;
    document.getElementById('gps-block-panel').classList.add('hidden');
    document.getElementById('gps-bar-normal').classList.add('hidden');
    document.getElementById('gps-bar-test').classList.add('hidden');
    // Show the game's top-bar again
    const topBar = document.getElementById('top-bar');
    if (topBar) topBar.classList.remove('hidden');
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this._orientationListener) {
      window.removeEventListener('deviceorientation', this._orientationListener);
      this._orientationListener = null;
    }
    this._lastPosition = null;
    this._compassOffset = null;
    this._lastAlpha = null;
    this._isCalibrated = false;
  }

  _updatePlayer() {
    const pos = this.geo.simulated.active ? this.geo.simulated : this.geo.current;
    if (pos.lat == null || !this.playerMarker) return;
    const latlng = [pos.lat, pos.lng];
    this.playerMarker.setLatLng(latlng);
    this.map.panTo(latlng, {animate: true, duration: 0.5});

    // Calculate movement heading and calibrate compass
    if (this._lastPosition) {
      const dist = this.geo.distance(this._lastPosition.lat, this._lastPosition.lng, pos.lat, pos.lng);
      if (dist > 2) { // Only update heading if moved more than 2 meters
        const heading = this._getMovementHeading(this._lastPosition.lat, this._lastPosition.lng, pos.lat, pos.lng);
        // Calibrate compass if we have compass data
        if (this._lastAlpha != null) {
          const alphaClockwise = (360 - this._lastAlpha) % 360;
          this._compassOffset = (heading - alphaClockwise + 360) % 360;
          // If not yet calibrated, switch from circle to arrow
          if (!this._isCalibrated) {
            this._isCalibrated = true;
            const iconContainer = document.getElementById('gps-player-icon');
            if (iconContainer) {
              iconContainer.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 20 20" style="filter:drop-shadow(0 0 4px #e94560);">
                  <path d="M10 2 L16 18 L10 14 L4 18 Z" fill="#e94560" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
                </svg>
              `;
            }
          }
        }
      }
    }
    this._lastPosition = { lat: pos.lat, lng: pos.lng };
  }

  _getMovementHeading(lat1, lng1, lat2, lng2) {
    // Calculate heading from movement direction (bearing between two GPS points)
    // 0=North, 90=East, 180=South, 270=West (clockwise)
    const toRad = Math.PI / 180;
    const lat1Rad = lat1 * toRad;
    const lat2Rad = lat2 * toRad;
    const diffLng = (lng2 - lng1) * toRad;

    const x = Math.sin(diffLng) * Math.cos(lat2Rad);
    const y = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(diffLng);

    let heading = Math.atan2(x, y) * (180 / Math.PI);
    if (heading < 0) heading += 360;

    return heading;
  }

  _setupOrientation() {
    // Guard: prevent duplicate listeners if already registered
    if (this._orientationListener) return;
    const iconContainer = document.getElementById('gps-player-icon');
    if (!iconContainer) return;
    // Check if deviceorientation is supported
    if (window.DeviceOrientationEvent) {
      this._orientationListener = (e) => {
        if (!this.active) return;
        if (e.alpha == null) return;
        this._lastAlpha = e.alpha;
        // If calibrated, apply compass rotation with offset
        if (this._compassOffset !== null) {
          const alphaClockwise = (360 - e.alpha) % 360;
          const heading = (alphaClockwise + this._compassOffset) % 360;
          if (iconContainer) {
            iconContainer.style.transform = `rotate(${heading}deg)`;
          }
        }
      };
      window.addEventListener('deviceorientation', this._orientationListener);
    }
  }

  _refreshEntityMarkers() {
    this._refreshItems();
    this._refreshNpcs();
  }

  _refreshItems() {
    const pos = this.geo.simulated.active ? this.geo.simulated : this.geo.current;
    const items = this.itemManager.getVisibleItems(pos);
    const currentIds = new Set(items.map(i => i.id));

    // Remove picked up or invisible
    for (const id in this.itemMarkers) {
      if (!currentIds.has(id)) {
        this.map.removeLayer(this.itemMarkers[id]);
        delete this.itemMarkers[id];
        if (this.itemRadiusCircles[id]) {
          this.map.removeLayer(this.itemRadiusCircles[id]);
          delete this.itemRadiusCircles[id];
        }
      }
    }

    // Add/update
    for (const item of items) {
      if (item.gps.lat == null || item.gps.lng == null) continue;
      const latlng = [item.gps.lat, item.gps.lng];
      if (this.itemMarkers[item.id]) {
        this.itemMarkers[item.id].setLatLng(latlng);
        if (this.itemRadiusCircles[item.id]) {
          this.itemRadiusCircles[item.id].setLatLng(latlng);
        }
      } else {
        const iconUrl = AssetResolver.itemIcon(item.icon, this.campaignId);
        const icon = L.icon({
          iconUrl: iconUrl,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16]
        });
        const marker = L.marker(latlng, {icon}).addTo(this.map);
        marker.bindPopup(`<b>${item.name}</b><br><em>Acércate para interactuar</em>`);
        marker.on('click', () => this._onEntityClick(item, 'item'));
        this.itemMarkers[item.id] = marker;

        const radius = item.gps.pickup_radius_meters || 5;
        const circle = L.circle(latlng, {
          radius: radius,
          color: '#2ecc71', fillColor: '#2ecc71', fillOpacity: 0.1, weight: 1
        }).addTo(this.map);
        this.itemRadiusCircles[item.id] = circle;
      }
    }
  }

  _refreshNpcs() {
    const npcs = this.npcManager.getVisibleNpcs();
    const currentIds = new Set(npcs.map(n => n.id));

    for (const id in this.npcMarkers) {
      if (!currentIds.has(id)) {
        this.map.removeLayer(this.npcMarkers[id]);
        delete this.npcMarkers[id];
        if (this.npcRadiusCircles[id]) {
          this.map.removeLayer(this.npcRadiusCircles[id]);
          delete this.npcRadiusCircles[id];
        }
      }
    }

    for (const npc of npcs) {
      if (npc.gps.lat == null || npc.gps.lng == null) continue;
      const latlng = [npc.gps.lat, npc.gps.lng];
      if (this.npcMarkers[npc.id]) {
        this.npcMarkers[npc.id].setLatLng(latlng);
        if (this.npcRadiusCircles[npc.id]) {
          this.npcRadiusCircles[npc.id].setLatLng(latlng);
        }
      } else {
        const iconUrl = AssetResolver.npcIcon(npc.icon || 'merchant', this.campaignId);
        const icon = L.icon({
          iconUrl: iconUrl,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16]
        });
        const marker = L.marker(latlng, {icon}).addTo(this.map);
        marker.bindPopup(`<b>${npc.name}</b><br>${npc.description || ''}<br><em>Acércate para interactuar</em>`);
        marker.on('click', () => this._onEntityClick(npc, 'npc'));
        this.npcMarkers[npc.id] = marker;

        const radius = npc.gps.interact_radius_meters || 30;
        const circle = L.circle(latlng, {
          radius: radius,
          color: '#9b59b6', fillColor: '#9b59b6', fillOpacity: 0.1, weight: 1
        }).addTo(this.map);
        this.npcRadiusCircles[npc.id] = circle;
      }
    }
  }

  _onEntityClick(entity, type) {
    const pos = this.geo.simulated.active ? this.geo.simulated : this.geo.current;
    if (pos.lat == null) { UIComponents.toast('Esperando GPS...'); return; }

    const itemsAt = this.itemManager.getItemsAt(pos.lat, pos.lng, 1000);
    const npcsAt = this.npcManager.getNpcsAt(pos.lat, pos.lng, 1000);

    if (itemsAt.length === 0 && npcsAt.length === 0) return;

    if (itemsAt.length + npcsAt.length === 1) {
      // Single entity: show confirmation
      if (type === 'item' && itemsAt.length === 1) {
        this._showPickupConfirm(entity);
      } else if (type === 'npc' && npcsAt.length === 1) {
        this._showInteractConfirm(entity);
      }
    } else {
      // Multiple: show list
      MultiPickup.show(itemsAt, npcsAt, pos.lat, pos.lng,
        (id) => this._showPickupConfirm(this.itemManager.items.find(i => i.id === id)),
        (id) => this._showInteractConfirm(this.npcManager.getVisibleNpcs().find(n => n.id === id))
      );
    }
  }

  _showPickupConfirm(item) {
    const pos = this.geo.simulated.active ? this.geo.simulated : this.geo.current;
    const inRange = this.itemManager.isInPickupRange(item, pos);
    if (!inRange) {
      const dist = this.itemManager.getDistanceText(item, pos);
      UIComponents.toast(`Demasiado lejos. ${dist}`);
      return;
    }
    const confirmed = confirm(`¿Recoger ${item.name}?\n\n${item.description || ''}`);
    if (confirmed) {
      this.itemManager.pickup(item.id);
      this._refreshItems();
      if (window.game) window.game._autoSave();
    }
  }

  _showInteractConfirm(npc) {
    const pos = this.geo.simulated.active ? this.geo.simulated : this.geo.current;
    const inRange = this.npcManager.isInInteractRange(npc, pos);
    if (!inRange) {
      UIComponents.toast('Demasiado lejos para hablar con ' + npc.name);
      return;
    }
    const confirmed = confirm(`¿Hablar con ${npc.name}?`);
    if (confirmed) {
      this.npcManager.interact(npc.id);
      if (window.game) window.game._autoSave();
    }
  }

  _addLocationMarkers(locations) {
    for (const loc of locations) {
      if (!loc.gps || loc.gps.lat == null || loc.gps.lng == null) continue;
      const latlng = [loc.gps.lat, loc.gps.lng];
      let markerOpts = {};
      if (loc.icon) {
        markerOpts.icon = L.icon({
          iconUrl: AssetResolver.locationIcon(loc.icon, this.campaignId),
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16]
        });
      }
      const marker = L.marker(latlng, markerOpts).addTo(this.map);
      const radius = L.circle(latlng, {
        radius: loc.gps.radius_meters || 30,
        color: loc.color || '#3498db',
        fillColor: loc.color || '#3498db',
        fillOpacity: 0.2,
        weight: 2
      }).addTo(this.map);

      // Create popup once, update content on each click
      const popup = L.popup();
      marker.bindPopup(popup);

      marker.on('click', () => {
        if (!window.game) return;
        const pos = this.geo.simulated.active ? this.geo.simulated : this.geo.current;
        if (pos.lat == null) {
          UIComponents.toast('Esperando GPS...');
          return;
        }
        const dist = this.geo.distance(pos.lat, pos.lng, loc.gps.lat, loc.gps.lng);
        const inRange = dist <= (loc.gps.radius_meters || 30);
        if (inRange) {
          window.game._doEnterLocation(loc);
          if (window.game) window.game._autoSave();
        } else {
          popup.setContent(`<b>${loc.name}</b><br>Estás a ${Math.round(dist)} metros.<br>Acércate para entrar.`);
          marker.openPopup();
        }
      });

      // Store location reference for visibility checks
      this.locationMarkers.push({ marker, radius, loc });
    }
    this._refreshLocationVisibility();
  }

  _refreshLocationVisibility() {
    for (const m of this.locationMarkers) {
      const visible = this._isLocationVisible(m.loc);
      if (visible) {
        if (!this.map.hasLayer(m.marker)) this.map.addLayer(m.marker);
        if (!this.map.hasLayer(m.radius)) this.map.addLayer(m.radius);
      } else {
        if (this.map.hasLayer(m.marker)) this.map.removeLayer(m.marker);
        if (this.map.hasLayer(m.radius)) this.map.removeLayer(m.radius);
      }
    }
  }

  _removeLocationMarkers() {
    for (const m of this.locationMarkers) {
      this.map.removeLayer(m.marker);
      this.map.removeLayer(m.radius);
    }
    this.locationMarkers = [];
  }

  _startTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (!this.active) return;
      this._updatePlayer();
      this._updateDistanceText();
      this._refreshEntityMarkers();
      this._refreshLocationVisibility();
    }, 1000);
  }

  _updateDistanceText() {
    const el = document.getElementById(this.isTest ? 'gps-distance-test' : 'gps-distance-normal');
    if (!el) return;

    const pos = this.geo.simulated.active ? this.geo.simulated : this.geo.current;
    if (pos.lat == null) {
      el.textContent = 'Obteniendo GPS...';
      return;
    }

    // Show distance to nearest location
    let nearest = null, nearestDist = Infinity;
    for (const loc of (this.campaign?.locations || [])) {
      if (!loc.gps) continue;
      const d = this.geo.distance(pos.lat, pos.lng, loc.gps.lat, loc.gps.lng);
      if (d < nearestDist) { nearestDist = d; nearest = loc; }
    }
    if (nearest) {
      const inRange = nearestDist <= (nearest.gps.radius_meters || 30);
      if (inRange) {
        el.innerHTML = `<span style="color:#2ecc71;font-weight:bold;">Dentro de ${nearest.name}</span>`;
      } else {
        el.textContent = `${nearest.name}: ${Math.round(nearestDist)}m`;
      }
    } else {
      el.textContent = 'Modo exploración';
    }
  }

  showNearby() {
    const pos = this.geo.simulated.active ? this.geo.simulated : this.geo.current;
    if (pos.lat == null) { UIComponents.toast('Esperando GPS...'); return; }

    // Only show items/NPCs that are ACTUALLY in range
    const itemsInRange = [];
    for (const item of this.itemManager.getVisibleItems()) {
      if (this.itemManager.isInPickupRange(item, pos)) itemsInRange.push(item);
    }
    const npcsInRange = [];
    for (const npc of this.npcManager.getVisibleNpcs()) {
      if (this.npcManager.isInInteractRange(npc, pos)) npcsInRange.push(npc);
    }

    if (itemsInRange.length === 0 && npcsInRange.length === 0) {
      UIComponents.toast('No hay nada interactuable cerca. Acércate más.');
      return;
    }

    if (itemsInRange.length + npcsInRange.length === 1) {
      if (itemsInRange.length === 1) this._showPickupConfirm(itemsInRange[0]);
      else this._showInteractConfirm(npcsInRange[0]);
    } else {
      MultiPickup.show(itemsInRange, npcsInRange, pos.lat, pos.lng,
        (id) => this._showPickupConfirm(this.itemManager.items.find(i => i.id === id)),
        (id) => this._showInteractConfirm(this.npcManager.getVisibleNpcs().find(n => n.id === id))
      );
    }
  }
}
