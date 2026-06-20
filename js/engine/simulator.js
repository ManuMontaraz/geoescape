// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Manuel Arjona Blanco <manuel@manumontaraz.es>

class LocationSimulator {
  constructor(geoManager, campaign, itemManager, npcManager) {
    this.geo = geoManager;
    this.campaign = campaign;
    this.itemManager = itemManager;
    this.npcManager = npcManager;
    this.map = null;
    this.playerMarker = null;
    this.playerCircle = null;
    this.locationLayers = {};
    this.itemMarkers = {};
    this.npcMarkers = {};
    this.itemRadiusCircles = {};
    this.npcRadiusCircles = {};
    this.direction = {x:0, y:0};
    this.active = false;
    this.speed = 5.0;
    this.lastFrameTime = 0;
    this.rafId = null;
    this._keysPressed = new Set();
    this._boundKeyDown = this._onKeyDown.bind(this);
    this._boundKeyUp = this._onKeyUp.bind(this);
    this._boundVisibility = this._onVisibility.bind(this);
    this._boundMapClick = this._onMapClick.bind(this);
    this.teleportMode = false;
    this.campaignId = null;
  }

  open(campaignId) {
    this.active = true;
    this.campaignId = campaignId;
    document.getElementById('simulator-panel').classList.remove('hidden');
    if (!this.map) this._initMap();
    this._updatePlayerFromGeo();
    this._refreshLocationVisibility();
    this._refreshEntityMarkers();
    this._updateDistanceText();
    this._setupControls();
    document.addEventListener('keydown', this._boundKeyDown);
    document.addEventListener('keyup', this._boundKeyUp);
    document.addEventListener('visibilitychange', this._boundVisibility);
    this._startLoop();
  }

  close() {
    this.active = false;
    this.teleportMode = false;
    const container = document.getElementById('simulator-map');
    if (container) container.style.cursor = '';
    document.getElementById('simulator-panel').classList.add('hidden');
    this._stopLoop();
    this.direction = {x:0, y:0};
    this._keysPressed.clear();
    document.removeEventListener('keydown', this._boundKeyDown);
    document.removeEventListener('keyup', this._boundKeyUp);
    document.removeEventListener('visibilitychange', this._boundVisibility);
  }

  _onVisibility() {
    if (document.hidden) {
      this._stopLoop();
      this.direction = {x:0, y:0};
      this._keysPressed.clear();
    } else if (this.active) {
      this._startLoop();
    }
  }

  _setupControls() {
    if (this._controlsBound) return;
    this._controlsBound = true;

    const setup = (id, dx, dy) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      const onDown = (e) => { e.preventDefault(); e.stopPropagation(); this._keysPressed.add(id); this._recalcDirection(); };
      const onUp = (e) => { e.preventDefault(); e.stopPropagation(); this._keysPressed.delete(id); this._recalcDirection(); };
      btn.addEventListener('mousedown', onDown);
      btn.addEventListener('mouseup', onUp);
      btn.addEventListener('mouseleave', onUp);
      btn.addEventListener('touchstart', onDown, {passive: false});
      btn.addEventListener('touchend', onUp, {passive: false});
      btn.addEventListener('touchcancel', onUp, {passive: false});
    };

    setup('sim-up', 0, 1);
    setup('sim-down', 0, -1);
    setup('sim-left', -1, 0);
    setup('sim-right', 1, 0);
  }

  _recalcDirection() {
    let dx = 0, dy = 0;
    if (this._keysPressed.has('sim-up')) dy += 1;
    if (this._keysPressed.has('sim-down')) dy -= 1;
    if (this._keysPressed.has('sim-left')) dx -= 1;
    if (this._keysPressed.has('sim-right')) dx += 1;
    this.direction = {x: dx, y: dy};
  }

  _onKeyDown(e) {
    if (!this.active) return;
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W': this._keysPressed.add('sim-up'); break;
      case 'ArrowDown': case 's': case 'S': this._keysPressed.add('sim-down'); break;
      case 'ArrowLeft': case 'a': case 'A': this._keysPressed.add('sim-left'); break;
      case 'ArrowRight': case 'd': case 'D': this._keysPressed.add('sim-right'); break;
      default: return;
    }
    e.preventDefault();
    this._recalcDirection();
  }

  _onKeyUp(e) {
    if (!this.active) return;
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W': this._keysPressed.delete('sim-up'); break;
      case 'ArrowDown': case 's': case 'S': this._keysPressed.delete('sim-down'); break;
      case 'ArrowLeft': case 'a': case 'A': this._keysPressed.delete('sim-left'); break;
      case 'ArrowRight': case 'd': case 'D': this._keysPressed.delete('sim-right'); break;
      default: return;
    }
    e.preventDefault();
    this._recalcDirection();
  }

  _startLoop() {
    if (this.rafId) return;
    this.lastFrameTime = performance.now();
    this.rafId = requestAnimationFrame((t) => this._loop(t));
  }

  _stopLoop() {
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
  }

  _loop(timestamp) {
    if (!this.active) return;
    const dt = (timestamp - this.lastFrameTime) / 1000;
    this.lastFrameTime = timestamp;
    if (dt > 0 && dt < 1) this._tick(dt);
    this.rafId = requestAnimationFrame((t) => this._loop(t));
  }

  _tick(dt) {
    if (!this.playerMarker) return;

    if (this.direction.x !== 0 || this.direction.y !== 0) {
      const dist = this.speed * dt;
      const ll = this.playerMarker.getLatLng();
      const latDelta = (this.direction.y * dist) / 111320;
      const lngDelta = (this.direction.x * dist) / (111320 * Math.cos(ll.lat * Math.PI / 180));

      const newLat = ll.lat + latDelta;
      const newLng = ll.lng + lngDelta;
      const newLatLng = [newLat, newLng];

      this.playerMarker.setLatLng(newLatLng);
      this.playerCircle.setLatLng(newLatLng);
      this.map.panTo(newLatLng, {animate: false});
      this.geo.simulate(newLat, newLng);
    }

    // Always refresh entities and visibility even when stationary
    this._updateDistanceText();
    this._refreshEntityMarkers();
    this._refreshLocationVisibility();
  }

  _initMap() {
    const container = document.getElementById('simulator-map');
    let center = [40.4169, -3.7035];
    if (this.campaign.origin) {
      center = [this.campaign.origin.lat, this.campaign.origin.lng];
    } else {
      const locsWithGPS = this.campaign.locations.filter(l => l.gps && l.gps.lat != null && l.gps.lng != null);
      if (locsWithGPS.length > 0) {
        center = [locsWithGPS[0].gps.lat, locsWithGPS[0].gps.lng];
      }
    }

    this.map = L.map(container).setView(center, 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    for (const loc of this.campaign.locations) {
      this._drawLocation(loc);
    }
    this._refreshLocationVisibility();

    // Player marker: start at current geo/simulated position if available, else at origin
    const pos = this.geo.simulated.active ? this.geo.simulated : this.geo.current;
    const playerLatLng = pos.lat != null ? [pos.lat, pos.lng] : center;

    const playerIcon = L.divIcon({
      className: 'sim-player-marker',
      html: '<div style="width:16px;height:16px;background:#e94560;border:2px solid #fff;border-radius:50%;"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    this.playerMarker = L.marker(playerLatLng, {icon: playerIcon, zIndexOffset: 1000}).addTo(this.map);
    this.playerCircle = L.circle(playerLatLng, {
      radius: 5, color: '#e94560', fillColor: '#e94560', fillOpacity: 0.3, weight: 1
    }).addTo(this.map);

    this._refreshEntityMarkers();
    this.map.on('click', this._boundMapClick);
  }

  enableTeleport() {
    this.teleportMode = true;
    const container = document.getElementById('simulator-map');
    if (container) container.style.cursor = 'crosshair';
    UIComponents.toast('Click en el mapa para teletransportarte');
  }

  disableTeleport() {
    this.teleportMode = false;
    const container = document.getElementById('simulator-map');
    if (container) container.style.cursor = '';
  }

  _onMapClick(e) {
    if (!this.teleportMode) return;
    this.teleportMode = false;
    const container = document.getElementById('simulator-map');
    if (container) container.style.cursor = '';

    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    const latlng = [lat, lng];

    this.playerMarker.setLatLng(latlng);
    this.playerCircle.setLatLng(latlng);
    this.map.panTo(latlng, {animate: false});

    this.geo.simulate(lat, lng);
    this._updateDistanceText();
    this._refreshEntityMarkers();
    this._refreshLocationVisibility();
    UIComponents.toast(`Teletransportado a ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
  }

  _drawLocation(loc) {
    const group = L.layerGroup().addTo(this.map);
    let center = null;
    if (loc.gps && loc.gps.lat != null && loc.gps.lng != null) {
      center = [loc.gps.lat, loc.gps.lng];
      L.circle(center, {
        radius: loc.gps.radius_meters || 20,
        color: '#3498db', fillColor: '#3498db', fillOpacity: 0.15, weight: 2
      }).addTo(group);
    } else {
      center = this.map.getCenter();
    }
    let markerOpts = {};
    if (loc.icon) {
      markerOpts.icon = L.icon({
        iconUrl: AssetResolver.locationIcon(loc.icon, this.campaignId),
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
      });
    }
    const marker = L.marker(center, markerOpts).addTo(group);
    marker.bindPopup(this._buildPopup(loc));
    this.locationLayers[loc.id] = {group, marker, center};
  }

  _buildPopup(loc) {
    let html = `<b>${loc.name}</b>`;
    if (loc.gps) html += `<br>Radio: ${loc.gps.radius_meters}m`;
    if (loc.clickable_areas?.length) html += `<br>Objetos: ${loc.clickable_areas.map(a=>a.id).join(', ')}`;
    if (loc.npc_instances?.length) {
      const npcNames = loc.npc_instances.map(inst => {
        const g = this.campaign.npcs?.find(x => x.id === inst.ref);
        return g ? g.name : inst.ref;
      });
      html += `<br>NPCs: ${npcNames.join(', ')}`;
    }
    return html;
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

  _refreshLocationVisibility() {
    for (const [id, layer] of Object.entries(this.locationLayers)) {
      const loc = this.campaign.locations.find(l => l.id === id);
      if (!loc) continue;
      const visible = this._isLocationVisible(loc);
      if (visible) {
        if (!this.map.hasLayer(layer.group)) this.map.addLayer(layer.group);
      } else {
        if (this.map.hasLayer(layer.group)) this.map.removeLayer(layer.group);
      }
    }
  }

  _refreshEntityMarkers() {
    // Items
    const pos = this.geo.simulated.active ? this.geo.simulated : this.geo.current;
    const items = this.itemManager.getVisibleItems(pos);
    const currentItemIds = new Set(items.map(i => i.id));
    for (const id in this.itemMarkers) {
      if (!currentItemIds.has(id)) { 
        this.map.removeLayer(this.itemMarkers[id]); delete this.itemMarkers[id]; 
        if (this.itemRadiusCircles[id]) { this.map.removeLayer(this.itemRadiusCircles[id]); delete this.itemRadiusCircles[id]; }
      }
    }
    for (const item of items) {
      if (item.gps.lat == null || item.gps.lng == null) continue;
      const latlng = [item.gps.lat, item.gps.lng];
      if (this.itemMarkers[item.id]) {
        this.itemMarkers[item.id].setLatLng(latlng);
        if (this.itemRadiusCircles[item.id]) this.itemRadiusCircles[item.id].setLatLng(latlng);
      } else {
        const icon = L.icon({ iconUrl: AssetResolver.itemIcon(item.icon, this.campaignId), iconSize: [32,32], iconAnchor: [16,16], popupAnchor: [0,-16] });
        const m = L.marker(latlng, {icon}).addTo(this.map);
        m.bindPopup(`<b>${item.name}</b>`);
        m.on('click', () => this._onEntityClick(item, 'item'));
        this.itemMarkers[item.id] = m;

        const radius = item.gps.pickup_radius_meters || 5;
        const circle = L.circle(latlng, {
          radius: radius,
          color: '#2ecc71', fillColor: '#2ecc71', fillOpacity: 0.1, weight: 1
        }).addTo(this.map);
        this.itemRadiusCircles[item.id] = circle;
      }
    }

    // NPCs
    const npcs = this.npcManager.getVisibleNpcs();
    const currentNpcIds = new Set(npcs.map(n => n.id));
    for (const id in this.npcMarkers) {
      if (!currentNpcIds.has(id)) { 
        this.map.removeLayer(this.npcMarkers[id]); delete this.npcMarkers[id]; 
        if (this.npcRadiusCircles[id]) { this.map.removeLayer(this.npcRadiusCircles[id]); delete this.npcRadiusCircles[id]; }
      }
    }
    for (const npc of npcs) {
      if (npc.gps.lat == null || npc.gps.lng == null) continue;
      const latlng = [npc.gps.lat, npc.gps.lng];
      if (this.npcMarkers[npc.id]) {
        this.npcMarkers[npc.id].setLatLng(latlng);
        if (this.npcRadiusCircles[npc.id]) this.npcRadiusCircles[npc.id].setLatLng(latlng);
      } else {
        const icon = L.icon({ iconUrl: AssetResolver.npcIcon(npc.icon || 'merchant', this.campaignId), iconSize: [32,32], iconAnchor: [16,16], popupAnchor: [0,-16] });
        const m = L.marker(latlng, {icon}).addTo(this.map);
        m.bindPopup(`<b>${npc.name}</b><br>${npc.description || ''}`);
        m.on('click', () => this._onEntityClick(npc, 'npc'));
        this.npcMarkers[npc.id] = m;

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
      if (type === 'item' && itemsAt.length === 1) this._showPickupConfirm(entity);
      else if (type === 'npc' && npcsAt.length === 1) this._showInteractConfirm(entity);
    } else {
      MultiPickup.show(itemsAt, npcsAt, pos.lat, pos.lng,
        (id) => this._showPickupConfirm(this.itemManager.items.find(i => i.id === id)),
        (id) => this._showInteractConfirm(this.npcManager.getVisibleNpcs().find(n => n.id === id))
      );
    }
  }

  _showPickupConfirm(item) {
    const pos = this.geo.simulated.active ? this.geo.simulated : this.geo.current;
    if (!this.itemManager.isInPickupRange(item, pos)) {
      const dist = this.itemManager.getDistanceText(item, pos);
      UIComponents.toast(`Demasiado lejos. ${dist}`);
      return;
    }
    if (confirm(`¿Recoger ${item.name}?\n\n${item.description || ''}`)) {
      this.itemManager.pickup(item.id);
      this._refreshEntityMarkers();
    }
  }

  _showInteractConfirm(npc) {
    const pos = this.geo.simulated.active ? this.geo.simulated : this.geo.current;
    if (!this.npcManager.isInInteractRange(npc, pos)) {
      UIComponents.toast('Demasiado lejos para hablar con ' + npc.name);
      return;
    }
    if (confirm(`¿Hablar con ${npc.name}?`)) {
      this.npcManager.interact(npc.id);
    }
  }

  _updatePlayerFromGeo() {
    const pos = this.geo.simulated.active ? this.geo.simulated : this.geo.current;
    if (pos.lat != null && this.playerMarker) {
      const latlng = [pos.lat, pos.lng];
      this.playerMarker.setLatLng(latlng);
      this.playerCircle.setLatLng(latlng);
      this.map.panTo(latlng);
    }
  }

  _updateDistanceText() {
    const el = document.getElementById('sim-dist-text');
    const enterBtn = document.getElementById('sim-btn-enter');
    if (!el) return;
    const pos = this.geo.simulated.active ? this.geo.simulated : this.geo.current;
    if (pos.lat == null) {
      el.textContent = '';
      if (enterBtn) enterBtn.style.display = 'none';
      return;
    }

    // Show distance to nearest VISIBLE location
    let nearest = null, nearestDist = Infinity;
    for (const loc of this.campaign.locations) {
      if (!loc.gps || !this._isLocationVisible(loc)) continue;
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
      if (enterBtn) enterBtn.style.display = inRange ? '' : 'none';
    } else {
      el.textContent = 'Modo libre';
      if (enterBtn) enterBtn.style.display = 'none';
    }
  }

  applyAndEnter() {
    const pos = this.geo.simulated.active ? this.geo.simulated : this.geo.current;
    if (pos.lat == null) {
      UIComponents.toast('Esperando posición...');
      return;
    }
    // Find nearest VISIBLE location in range
    let nearest = null, nearestDist = Infinity;
    for (const loc of this.campaign.locations) {
      if (!loc.gps || !this._isLocationVisible(loc)) continue;
      const d = this.geo.distance(pos.lat, pos.lng, loc.gps.lat, loc.gps.lng);
      if (d < nearestDist) { nearestDist = d; nearest = loc; }
    }
    if (nearest && nearestDist <= (nearest.gps.radius_meters || 30)) {
      window.game._doEnterLocation(nearest);
      if (window.game) window.game._autoSave();
      this.close();
    } else {
      UIComponents.toast('No estás dentro del rango de ninguna ubicación');
    }
  }
}
