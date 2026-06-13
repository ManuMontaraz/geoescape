class CampaignEditor {
  constructor() {
    this.campaign = null;
    this.selectedLocId = null;
    this.selectedItemId = null;
    this.selectedNpcId = null;
    this.selectedEventId = null;
    this.currentPanel = 'locations';
    this.map = null;
    this.markers = {};
    this.circles = {};
    this.itemMarkers = {};
    this.npcMarkers = {};
    this.itemCircles = {};
    this.itemVisCircles = {};
    this.npcCircles = {};
    this.originMarker = null;
    // Scene canvas state
    this._sceneCanvas = null;
    this._sceneCtx = null;
    this._selectedSceneElement = null;
    this._mode = null; // 'drag' | 'resize'
    this._dragStart = null;
    this._resizeHandle = null;
    this._itemIconCache = {}; // Cache for SVG item icons in scene canvas
    this._decorIconCache = {}; // Cache for SVG decor icons in scene canvas
    this._npcIconCache = {}; // Cache for NPC sprites in scene canvas
    this._cryptexEditorPositions = null; // Editor positions for cryptex minigame
    this.initMap();
    
    // Try to load saved campaign from localStorage (e.g., after testing)
    const savedJson = localStorage.getItem('ge_campaign_json');
    if (savedJson) {
      try {
        this.campaign = JSON.parse(savedJson);
        this._afterLoad();
        return;
      } catch (e) {
        console.error('Error loading saved campaign:', e);
      }
    }
    this.newCampaign();
  }

  _afterLoad() {
    // Update origin marker position
    if (this.campaign.origin) {
      this.originMarker.setLatLng([this.campaign.origin.lat, this.campaign.origin.lng]);
    }
    // Refresh all markers using existing methods
    this.campaign.locations.forEach(loc => this.updateLocationMarker(loc));
    this.campaign.items.forEach(item => this.updateItemMarker(item));
    this.campaign.npcs.forEach(npc => this.updateNpcMarker(npc));
    this.renderSidebar();
  }

  // ═══════════════════════════════════════════════════════════════
  //  MAP & GPS HELPERS
  // ═══════════════════════════════════════════════════════════════

  initMap() {
    this.map = L.map('editor-map').setView([40.4168, -3.7038], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    // Origin marker for relative coordinates
    const originIcon = L.divIcon({
      className: 'origin-marker',
      html: '<div style="width:20px;height:20px;background:rgba(255,215,0,0.8);border:3px solid #fff;border-radius:50%;box-shadow:0 0 10px rgba(255,215,0,0.6);display:flex;align-items:center;justify-content:center;font-size:12px;">★</div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    this.originMarker = L.marker([40.4168, -3.7038], { icon: originIcon, draggable: true, zIndexOffset: 2000 }).addTo(this.map);
    this.originMarker.bindPopup('<b>📍 Origen de coordenadas relativas</b><br>Arrastra para mover el punto central.');
    this.originMarker.on('dragend', () => {
      // Update all preview markers when origin moves
      this.campaign.locations.forEach(loc => this.updateLocationMarker(loc));
      this.campaign.items.forEach(item => this.updateItemMarker(item));
      (this.campaign.npcs || []).forEach(npc => this.updateNpcMarker(npc));
      if (this.campaign.origin) {
        const pos = this.originMarker.getLatLng();
        this.campaign.origin.lat = parseFloat(pos.lat.toFixed(6));
        this.campaign.origin.lng = parseFloat(pos.lng.toFixed(6));
      }
    });

    this.map.on('click', (e) => {
      if (this.currentPanel === 'locations' && this.selectedLocId) {
        const loc = this.campaign.locations.find(l => l.id === this.selectedLocId);
        if (loc && loc.gps) {
          if (loc.gps.type === 'absolute') {
            loc.gps.lat = parseFloat(e.latlng.lat.toFixed(6));
            loc.gps.lng = parseFloat(e.latlng.lng.toFixed(6));
          } else if (loc.gps.type === 'relative') {
            const origin = this._getOrigin();
            const bd = this._calcBearingDistance(origin, e.latlng);
            loc.gps.bearing_degrees = Math.round(bd.bearing);
            loc.gps.distance_meters = Math.round(bd.distance);
          }
          this.updateLocationMarker(loc);
          this.renderForm();
        }
      } else if (this.currentPanel === 'items' && this.selectedItemId) {
        const item = this.campaign.items.find(i => i.id === this.selectedItemId);
        if (item && item.gps) {
          if (item.gps.type === 'absolute') {
            item.gps.lat = parseFloat(e.latlng.lat.toFixed(6));
            item.gps.lng = parseFloat(e.latlng.lng.toFixed(6));
          } else if (item.gps.type === 'relative') {
            const origin = this._getOrigin();
            const bd = this._calcBearingDistance(origin, e.latlng);
            item.gps.bearing_degrees = Math.round(bd.bearing);
            item.gps.distance_meters = Math.round(bd.distance);
          }
          this.updateItemMarker(item);
          this.renderForm();
        }
      } else if (this.currentPanel === 'npcs' && this.selectedNpcId) {
        const npc = (this.campaign.npcs || []).find(n => n.id === this.selectedNpcId);
        if (npc && npc.gps && npc.gps.type) {
          if (npc.gps.type === 'absolute') {
            npc.gps.lat = parseFloat(e.latlng.lat.toFixed(6));
            npc.gps.lng = parseFloat(e.latlng.lng.toFixed(6));
          } else {
            const origin = this._getOrigin();
            const bd = this._calcBearingDistance(origin, e.latlng);
            npc.gps.bearing_degrees = Math.round(bd.bearing);
            npc.gps.distance_meters = Math.round(bd.distance);
          }
          this.updateNpcMarker(npc);
          this.renderForm();
        }
      }
    });
  }

  _getOrigin() {
    if (this.originMarker) {
      const ll = this.originMarker.getLatLng();
      return { lat: ll.lat, lng: ll.lng };
    }
    return { lat: 40.4168, lng: -3.7038 };
  }

  _getPreviewLatLng(entity) {
    if (!entity || !entity.gps) return null;
    if (entity.gps.type === 'absolute') {
      if (entity.gps.lat == null || entity.gps.lng == null) return null;
      return { lat: entity.gps.lat, lng: entity.gps.lng };
    }
    if (entity.gps.type === 'relative') {
      const origin = this._getOrigin();
      return this._calcAbsoluteFromRelative(
        origin.lat, origin.lng,
        entity.gps.bearing_degrees || 0,
        entity.gps.distance_meters || 0
      );
    }
    return null;
  }

  _calcAbsoluteFromRelative(lat, lng, bearingDeg, distanceM) {
    const R = 6371000;
    const toRad = d => d * Math.PI / 180;
    const toDeg = r => r * 180 / Math.PI;
    const d = distanceM / R;
    const br = toRad(bearingDeg);
    const lat1 = toRad(lat);
    const lng1 = toRad(lng);
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(br));
    const lng2 = lng1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    return { lat: parseFloat(toDeg(lat2).toFixed(6)), lng: parseFloat(toDeg(lng2).toFixed(6)) };
  }

  _calcBearingDistance(from, to) {
    const R = 6371000;
    const toRad = d => d * Math.PI / 180;
    const toDeg = r => r * 180 / Math.PI;
    const dLat = toRad(to.lat - from.lat);
    const dLng = toRad(to.lng - from.lng);
    const lat1 = toRad(from.lat);
    const lat2 = toRad(to.lat);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
    return { bearing, distance };
  }

  // ═══════════════════════════════════════════════════════════════
  //  CAMPAIGN LIFECYCLE
  // ═══════════════════════════════════════════════════════════════

  newCampaign() {
    this.campaign = {
      schema_version: '1.0',
      campaign_id: 'nueva_campana_' + Date.now(),
      metadata: {
        title: 'Nueva Campaña',
        description: 'Descripción de tu campaña',
        author: window._currentUsername || 'Anónimo',
        version: '1.0.0',
        language: 'es',
        difficulty: 'medium',
        estimated_minutes: 60,
        tags: [],
        starting_location_id: ''
      },
      global_vars: {},
      inventory_rules: { max_slots: 6, combinations: [] },
      locations: [],
      items: [],
      npcs: [],
      events: [],
      origin: { lat: 40.4168, lng: -3.7038 }
    };
    this.selectedLocId = null;
    this.selectedItemId = null;
    this.selectedNpcId = null;
    this.selectedEventId = null;
    this._selectedSceneElement = null;
    this.clearMap();
    this.renderSidebar();
    this.renderEmptyForm();
  }

  importFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.locations || !Array.isArray(data.locations)) data.locations = [];
        this.campaign = data;
        if (!this.campaign.origin) {
          this.campaign.origin = { lat: 40.4168, lng: -3.7038 };
        }
        this.campaign.metadata.author = window._currentUsername || this.campaign.metadata.author || 'Anónimo';
        if (this.originMarker) {
          this.originMarker.setLatLng([this.campaign.origin.lat, this.campaign.origin.lng]);
        }
        // Migrate old schema: locations[].npcs -> npc_instances
        for (const loc of this.campaign.locations || []) {
          if (loc.npcs && !loc.npc_instances) {
            loc.npc_instances = loc.npcs.map(n => ({
              ref: n.id,
              position: n.position || { x: 100, y: 100 },
              scale: 1.0,
              on_click: n.on_click
            }));
            delete loc.npcs;
          }
          // Migrate old npc_instances without scale
          if (loc.npc_instances) {
            for (const inst of loc.npc_instances) {
              if (inst.scale === undefined) inst.scale = 1.0;
            }
          }
        }
        this.selectedLocId = null;
        this.selectedItemId = null;
        this.selectedNpcId = null;
        this.selectedEventId = null;
        this._selectedSceneElement = null;
        this.clearMap();
        this.campaign.locations.forEach(loc => this.updateLocationMarker(loc));
        this.campaign.items.forEach(item => this.updateItemMarker(item));
        (this.campaign.npcs || []).forEach(npc => this.updateNpcMarker(npc));
        this.renderSidebar();
        this.renderEmptyForm();
      } catch (err) {
        alert('Error importando: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  exportJSON() {
    const blob = new Blob([JSON.stringify(this.campaign, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (this.campaign.campaign_id || 'campana') + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  testCampaign() {
    if (confirm('¿Guardar cambios antes de probar?')) {
      this.saveForm();
    }
    localStorage.setItem('ge_campaign_json', JSON.stringify(this.campaign));
    localStorage.setItem('ge_current_campaign', 'editor_test');
    localStorage.setItem('ge_saved_campaign', this.campaign.campaign_id);
    window.location.href = 'game.html?test=1';
  }

  // ═══════════════════════════════════════════════════════════════
  //  CLOUD / CAMPAIGN SHARING
  // ═══════════════════════════════════════════════════════════════

  _hasFinishCampaign(campaign) {
    const str = JSON.stringify(campaign);
    return str.includes('"type":"finish_campaign"');
  }

  _generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async uploadCampaign() {
    this.saveConfigForm();
    if (!this._hasFinishCampaign(this.campaign)) {
      alert('❌ No puedes subir una campaña sin final. Añade una acción "Terminar campaña" en algún lugar (por ejemplo, al usar un item, al entrar a una ubicación, al interactuar con un decorativo o NPC).');
      return;
    }
    // Ensure campaign has a UUID as its ID
    if (!this.campaign.campaign_id || !this.campaign.campaign_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      this.campaign.campaign_id = this._generateUUID();
      const el = document.getElementById('form_campaign_id');
      if (el) el.value = this.campaign.campaign_id;
    }
    try {
      const res = await fetch('api/campaigns/save.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          campaign_id: this.campaign.campaign_id,
          title: this.campaign.metadata.title,
          description: this.campaign.metadata.description || '',
          campaign_json: JSON.stringify(this.campaign),
          gps_type: this.campaign.gps_type || 'relative',
          is_public: this.campaign.is_public || false,
          origin_lat: this.campaign.origin?.lat || null,
          origin_lng: this.campaign.origin?.lng || null
        })
      });
      const data = await res.json();
      if (data.success) {
        // Guardar JSON actualizado
        localStorage.setItem('ge_campaign_json', JSON.stringify(this.campaign));
        localStorage.setItem('ge_cloud_uuid', this.campaign.campaign_id);
        alert(`☁️ Campaña subida correctamente.\nUUID: ${this.campaign.campaign_id}`);
      } else {
        alert('❌ Error al subir: ' + (data.error || 'Error desconocido'));
      }
    } catch (e) {
      alert('❌ Error de red: ' + e.message);
    }
  }

  async showMyCampaigns() {
    const modal = document.getElementById('cloud-modal');
    const content = document.getElementById('cloud-modal-content');
    const title = document.getElementById('cloud-modal-title');
    title.textContent = '📥 Mis Campañas en la Nube';
    content.innerHTML = '<p style="color:var(--text-muted);">Cargando...</p>';
    modal.style.display = 'flex';
    try {
      const res = await fetch('api/campaigns/list-mine.php', { credentials: 'same-origin' });
      const data = await res.json();
      if (!data.success) {
        content.innerHTML = `<p style="color:#e74c3c;">Error: ${data.error || 'No autenticado'}</p>`;
        return;
      }
      if (data.campaigns.length === 0) {
        content.innerHTML = '<p style="color:var(--text-muted);">No tienes campañas subidas. ¡Crea una y súbela! ☁️</p>';
        return;
      }
      let html = '<div style="display:flex;flex-direction:column;gap:0.8rem;">';
      for (const c of data.campaigns) {
        const isPublic = c.is_public ? '🌐 Pública' : '🔒 Privada';
        html += `
          <div style="border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:0.8rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong>${this._esc(c.title || c.campaign_id)}</strong>
              <span style="font-size:0.8rem;color:var(--text-muted);">${isPublic}</span>
            </div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin:0.3rem 0;">
              ID: ${this._esc(c.campaign_id)} | Autor: ${this._esc(c.author || 'Anónimo')} | Votos: ${c.vote_count || 0} | ${this._esc(c.gps_type)}
            </div>
            <div style="display:flex;gap:0.5rem;margin-top:0.5rem;">
              <button class="btn btn-sm btn-primary" onclick="editor.loadCloudCampaign('${this._esc(c.uuid)}')">📂 Cargar</button>
              <button class="btn btn-sm btn-secondary" onclick="editor.downloadCloudCampaign('${this._esc(c.uuid)}')">⬇️ Descargar</button>
              <button class="btn btn-sm btn-secondary" onclick="editor.copyInviteLink('${this._esc(c.uuid)}')">📋 Copiar enlace</button>
              <button class="btn btn-sm btn-danger" onclick="editor.deleteCloudCampaign('${this._esc(c.uuid)}')">🗑️ Eliminar</button>
            </div>
          </div>
        `;
      }
      html += '</div>';
      content.innerHTML = html;
    } catch (e) {
      content.innerHTML = `<p style="color:#e74c3c;">Error: ${e.message}</p>`;
    }
  }

  async loadCloudCampaign(uuid) {
    if (!confirm('⚠️ Cargar esta campaña sobrescribirá la actual. ¿Continuar?')) return;
    try {
      const res = await fetch(`api/campaigns/load.php?uuid=${encodeURIComponent(uuid)}`, { credentials: 'same-origin' });
      const data = await res.json();
      if (!data.success) {
        alert('❌ ' + (data.error || 'Error al cargar'));
        return;
      }
      this.campaign = JSON.parse(data.campaign.campaign_json);
      // Reemplazar campaign_id con el UUID de la BD
      this.campaign.campaign_id = uuid;
      // Actualizar autor con el username de la sesión
      this.campaign.metadata.author = window._currentUsername || this.campaign.metadata.author || 'Anónimo';
      const el = document.getElementById('form_campaign_id');
      if (el) el.value = uuid;
      localStorage.setItem('ge_campaign_json', JSON.stringify(this.campaign));
      localStorage.setItem('ge_cloud_uuid', uuid);
      localStorage.setItem('ge_campaign_is_public', data.campaign.is_public ? '1' : '0');
      this.clearMap();
      this._afterLoad();
      document.getElementById('cloud-modal').style.display = 'none';
      alert('✅ Campaña cargada desde la nube');
    } catch (e) {
      alert('❌ Error: ' + e.message);
    }
  }

  async downloadCloudCampaign(uuid) {
    try {
      const res = await fetch(`api/campaigns/load.php?uuid=${encodeURIComponent(uuid)}`, { credentials: 'same-origin' });
      const data = await res.json();
      if (!data.success) {
        alert('❌ ' + (data.error || 'Error al descargar'));
        return;
      }
      const campaign = JSON.parse(data.campaign.campaign_json);
      const blob = new Blob([JSON.stringify(campaign, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (campaign.campaign_id || 'campana') + '.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('❌ Error: ' + e.message);
    }
  }

  async copyInviteLink(uuid) {
    const url = `${window.location.origin}/play.html?uuid=${encodeURIComponent(uuid)}`;
    try {
      await navigator.clipboard.writeText(url);
      if (typeof UIComponents !== 'undefined') {
        UIComponents.toast('📋 Enlace copiado al portapapeles');
      } else {
        alert('📋 Enlace copiado: ' + url);
      }
    } catch (e) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      if (typeof UIComponents !== 'undefined') {
        UIComponents.toast('📋 Enlace copiado al portapapeles');
      } else {
        alert('📋 Enlace copiado: ' + url);
      }
    }
  }

  async deleteCloudCampaign(uuid) {
    if (!confirm('🗑️ ¿Eliminar esta campaña de la nube? No se puede deshacer.')) return;
    try {
      const res = await fetch('api/campaigns/delete.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ uuid })
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ Campaña eliminada');
        this.showMyCampaigns();
      } else {
        alert('❌ ' + (data.error || 'Error al eliminar'));
      }
    } catch (e) {
      alert('❌ Error: ' + e.message);
    }
  }

  forkCampaign() {
    const newId = this._generateUUID();
    const oldId = this.campaign.campaign_id;
    const newCampaign = JSON.parse(JSON.stringify(this.campaign));
    newCampaign.campaign_id = newId;
    newCampaign.metadata.title = (newCampaign.metadata.title || 'Sin título') + ' (fork)';
    newCampaign.metadata.author = window._currentUsername || newCampaign.metadata.author || 'Anónimo';
    newCampaign.metadata.version = '1.0.0';
    // Update all references from oldId to newId in locations/items/npcs/events
    const str = JSON.stringify(newCampaign);
    const regex = new RegExp(oldId, 'g');
    const fixedStr = str.replace(regex, newId);
    this.campaign = JSON.parse(fixedStr);
    this.clearMap();
    this._afterLoad();
    alert(`🍴 Campaña copiada. Nuevo ID: ${newId}`);
  }

  // ═══════════════════════════════════════════════════════════════
  //  PANEL NAVIGATION
  // ═══════════════════════════════════════════════════════════════

  setPanel(panel) {
    this.currentPanel = panel;
    this.selectedLocId = null;
    this.selectedItemId = null;
    this.selectedNpcId = null;
    this.selectedEventId = null;
    this._selectedSceneElement = null;
    this._mode = null;
    document.querySelectorAll('.editor-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.panel === panel);
    });
    const titleMap = { locations: 'Ubicaciones', items: 'Items', npcs: 'NPCs', events: 'Eventos', config: 'Config' };
    const addMap = { locations: 'addLocation', items: 'addItem', npcs: 'addNpc', events: 'addEvent', config: '' };
    document.getElementById('sidebar-title').textContent = titleMap[panel];
    const addBtn = document.getElementById('sidebar-add-btn');
    if (panel === 'config') {
      addBtn.style.display = 'none';
    } else {
      addBtn.style.display = '';
      addBtn.onclick = () => this[addMap[panel]]();
      addBtn.textContent = '+ Añadir';
    }
    this.renderSidebar();
    this.renderEmptyForm();
  }

  // ═══════════════════════════════════════════════════════════════
  //  SIDEBAR RENDERING
  // ═══════════════════════════════════════════════════════════════

  renderSidebar() {
    const container = document.getElementById('loc-list');
    container.innerHTML = '';
    if (this.currentPanel === 'locations') {
      for (const loc of this.campaign.locations) {
        const div = document.createElement('div');
        div.className = 'loc-item' + (loc.id === this.selectedLocId ? ' active' : '');
        div.innerHTML = `<div><strong>${this._esc(loc.name)}</strong><br><small>${this._esc(loc.id)}</small></div><button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); editor.deleteLocation('${this._esc(loc.id)}')">🗑</button>`;
        div.onclick = () => this.selectLocation(loc.id);
        container.appendChild(div);
      }
    } else if (this.currentPanel === 'items') {
      for (const item of this.campaign.items) {
        const div = document.createElement('div');
        div.className = 'loc-item' + (item.id === this.selectedItemId ? ' active' : '');
        div.innerHTML = `<div><strong>${this._esc(item.name)}</strong><br><small>${this._esc(item.id)}</small></div><button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); editor.deleteItem('${this._esc(item.id)}')">🗑</button>`;
        div.onclick = () => this.selectItem(item.id);
        container.appendChild(div);
      }
    } else if (this.currentPanel === 'npcs') {
      for (const npc of this.campaign.npcs || []) {
        const div = document.createElement('div');
        div.className = 'loc-item' + (npc.id === this.selectedNpcId ? ' active' : '');
        div.innerHTML = `<div><strong>${this._esc(npc.name)}</strong><br><small>${this._esc(npc.id)}</small></div><button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); editor.deleteNpc('${this._esc(npc.id)}')">🗑</button>`;
        div.onclick = () => this.selectNpc(npc.id);
        container.appendChild(div);
      }
    } else if (this.currentPanel === 'events') {
      for (const evt of this.campaign.events || []) {
        const div = document.createElement('div');
        div.className = 'loc-item' + (evt.id === this.selectedEventId ? ' active' : '');
        div.innerHTML = `<div><strong>${this._esc(evt.id)}</strong></div><button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); editor.deleteEvent('${this._esc(evt.id)}')">🗑</button>`;
        div.onclick = () => this.selectEvent(evt.id);
        container.appendChild(div);
      }
    } else if (this.currentPanel === 'config') {
      const div = document.createElement('div');
      div.style.padding = '1rem';
      div.style.color = 'var(--text-muted)';
      div.style.fontSize = '0.85rem';
      div.innerHTML = 'Edita los metadatos de la campaña en el panel derecho.';
      container.appendChild(div);
      this.renderForm();
      return;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  CRUD: LOCATIONS
  // ═══════════════════════════════════════════════════════════════

  addLocation() {
    const center = this.map.getCenter();
    const id = 'loc_' + (this.campaign.locations.length + 1);
    const loc = {
      id,
      name: 'Nueva Ubicación',
      description: '',
      color: '#2c3e50',
      icon: 'casa_madera',
      gps: {
        type: 'relative',
        bearing_degrees: 0,
        distance_meters: 50,
        radius_meters: 30
      },
      on_enter: [{ type: 'text', value: 'Entras a ' + id }],
      clickable_areas: [],
      npc_instances: [],
      exits: []
    };
    this.campaign.locations.push(loc);
    this.selectLocation(id);
    this.updateLocationMarker(loc);
  }

  deleteLocation(id) {
    if (!confirm('¿Borrar esta ubicación?')) return;
    this.campaign.locations = this.campaign.locations.filter(l => l.id !== id);
    if (this.selectedLocId === id) {
      this.selectedLocId = null;
      this._selectedSceneElement = null;
      this.renderEmptyForm();
    }
    this.removeLocationMarker(id);
    this.renderSidebar();
  }

  selectLocation(id) {
    this.selectedLocId = id;
    this.renderSidebar();
    this.renderForm();
    if (window.innerWidth <= 768) {
      document.getElementById('editor-sidebar').classList.remove('open');
      document.getElementById('editor-form').classList.add('open');
      document.getElementById('editor-overlay').classList.add('visible');
      this._invalidateMap();
    }
    const loc = this.campaign.locations.find(l => l.id === id);
    if (loc) {
      const ll = this._getPreviewLatLng(loc);
      if (ll) this.map.setView([ll.lat, ll.lng], 17);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  CRUD: ITEMS
  // ═══════════════════════════════════════════════════════════════

  addItem() {
    const id = 'item_' + (this.campaign.items.length + 1);
    const item = {
      id,
      name: 'Nuevo Item',
      description: '',
      icon: 'coin',
      gps: {
        type: 'relative',
        bearing_degrees: 0,
        distance_meters: 20,
        pickup_radius_meters: 30
      },
      on_pickup: { text: 'Has recogido ' + id, actions: [] }
    };
    this.campaign.items.push(item);
    this.selectItem(id);
    this.updateItemMarker(item);
  }

  deleteItem(id) {
    if (!confirm('¿Borrar este item?')) return;
    this.campaign.items = this.campaign.items.filter(i => i.id !== id);
    if (this.selectedItemId === id) {
      this.selectedItemId = null;
      this.renderEmptyForm();
    }
    this.removeItemMarker(id);
    this.renderSidebar();
  }

  selectItem(id) {
    this.selectedItemId = id;
    this.renderSidebar();
    this.renderForm();
    if (window.innerWidth <= 768) {
      document.getElementById('editor-sidebar').classList.remove('open');
      document.getElementById('editor-form').classList.add('open');
      document.getElementById('editor-overlay').classList.add('visible');
      this._invalidateMap();
    }
    const item = this.campaign.items.find(i => i.id === id);
    if (item) {
      const ll = this._getPreviewLatLng(item);
      if (ll) this.map.setView([ll.lat, ll.lng], 18);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  CRUD: NPCs
  // ═══════════════════════════════════════════════════════════════

  addNpc() {
    if (!this.campaign.npcs) this.campaign.npcs = [];
    const id = 'npc_' + (this.campaign.npcs.length + 1);
    const npc = {
      id,
      name: 'Nuevo NPC',
      description: '',
      icon: 'rat',
      gps: {
        type: 'relative',
        bearing_degrees: 0,
        distance_meters: 20,
        interact_radius_meters: 30
      },
      on_interact: { text: 'Hola, viajero.', actions: [] }
    };
    this.campaign.npcs.push(npc);
    this.selectNpc(id);
  }

  deleteNpc(id) {
    if (!confirm('¿Borrar este NPC?')) return;
    this.campaign.npcs = (this.campaign.npcs || []).filter(n => n.id !== id);
    if (this.selectedNpcId === id) {
      this.selectedNpcId = null;
      this.renderEmptyForm();
    }
    this.removeNpcMarker(id);
    this.renderSidebar();
  }

  selectNpc(id) {
    this.selectedNpcId = id;
    this.renderSidebar();
    this.renderForm();
    if (window.innerWidth <= 768) {
      document.getElementById('editor-sidebar').classList.remove('open');
      document.getElementById('editor-form').classList.add('open');
      document.getElementById('editor-overlay').classList.add('visible');
      this._invalidateMap();
    }
    const npc = (this.campaign.npcs || []).find(n => n.id === id);
    if (npc) {
      const ll = this._getPreviewLatLng(npc);
      if (ll) this.map.setView([ll.lat, ll.lng], 18);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  CRUD: EVENTS
  // ═══════════════════════════════════════════════════════════════

  addEvent() {
    if (!this.campaign.events) this.campaign.events = [];
    const id = 'event_' + (this.campaign.events.length + 1);
    const evt = {
      id,
      actions: [{ type: 'text', value: 'Evento activado' }]
    };
    this.campaign.events.push(evt);
    this.selectEvent(id);
  }

  deleteEvent(id) {
    if (!confirm('¿Borrar este evento?')) return;
    this.campaign.events = (this.campaign.events || []).filter(e => e.id !== id);
    if (this.selectedEventId === id) {
      this.selectedEventId = null;
      this.renderEmptyForm();
    }
    this.renderSidebar();
  }

  selectEvent(id) {
    this.selectedEventId = id;
    this.renderSidebar();
    this.renderForm();
  }

  // ═══════════════════════════════════════════════════════════════
  //  MAP MARKERS
  // ═══════════════════════════════════════════════════════════════

  clearMap() {
    for (const id in this.markers) {
      this.map.removeLayer(this.markers[id]);
      if (this.circles[id]) this.map.removeLayer(this.circles[id]);
    }
    for (const id in this.itemMarkers) this.map.removeLayer(this.itemMarkers[id]);
    for (const id in this.itemCircles) this.map.removeLayer(this.itemCircles[id]);
    for (const id in this.itemVisCircles) this.map.removeLayer(this.itemVisCircles[id]);
    for (const id in this.npcMarkers) this.map.removeLayer(this.npcMarkers[id]);
    for (const id in this.npcCircles) this.map.removeLayer(this.npcCircles[id]);
    this.markers = {};
    this.circles = {};
    this.itemMarkers = {};
    this.itemCircles = {};
    this.itemVisCircles = {};
    this.npcMarkers = {};
    this.npcCircles = {};
  }

  removeLocationMarker(id) {
    if (this.markers[id]) { this.map.removeLayer(this.markers[id]); delete this.markers[id]; }
    if (this.circles[id]) { this.map.removeLayer(this.circles[id]); delete this.circles[id]; }
  }

  removeItemMarker(id) {
    if (this.itemMarkers[id]) { this.map.removeLayer(this.itemMarkers[id]); delete this.itemMarkers[id]; }
    if (this.itemCircles[id]) { this.map.removeLayer(this.itemCircles[id]); delete this.itemCircles[id]; }
    if (this.itemVisCircles[id]) { this.map.removeLayer(this.itemVisCircles[id]); delete this.itemVisCircles[id]; }
  }

  removeNpcMarker(id) {
    if (this.npcMarkers[id]) { this.map.removeLayer(this.npcMarkers[id]); delete this.npcMarkers[id]; }
    if (this.npcCircles[id]) { this.map.removeLayer(this.npcCircles[id]); delete this.npcCircles[id]; }
  }

  updateLocationMarker(loc) {
    this.removeLocationMarker(loc.id);
    const ll = this._getPreviewLatLng(loc);
    if (!ll) return;
    const latlng = [ll.lat, ll.lng];
    let markerOpts = { draggable: true };
    if (loc.icon) {
      markerOpts.icon = L.icon({
        iconUrl: AssetResolver.locationIcon(loc.icon, this.campaign.campaign_id),
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
      });
    }
    this.markers[loc.id] = L.marker(latlng, markerOpts).addTo(this.map);
    this.markers[loc.id].bindPopup(`<b>${this._esc(loc.name)}</b><br>${this._esc(loc.id)}<br><small>${this._esc(loc.gps.type || 'absolute')}</small>`);
    this.markers[loc.id].on('dragend', (e) => {
      const pos = e.target.getLatLng();
      if (loc.gps.type === 'absolute') {
        loc.gps.lat = parseFloat(pos.lat.toFixed(6));
        loc.gps.lng = parseFloat(pos.lng.toFixed(6));
      } else if (loc.gps.type === 'relative') {
        const origin = this._getOrigin();
        const bd = this._calcBearingDistance(origin, pos);
        loc.gps.bearing_degrees = Math.round(bd.bearing);
        loc.gps.distance_meters = Math.round(bd.distance);
      }
      this.updateLocationMarker(loc);
      if (this.selectedLocId === loc.id) this.renderForm();
    });
    this.circles[loc.id] = L.circle(latlng, {
      radius: loc.gps.radius_meters || 30,
      color: '#3498db',
      fillColor: '#3498db',
      fillOpacity: 0.15,
      weight: 2
    }).addTo(this.map);
  }

  updateItemMarker(item) {
    this.removeItemMarker(item.id);
    const ll = this._getPreviewLatLng(item);
    if (!ll) return;
    const icon = L.icon({
      iconUrl: AssetResolver.itemIcon(item.icon || 'coin', this.campaign.campaign_id),
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16]
    });
    this.itemMarkers[item.id] = L.marker([ll.lat, ll.lng], { icon, draggable: true }).addTo(this.map);
    this.itemMarkers[item.id].bindPopup(`<b>${this._esc(item.name)}</b><br><small>Item: ${this._esc(item.id)}</small>`);
    this.itemMarkers[item.id].on('dragend', (e) => {
      const pos = e.target.getLatLng();
      if (item.gps.type === 'absolute') {
        item.gps.lat = parseFloat(pos.lat.toFixed(6));
        item.gps.lng = parseFloat(pos.lng.toFixed(6));
      } else if (item.gps.type === 'relative') {
        const origin = this._getOrigin();
        const bd = this._calcBearingDistance(origin, pos);
        item.gps.bearing_degrees = Math.round(bd.bearing);
        item.gps.distance_meters = Math.round(bd.distance);
      }
      this.updateItemMarker(item);
      if (this.selectedItemId === item.id) this.renderForm();
    });
    // Radio circle (pickup)
    this.itemCircles[item.id] = L.circle([ll.lat, ll.lng], {
      radius: item.gps.pickup_radius_meters || 30,
      color: '#2ecc71',
      fillColor: '#2ecc71',
      fillOpacity: 0.15,
      weight: 2
    }).addTo(this.map);
    // Visibility radius circle (editor only)
    if (item.gps.visibility_radius_meters) {
      this.itemVisCircles[item.id] = L.circle([ll.lat, ll.lng], {
        radius: item.gps.visibility_radius_meters,
        color: '#f39c12',
        fillColor: '#f39c12',
        fillOpacity: 0.1,
        weight: 1.5,
        dashArray: '5, 5'
      }).addTo(this.map);
    }
  }

  updateNpcMarker(npc) {
    this.removeNpcMarker(npc.id);
    const ll = this._getPreviewLatLng(npc);
    if (!ll) return;
    const icon = L.icon({
      iconUrl: AssetResolver.npcIcon(npc.icon || 'merchant', this.campaign.campaign_id),
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16]
    });
    this.npcMarkers[npc.id] = L.marker([ll.lat, ll.lng], { icon, draggable: true }).addTo(this.map);
    this.npcMarkers[npc.id].bindPopup(`<b>${this._esc(npc.name)}</b><br><small>NPC: ${this._esc(npc.id)}</small>`);
    this.npcMarkers[npc.id].on('dragend', (e) => {
      const pos = e.target.getLatLng();
      if (npc.gps.type === 'absolute') {
        npc.gps.lat = parseFloat(pos.lat.toFixed(6));
        npc.gps.lng = parseFloat(pos.lng.toFixed(6));
      } else if (npc.gps.type === 'relative') {
        const origin = this._getOrigin();
        const bd = this._calcBearingDistance(origin, pos);
        npc.gps.bearing_degrees = Math.round(bd.bearing);
        npc.gps.distance_meters = Math.round(bd.distance);
      }
      this.updateNpcMarker(npc);
      if (this.selectedNpcId === npc.id) this.renderForm();
    });
    // Radio circle
    this.npcCircles[npc.id] = L.circle([ll.lat, ll.lng], {
      radius: npc.gps.interact_radius_meters || 30,
      color: '#9b59b6',
      fillColor: '#9b59b6',
      fillOpacity: 0.15,
      weight: 2
    }).addTo(this.map);
  }

  // ═══════════════════════════════════════════════════════════════
  //  FORM RENDERING
  // ═══════════════════════════════════════════════════════════════

  renderEmptyForm() {
    const form = document.getElementById('editor-form');
    if (this.currentPanel === 'config') {
      this.renderConfigForm();
      return;
    }
    form.innerHTML = `<p style="color:var(--text-muted);text-align:center;margin-top:2rem;">Selecciona un elemento del sidebar para editarlo.</p>`;
  }

  renderForm() {
    if (this.currentPanel === 'locations' && this.selectedLocId) {
      const loc = this.campaign.locations.find(l => l.id === this.selectedLocId);
      if (loc) this.renderLocationForm(loc);
    } else if (this.currentPanel === 'items' && this.selectedItemId) {
      const item = this.campaign.items.find(i => i.id === this.selectedItemId);
      if (item) this.renderItemForm(item);
    } else if (this.currentPanel === 'npcs' && this.selectedNpcId) {
      const npc = (this.campaign.npcs || []).find(n => n.id === this.selectedNpcId);
      if (npc) this.renderNpcForm(npc);
    } else if (this.currentPanel === 'events' && this.selectedEventId) {
      const evt = (this.campaign.events || []).find(e => e.id === this.selectedEventId);
      if (evt) this.renderEventForm(evt);
    } else if (this.currentPanel === 'config') {
      this.renderConfigForm();
    }
    this._attachAutoSave();
  }

  _attachAutoSave() {
    const form = document.getElementById('editor-form');
    if (!form) return;
    let debounceTimer;
    form.querySelectorAll('input, textarea, select').forEach(el => {
      if (el._autoSaveAttached) return;
      el._autoSaveAttached = true;
      if (el.type === 'checkbox' || el.tagName === 'SELECT') {
        el.addEventListener('change', () => this._doAutoSave());
      } else {
        el.addEventListener('input', () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => this._doAutoSave(), 500);
        });
        el.addEventListener('change', () => this._doAutoSave());
      }
    });
  }

  _doAutoSave() {
    this.saveForm();
    if (typeof UIComponents !== 'undefined') {
      UIComponents.toast('💾 Guardado');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  LOCATION FORM (with scene canvas)
  // ═══════════════════════════════════════════════════════════════

  renderLocationForm(loc) {
    const gps = loc.gps || {};
    const type = loc.gps ? (loc.gps.type || 'absolute') : 'none';

    let gpsFields = '';
    if (type === 'relative') {
      gpsFields = `
        <div class="editor-group"><label>Rumbo (grados, 0=Norte)</label><input type="number" id="form_bearing" value="${gps.bearing_degrees || 0}" step="1"></div>
        <div class="editor-group"><label>Distancia (metros)</label><input type="number" id="form_distance" value="${gps.distance_meters || 0}" step="1"></div>
      `;
    } else if (type === 'absolute') {
      gpsFields = `
        <div class="editor-group"><label>Latitud</label><input type="number" step="0.000001" id="form_lat" value="${gps.lat || 0}"></div>
        <div class="editor-group"><label>Longitud</label><input type="number" step="0.000001" id="form_lng" value="${gps.lng || 0}"></div>
      `;
    }

    const onEnterBlock = Array.isArray(loc.on_enter) ? { actions: loc.on_enter } : (loc.on_enter || { actions: [] });

    document.getElementById('editor-form').innerHTML = `
      <h3 style="color:var(--accent);margin-bottom:1rem;">${this._esc(loc.name)}</h3>

      <div class="editor-group"><label>ID (readonly)</label><input type="text" id="form_id" value="${this._esc(loc.id)}" disabled></div>
      <div class="editor-group"><label>Nombre</label><input type="text" id="form_name" value="${this._esc(loc.name)}"></div>
      <div class="editor-group"><label>Descripción</label><textarea id="form_desc">${this._esc(loc.description || '')}</textarea></div>
      <div class="editor-group"><label>Color de fondo</label><input type="color" id="form_color" value="${this._esc(loc.color || '#2c3e50')}"></div>
      <div class="editor-group"><label>Icono en mapa</label><select id="form_icon" onchange="editor.onLocationIconChange(this.value)"><option value="" ${!loc.icon?'selected':''}>Pin por defecto</option><optgroup label="Casas"><option value="casa_madera" ${loc.icon==='casa_madera'?'selected':''}>🪵 Casa de madera</option><option value="casa_piedra" ${loc.icon==='casa_piedra'?'selected':''}>🪨 Casa de piedra</option><option value="casa_ladrillo" ${loc.icon==='casa_ladrillo'?'selected':''}>🧱 Casa de ladrillo</option><option value="casa_moderna" ${loc.icon==='casa_moderna'?'selected':''}>🏠 Casa moderna</option><option value="casa_paja" ${loc.icon==='casa_paja'?'selected':''}>🛖 Choza de paja</option></optgroup><optgroup label="Otros"><option value="mazmorra" ${loc.icon==='mazmorra'?'selected':''}>🏰 Mazmorra</option><option value="cueva" ${loc.icon==='cueva'?'selected':''}>🗿 Cueva</option><option value="campo" ${loc.icon==='campo'?'selected':''}>🌾 Campo</option><option value="campo_tierra" ${loc.icon==='campo_tierra'?'selected':''}>🌱 Campo de tierra</option></optgroup></select></div>
      <div class="editor-group">
        <label>Tipo de fondo</label>
        <select id="form_bg_type" onchange="editor.onBgTypeChange()">
          <optgroup label="Ladrillos">
            <option value="brick_floor" ${loc.background_type==='brick_floor'?'selected':''}>Completo</option>
            <option value="brick_wall_top" ${loc.background_type==='brick_wall_top'?'selected':''}>Pared arriba</option>
            <option value="brick_wall_bottom" ${loc.background_type==='brick_wall_bottom'?'selected':''}>Pared abajo</option>
            <option value="brick_wall_left" ${loc.background_type==='brick_wall_left'?'selected':''}>Pared izquierda</option>
            <option value="brick_wall_right" ${loc.background_type==='brick_wall_right'?'selected':''}>Pared derecha</option>
            <option value="brick_wall_top_left" ${loc.background_type==='brick_wall_top_left'?'selected':''}>Esquina sup-izq</option>
            <option value="brick_wall_top_right" ${loc.background_type==='brick_wall_top_right'?'selected':''}>Esquina sup-der</option>
            <option value="brick_wall_bottom_left" ${loc.background_type==='brick_wall_bottom_left'?'selected':''}>Esquina inf-izq</option>
            <option value="brick_wall_bottom_right" ${loc.background_type==='brick_wall_bottom_right'?'selected':''}>Esquina inf-der</option>
          </optgroup>
          <optgroup label="Madera">
            <option value="wood_floor" ${loc.background_type==='wood_floor'?'selected':''}>Completo</option>
            <option value="wood_wall_top" ${loc.background_type==='wood_wall_top'?'selected':''}>Pared arriba</option>
            <option value="wood_wall_bottom" ${loc.background_type==='wood_wall_bottom'?'selected':''}>Pared abajo</option>
            <option value="wood_wall_left" ${loc.background_type==='wood_wall_left'?'selected':''}>Pared izquierda</option>
            <option value="wood_wall_right" ${loc.background_type==='wood_wall_right'?'selected':''}>Pared derecha</option>
            <option value="wood_wall_top_left" ${loc.background_type==='wood_wall_top_left'?'selected':''}>Esquina sup-izq</option>
            <option value="wood_wall_top_right" ${loc.background_type==='wood_wall_top_right'?'selected':''}>Esquina sup-der</option>
            <option value="wood_wall_bottom_left" ${loc.background_type==='wood_wall_bottom_left'?'selected':''}>Esquina inf-izq</option>
            <option value="wood_wall_bottom_right" ${loc.background_type==='wood_wall_bottom_right'?'selected':''}>Esquina inf-der</option>
          </optgroup>
          <optgroup label="Piedra">
            <option value="stone_floor" ${loc.background_type==='stone_floor'?'selected':''}>Completo</option>
            <option value="stone_wall_top" ${loc.background_type==='stone_wall_top'?'selected':''}>Pared arriba</option>
            <option value="stone_wall_bottom" ${loc.background_type==='stone_wall_bottom'?'selected':''}>Pared abajo</option>
            <option value="stone_wall_left" ${loc.background_type==='stone_wall_left'?'selected':''}>Pared izquierda</option>
            <option value="stone_wall_right" ${loc.background_type==='stone_wall_right'?'selected':''}>Pared derecha</option>
            <option value="stone_wall_top_left" ${loc.background_type==='stone_wall_top_left'?'selected':''}>Esquina sup-izq</option>
            <option value="stone_wall_top_right" ${loc.background_type==='stone_wall_top_right'?'selected':''}>Esquina sup-der</option>
            <option value="stone_wall_bottom_left" ${loc.background_type==='stone_wall_bottom_left'?'selected':''}>Esquina inf-izq</option>
            <option value="stone_wall_bottom_right" ${loc.background_type==='stone_wall_bottom_right'?'selected':''}>Esquina inf-der</option>
          </optgroup>
          <optgroup label="Otros">
            <option value="grass_floor" ${loc.background_type==='grass_floor'?'selected':''}>Césped</option>
            <option value="dirt_floor" ${loc.background_type==='dirt_floor'?'selected':''}>Camino de tierra</option>
            <option value="dungeon_floor" ${loc.background_type==='dungeon_floor'?'selected':''}>Mazmorra</option>
            <option value="cave_floor" ${loc.background_type==='cave_floor'?'selected':''}>Cueva</option>
          </optgroup>
        </select>
      </div>

      <h4 style="color:var(--text-muted);margin:1rem 0 0.5rem;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:0.3rem;">📍 GPS</h4>
      <div class="editor-group"><label>Tipo</label><select id="form_gps_type" onchange="editor.onGpsTypeChange()"><option value="relative" ${type==='relative'?'selected':''}>Relativo al jugador</option><option value="absolute" ${type==='absolute'?'selected':''}>Absoluto (lat/lng)</option><option value="none" ${type==='none'?'selected':''}>Sin GPS</option></select></div>
      ${type !== 'none' ? `<div id="gps-fields">${gpsFields}</div><div class="editor-group"><label>Radio (metros)</label><input type="number" id="form_radius" value="${gps.radius_meters || 30}" onchange="editor.onRadiusChange()"></div>` : ''}

      <h4 style="color:var(--text-muted);margin:1rem 0 0.5rem;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:0.3rem;">👁️ Condición de visibilidad</h4>
      <div style="margin-bottom:0.5rem;">
        <label style="display:flex;align-items:center;gap:0.4rem;color:var(--text-muted);font-size:0.85rem;cursor:pointer;">
          <input type="checkbox" id="form_loc_has_visible_condition" ${loc.visible_condition ? 'checked' : ''} onchange="editor.toggleLocVisibleCondition()">
          Solo mostrar bajo condición
        </label>
      </div>
      <div id="loc-visible-condition-fields" style="${loc.visible_condition ? '' : 'display:none;'}">
        ${this._buildConditionRowsHTML(loc.visible_condition || {conditions:[{}]}, 'loc')}
        <button class="btn btn-sm btn-secondary" style="margin-top:0.5rem;" onclick="editor._addConditionRow('loc-conditions-container', 'loc')">+ Añadir condición</button>
      </div>

      <h4 style="color:var(--text-muted);margin:1rem 0 0.5rem;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:0.3rem;">📝 Al entrar</h4>
      <div id="loc-onenter-block"></div>

      <h4 style="color:var(--text-muted);margin:1rem 0 0.5rem;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:0.3rem;">🖱️ Escena</h4>
      <div style="position:relative;max-width:100%;border:2px solid var(--accent);margin-bottom:0.5rem;background:#000;overflow:auto;">
        <canvas id="scene-canvas" width="400" height="300" style="max-width:100%;height:auto;display:block;cursor:crosshair;"></canvas>
      </div>
      <div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-bottom:0.5rem;">
        <button class="btn btn-sm btn-secondary" onclick="editor.addSceneArea('rect')">+ Rect</button>
        <button class="btn btn-sm btn-secondary" onclick="editor.addSceneArea('circle')">+ Círculo</button>
        <button class="btn btn-sm btn-secondary" onclick="editor.addSceneNpc()">+ NPC</button>
        <button class="btn btn-sm btn-danger" onclick="editor.deleteSelectedSceneElement()">🗑 Borrar</button>
      </div>
      <div id="scene-properties"></div>

      <div style="height:2rem;"></div>
    `;

    this.renderActionBlock('loc-onenter-block', onEnterBlock, { allowSceneChange: true });
    this._initSceneCanvas();
    this._drawScene();
    this._renderSceneProperties();
  }

  onBgTypeChange() {
    const loc = this.campaign.locations.find(l => l.id === this.selectedLocId);
    if (!loc) return;
    loc.background_type = document.getElementById('form_bg_type').value || null;
    this._drawScene();
    this._doAutoSave();
  }

  onGpsTypeChange() {
    const loc = this.campaign.locations.find(l => l.id === this.selectedLocId);
    if (!loc) return;
    const newType = document.getElementById('form_gps_type').value;
    if (newType === 'none') {
      delete loc.gps;
      this.removeLocationMarker(loc.id);
    } else {
      const oldRadius = loc.gps?.radius_meters;
      loc.gps = loc.gps || {};
      loc.gps.type = newType;
      if (oldRadius != null) loc.gps.radius_meters = oldRadius;
      if (newType === 'relative') {
        loc.gps.bearing_degrees = 0;
        loc.gps.distance_meters = 50;
        delete loc.gps.lat;
        delete loc.gps.lng;
      } else {
        const center = this.map.getCenter();
        loc.gps.lat = parseFloat(center.lat.toFixed(6));
        loc.gps.lng = parseFloat(center.lng.toFixed(6));
        delete loc.gps.bearing_degrees;
        delete loc.gps.distance_meters;
      }
    }
    this.renderForm();
  }

  onRadiusChange() {
    const loc = this.campaign.locations.find(l => l.id === this.selectedLocId);
    if (!loc || !loc.gps) return;
    const val = parseInt(document.getElementById('form_radius').value);
    loc.gps.radius_meters = isNaN(val) ? 30 : val;
    this.updateLocationMarker(loc);
    this._doAutoSave();
  }

  onItemGpsTypeChange() {
    const item = this.campaign.items.find(i => i.id === this.selectedItemId);
    if (!item) return;
    const newType = document.getElementById('form_gps_type').value;
    const oldRadius = item.gps?.pickup_radius_meters;
    if (newType === 'none') {
      delete item.gps;
    } else {
      item.gps = item.gps || {};
      item.gps.type = newType;
      if (oldRadius != null) item.gps.pickup_radius_meters = oldRadius;
      if (newType === 'relative') {
        item.gps.bearing_degrees = 0;
        item.gps.distance_meters = 20;
        delete item.gps.lat;
        delete item.gps.lng;
      } else {
        const center = this.map.getCenter();
        item.gps.lat = parseFloat(center.lat.toFixed(6));
        item.gps.lng = parseFloat(center.lng.toFixed(6));
        delete item.gps.bearing_degrees;
        delete item.gps.distance_meters;
      }
    }
    this.updateItemMarker(item);
    this.renderForm();
    this._doAutoSave();
  }

  onNpcGpsTypeChange() {
    const npc = (this.campaign.npcs || []).find(n => n.id === this.selectedNpcId);
    if (!npc) return;
    const newType = document.getElementById('form_gps_type').value;
    const oldRadius = npc.gps?.interact_radius_meters;
    if (newType === '') {
        delete npc.gps;
    } else {
      npc.gps = npc.gps || {};
      npc.gps.type = newType;
      if (oldRadius != null) npc.gps.interact_radius_meters = oldRadius;
      if (newType === 'relative') {
        npc.gps.bearing_degrees = 0;
        npc.gps.distance_meters = 20;
        delete npc.gps.lat;
        delete npc.gps.lng;
      } else {
        const center = this.map.getCenter();
        npc.gps.lat = parseFloat(center.lat.toFixed(6));
        npc.gps.lng = parseFloat(center.lng.toFixed(6));
        delete npc.gps.bearing_degrees;
        delete npc.gps.distance_meters;
      }
    }
    this.updateNpcMarker(npc);
    this.renderForm();
    this._doAutoSave();
  }

  // ═══════════════════════════════════════════════════════════════
  //  SCENE CANVAS (drag & drop + resize)
  // ═══════════════════════════════════════════════════════════════

  _initSceneCanvas() {
    const canvas = document.getElementById('scene-canvas');
    if (!canvas) return;
    this._sceneCanvas = canvas;
    this._sceneCtx = canvas.getContext('2d');

    // Remove old listeners if present to prevent duplicates
    if (this._boundSceneMouseDown) canvas.removeEventListener('mousedown', this._boundSceneMouseDown);
    if (this._boundSceneMouseMove) canvas.removeEventListener('mousemove', this._boundSceneMouseMove);
    if (this._boundSceneMouseUp) window.removeEventListener('mouseup', this._boundSceneMouseUp);

    this._boundSceneMouseDown = (e) => this._onSceneMouseDown(e);
    this._boundSceneMouseMove = (e) => this._onSceneMouseMove(e);
    this._boundSceneMouseUp = (e) => this._onSceneMouseUp(e);

    canvas.addEventListener('mousedown', this._boundSceneMouseDown);
    canvas.addEventListener('mousemove', this._boundSceneMouseMove);
    window.addEventListener('mouseup', this._boundSceneMouseUp);
  }

  _drawScene() {
    if (!this._sceneCtx) return;
    const ctx = this._sceneCtx;
    const loc = this.campaign.locations.find(l => l.id === this.selectedLocId);
    if (!loc) return;

    // Background
    if (loc.background_type) {
      this._drawBackgroundOnCanvas(ctx, loc.background_type);
    } else {
      ctx.fillStyle = loc.color || '#2c3e50';
      ctx.fillRect(0, 0, 400, 300);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      const bw = 40, bh = 20;
      for (let row = 0; row < 300 / bh + 1; row++) {
        for (let col = 0; col < 400 / bw + 1; col++) {
          const offset = (row % 2) * (bw / 2);
          ctx.fillRect(col * bw + offset, row * bh, bw - 2, bh - 2);
        }
      }
    }

    // Zones
    const areas = loc.clickable_areas || [];
    for (let i = 0; i < areas.length; i++) {
      const a = areas[i];
      const selected = this._selectedSceneElement && this._selectedSceneElement.type === 'area' && this._selectedSceneElement.index === i;
      this._drawAreaOnCanvas(ctx, a, selected);
    }

    // NPC instances
    const npcs = loc.npc_instances || [];
    for (let i = 0; i < npcs.length; i++) {
      const inst = npcs[i];
      const selected = this._selectedSceneElement && this._selectedSceneElement.type === 'npc' && this._selectedSceneElement.index === i;
      this._drawNpcOnCanvas(ctx, inst, selected);
    }
  }

  _drawAreaOnCanvas(ctx, area, selected) {
    const c = area.coords;
    const isCircle = area.shape === 'circle';

    if (area.object_on_ground) {
      const r = isCircle ? c.r : Math.min(c.w, c.h) / 2;
      const cx = isCircle ? c.x : c.x + c.w / 2;
      const cy = isCircle ? c.y : c.y + c.h / 2;
      this._drawItemIconOnCanvas(ctx, area.object_on_ground, cx, cy, r * 2);
      if (selected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        if (isCircle) {
          ctx.fillRect(c.x + c.r - 3, c.y - 3, 6, 6);
        } else {
          ctx.fillRect(c.x + c.w - 4, c.y + c.h - 4, 8, 8);
        }
      }
      return;
    }

    if (area.icon) {
      const r = isCircle ? c.r : Math.min(c.w, c.h) / 2;
      const cx = isCircle ? c.x : c.x + c.w / 2;
      const cy = isCircle ? c.y : c.y + c.h / 2;
      const w = isCircle ? r * 2 : c.w;
      const h = isCircle ? r * 2 : c.h;
      this._drawDecorIconOnCanvas(ctx, area.icon, cx, cy, w, h);
      if (selected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        if (isCircle) {
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.r + 2, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.fillRect(c.x + c.r - 3, c.y - 3, 6, 6);
        } else {
          ctx.strokeRect(c.x - 2, c.y - 2, c.w + 4, c.h + 4);
          ctx.fillStyle = '#fff';
          ctx.fillRect(c.x + c.w - 4, c.y + c.h - 4, 8, 8);
        }
      }
      return;
    }

    ctx.strokeStyle = selected ? '#fff' : 'rgba(233, 69, 96, 0.6)';
    ctx.lineWidth = selected ? 2 : 1;

    if (isCircle) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(233, 69, 96, 0.15)';
      ctx.fill();
      ctx.stroke();
      if (selected) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(c.x + c.r - 3, c.y - 3, 6, 6);
      }
    } else {
      ctx.fillStyle = 'rgba(233, 69, 96, 0.15)';
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeRect(c.x, c.y, c.w, c.h);
      if (selected) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(c.x + c.w - 4, c.y + c.h - 4, 8, 8);
      }
    }

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '10px sans-serif';
    ctx.fillText(area.id, c.x + 2, c.y + 12);
  }

  _drawItemIconOnCanvas(ctx, itemId, cx, cy, size) {
    const item = (this.campaign.items || []).find(it => it.id === itemId);
    const iconName = item ? item.icon : 'coin';
    const iconUrl = AssetResolver.itemIcon(iconName);

    if (this._itemIconCache[iconUrl]) {
      const img = this._itemIconCache[iconUrl];
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, cx - size/2, cy - size/2, size, size);
        return;
      }
    }

    // Load and cache
    const img = new Image();
    img.onload = () => {
      this._itemIconCache[iconUrl] = img;
      this._drawScene(); // Redraw when loaded
    };
    img.onerror = () => {
      console.warn('Failed to load item icon:', iconUrl);
    };
    img.src = iconUrl;
    this._itemIconCache[iconUrl] = img;

    // Draw placeholder while loading
    ctx.beginPath();
    ctx.arc(cx, cy, size/2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(241, 196, 15, 0.4)';
    ctx.fill();
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  _drawDecorIconOnCanvas(ctx, iconName, cx, cy, w, h) {
    const iconUrl = AssetResolver.decorIcon(iconName);

    if (this._decorIconCache[iconUrl]) {
      const img = this._decorIconCache[iconUrl];
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, cx - w/2, cy - h/2, w, h);
        return;
      }
    }

    // Load and cache
    const img = new Image();
    img.onload = () => {
      this._decorIconCache[iconUrl] = img;
      this._drawScene(); // Redraw when loaded
    };
    img.onerror = () => {
      console.warn('Failed to load decor icon:', iconUrl);
    };
    img.src = iconUrl;
    this._decorIconCache[iconUrl] = img;

    // Draw placeholder while loading
    ctx.beginPath();
    ctx.rect(cx - w/2, cy - h/2, w, h);
    ctx.fillStyle = 'rgba(142, 68, 173, 0.3)';
    ctx.fill();
    ctx.strokeStyle = '#8e44ad';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  _drawBackgroundOnCanvas(ctx, bgType) {
    const iconUrl = AssetResolver.bgIcon(bgType);

    if (this._bgImageCache && this._bgImageCache[iconUrl]) {
      const img = this._bgImageCache[iconUrl];
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, 0, 0, 400, 300);
        return;
      }
    }

    if (!this._bgImageCache) this._bgImageCache = {};

    // Load and cache
    const img = new Image();
    img.onload = () => {
      this._bgImageCache[iconUrl] = img;
      this._drawScene(); // Redraw when loaded
    };
    img.onerror = () => {
      console.warn('Failed to load background:', iconUrl);
    };
    img.src = iconUrl;
    this._bgImageCache[iconUrl] = img;

    // Draw fallback color while loading
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, 400, 300);
  }

  _drawNpcIconOnCanvas(ctx, iconName, cx, cy, size) {
    const iconUrl = AssetResolver.npcIcon(iconName);

    if (this._npcIconCache[iconUrl]) {
      const img = this._npcIconCache[iconUrl];
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, cx - size/2, cy - size/2, size, size);
        return;
      }
    }

    // Load and cache
    const img = new Image();
    img.onload = () => {
      this._npcIconCache[iconUrl] = img;
      this._drawScene(); // Redraw when loaded
    };
    img.onerror = () => {
      console.warn('Failed to load NPC icon:', iconUrl);
    };
    img.src = iconUrl;
    this._npcIconCache[iconUrl] = img;

    // Draw placeholder while loading
    ctx.beginPath();
    ctx.arc(cx, cy, size/2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(52, 152, 219, 0.4)';
    ctx.fill();
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  _drawNpcOnCanvas(ctx, inst, selected) {
    const p = inst.position || { x: 100, y: 100 };
    const globalNpc = (this.campaign.npcs || []).find(n => n.id === inst.ref);
    const name = globalNpc ? globalNpc.name : inst.ref;
    const iconName = globalNpc ? (globalNpc.icon || 'merchant') : 'merchant';
    const npcScale = inst.scale || 1.0;
    const size = 30 * npcScale;

    // Draw NPC sprite
    this._drawNpcIconOnCanvas(ctx, iconName, p.x, p.y, size);

    // Draw selection highlight
    if (selected) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size/2 + 2, 0, Math.PI * 2);
      ctx.stroke();

      // Draw resize handle
      const hcx = p.x + size/2;
      const hcy = p.y + size/2;
      ctx.fillStyle = '#fff';
      ctx.fillRect(hcx - 3, hcy - 3, 6, 6);
      ctx.strokeStyle = '#3498db';
      ctx.lineWidth = 1;
      ctx.strokeRect(hcx - 3, hcy - 3, 6, 6);
    }

    // Draw name label
    ctx.fillStyle = '#ecf0f1';
    ctx.font = '10px sans-serif';
    ctx.fillText(name, p.x - 14, p.y + size/2 + 12);
  }

  _hitTestScene(cx, cy) {
    const loc = this.campaign.locations.find(l => l.id === this.selectedLocId);
    if (!loc) return null;

    // Test NPCs first (smaller, on top)
    const npcs = loc.npc_instances || [];
    for (let i = npcs.length - 1; i >= 0; i--) {
      const inst = npcs[i];
      const p = inst.position || { x: 0, y: 0 };
      const npcScale = inst.scale || 1.0;
      const hitRadius = 20 * npcScale;
      const dx = cx - p.x;
      const dy = cy - p.y;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) return { type: 'npc', index: i };
    }

    // Test areas
    const areas = loc.clickable_areas || [];
    for (let i = areas.length - 1; i >= 0; i--) {
      const area = areas[i];
      const c = area.coords;
      if (area.shape === 'circle') {
        const dx = cx - c.x;
        const dy = cy - c.y;
        if (dx * dx + dy * dy <= c.r * c.r) return { type: 'area', index: i };
      } else {
        if (cx >= c.x && cx <= c.x + c.w && cy >= c.y && cy <= c.y + c.h) return { type: 'area', index: i };
      }
    }

    return null;
  }

  _hitTestResizeHandle(cx, cy) {
    if (!this._selectedSceneElement) return null;
    const loc = this.campaign.locations.find(l => l.id === this.selectedLocId);
    if (!loc) return null;

    const el = this._selectedSceneElement;
    if (el.type === 'area') {
      const area = loc.clickable_areas[el.index];
      const c = area.coords;
      if (area.shape === 'circle') {
        const hcx = c.x + c.r;
        const hcy = c.y;
        if (Math.abs(cx - hcx) <= 5 && Math.abs(cy - hcy) <= 5) return { type: 'resize', element: el };
      } else {
        const hcx = c.x + c.w;
        const hcy = c.y + c.h;
        if (Math.abs(cx - hcx) <= 6 && Math.abs(cy - hcy) <= 6) return { type: 'resize', element: el };
      }
    } else if (el.type === 'npc') {
      const inst = loc.npc_instances[el.index];
      const p = inst.position || { x: 0, y: 0 };
      const npcScale = inst.scale || 1.0;
      const size = 30 * npcScale;
      const hcx = p.x + size/2;
      const hcy = p.y + size/2;
      if (Math.abs(cx - hcx) <= 6 && Math.abs(cy - hcy) <= 6) return { type: 'resize', element: el };
    }
    return null;
  }

  _onSceneMouseDown(e) {
    if (!this._sceneCanvas) return;
    const rect = this._sceneCanvas.getBoundingClientRect();
    // Scale from CSS size to canvas native size
    const scaleX = 400 / rect.width;
    const scaleY = 300 / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    const loc = this.campaign.locations.find(l => l.id === this.selectedLocId);

    const handle = this._hitTestResizeHandle(cx, cy);
    if (handle) {
      this._mode = 'resize';
      this._resizeHandle = handle;
      const el = this._selectedSceneElement;
      let sw = 0, sh = 0;
      if (el.type === 'area' && loc) {
        const area = loc.clickable_areas[el.index];
        if (area.shape === 'rect') { sw = area.coords.w; sh = area.coords.h; }
        else { sw = area.coords.r; sh = area.coords.r; }
      } else if (el.type === 'npc' && loc) {
        const inst = loc.npc_instances[el.index];
        sw = (inst.scale || 1.0) * 30;
      }
      this._dragStart = { cx, cy, sx: cx, sy: cy, sw, sh };
      return;
    }

    const hit = this._hitTestScene(cx, cy);
    if (hit) {
      this._selectedSceneElement = hit;
      this._mode = 'drag';
      this._dragStart = { cx, cy, sx: cx, sy: cy };
      this._drawScene();
      this._renderSceneProperties();
    } else {
      this._selectedSceneElement = null;
      this._mode = null;
      this._drawScene();
      this._renderSceneProperties();
    }
  }

  _onSceneMouseMove(e) {
    if (!this._mode || !this._sceneCanvas) return;
    const rect = this._sceneCanvas.getBoundingClientRect();
    const scaleX = 400 / rect.width;
    const scaleY = 300 / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;
    const loc = this.campaign.locations.find(l => l.id === this.selectedLocId);
    if (!loc) return;

    const el = this._selectedSceneElement;

    if (this._mode === 'drag') {
      const sdx = cx - this._dragStart.sx;
      const sdy = cy - this._dragStart.sy;

      if (el.type === 'area') {
        const area = loc.clickable_areas[el.index];
        if (area.shape === 'rect') {
          area.coords.x = Math.round(this._dragStart.sx + sdx - area.coords.w / 2);
          area.coords.y = Math.round(this._dragStart.sy + sdy - area.coords.h / 2);
        } else {
          area.coords.x = Math.round(this._dragStart.sx + sdx);
          area.coords.y = Math.round(this._dragStart.sy + sdy);
        }
      } else if (el.type === 'npc') {
        const inst = loc.npc_instances[el.index];
        inst.position.x = Math.round(this._dragStart.sx + sdx);
        inst.position.y = Math.round(this._dragStart.sy + sdy);
      }
      this._drawScene();
      this._updateScenePropertyInputs();
    } else if (this._mode === 'resize') {
      const sdx = cx - this._dragStart.sx;
      const sdy = cy - this._dragStart.sy;

      if (el.type === 'area') {
        const area = loc.clickable_areas[el.index];
        if (area.shape === 'circle') {
          const cursorX = this._dragStart.sx + sdx;
          const cursorY = this._dragStart.sy + sdy;
          const dx = cursorX - area.coords.x;
          const dy = cursorY - area.coords.y;
          const newR = Math.round(Math.sqrt(dx * dx + dy * dy));
          area.coords.r = Math.max(5, newR);
        } else {
          area.coords.w = Math.round(Math.max(10, this._dragStart.sw + sdx));
          area.coords.h = Math.round(Math.max(10, this._dragStart.sh + sdy));
        }
      } else if (el.type === 'npc') {
        const inst = loc.npc_instances[el.index];
        const newSize = Math.max(10, this._dragStart.sw + sdx);
        inst.scale = Math.round((newSize / 30) * 100) / 100; // Round to 2 decimals
        if (inst.scale < 0.2) inst.scale = 0.2; // Minimum scale
        if (inst.scale > 5.0) inst.scale = 5.0; // Maximum scale
      }
      this._drawScene();
      this._updateScenePropertyInputs();
    }
  }

  _onSceneMouseUp(e) {
    this._mode = null;
    this._resizeHandle = null;
  }

  _updateScenePropertyInputs() {
    // Update any visible coord inputs in the properties panel
    const loc = this.campaign.locations.find(l => l.id === this.selectedLocId);
    if (!loc || !this._selectedSceneElement) return;
    const el = this._selectedSceneElement;
    if (el.type === 'area') {
      const area = loc.clickable_areas[el.index];
      const cx = document.getElementById('prop_x');
      const cy = document.getElementById('prop_y');
      const cw = document.getElementById('prop_w');
      const ch = document.getElementById('prop_h');
      const cr = document.getElementById('prop_r');
      if (cx) cx.value = area.coords.x;
      if (cy) cy.value = area.coords.y;
      if (area.shape === 'rect') {
        if (cw) cw.value = area.coords.w;
        if (ch) ch.value = area.coords.h;
      } else {
        if (cr) cr.value = area.coords.r;
      }
    } else if (el.type === 'npc') {
      const inst = loc.npc_instances[el.index];
      const cx = document.getElementById('prop_npx');
      const cy = document.getElementById('prop_npy');
      if (cx) cx.value = inst.position.x;
      if (cy) cy.value = inst.position.y;
    }
  }

  _renderSceneProperties() {
    const container = document.getElementById('scene-properties');
    if (!container) return;
    const loc = this.campaign.locations.find(l => l.id === this.selectedLocId);
    if (!loc || !this._selectedSceneElement) {
      container.innerHTML = '';
      return;
    }

    const el = this._selectedSceneElement;
    if (el.type === 'area') {
      const area = loc.clickable_areas[el.index];
      const isCircle = area.shape === 'circle';
      const condBlock = area.on_click || { actions: [] };

      container.innerHTML = `
        <h5 style="color:var(--accent);margin:0.5rem 0;">Zona: ${this._esc(area.id)}</h5>
        <div class="editor-group"><label>ID</label><input type="text" id="prop_aid" value="${this._esc(area.id)}" onchange="editor.updateSceneFromProps()"></div>
        <div style="display:flex;gap:0.5rem;">
          <div class="editor-group" style="flex:1;"><label>X</label><input type="number" id="prop_x" value="${area.coords.x}" onchange="editor.updateSceneFromProps()"></div>
          <div class="editor-group" style="flex:1;"><label>Y</label><input type="number" id="prop_y" value="${area.coords.y}" onchange="editor.updateSceneFromProps()"></div>
        </div>
        ${isCircle
          ? `<div class="editor-group"><label>Radio</label><input type="number" id="prop_r" value="${area.coords.r}" onchange="editor.updateSceneFromProps()"></div>`
          : `<div style="display:flex;gap:0.5rem;"><div class="editor-group" style="flex:1;"><label>Ancho</label><input type="number" id="prop_w" value="${area.coords.w}" onchange="editor.updateSceneFromProps()"></div><div class="editor-group" style="flex:1;"><label>Alto</label><input type="number" id="prop_h" value="${area.coords.h}" onchange="editor.updateSceneFromProps()"></div></div>`
        }
        <div class="editor-group">
          <label>Objeto en el suelo</label>
          <select id="prop_ground" onchange="editor.updateSceneFromProps()">
            <option value="">Ninguno</option>
            ${(this.campaign.items || []).map(it => `<option value="${this._esc(it.id)}" ${area.object_on_ground===it.id?'selected':''}>${this._esc(it.name)}</option>`).join('')}
          </select>
        </div>
        <div class="editor-group" id="decor-select-group" ${area.object_on_ground ? 'style="display:none;"' : ''}>
          <label>Icono decorativo</label>
          <select id="prop_decor_icon" onchange="editor.updateSceneFromProps()">
            <option value="">Ninguno (área debug)</option>
            <option value="door" ${area.icon==='door'?'selected':''}>🚪 Puerta</option>
            <option value="window" ${area.icon==='window'?'selected':''}>🪟 Ventana</option>
            <option value="table" ${area.icon==='table'?'selected':''}>🪑 Mesa</option>
            <option value="wardrobe" ${area.icon==='wardrobe'?'selected':''}>👕 Armario</option>
            <option value="bookshelf" ${area.icon==='bookshelf'?'selected':''}>📚 Estantería</option>
            <option value="tv" ${area.icon==='tv'?'selected':''}>📺 Televisor</option>
            <option value="lamp_table" ${area.icon==='lamp_table'?'selected':''}>🛋️ Lámpara mesa</option>
            <option value="lamp_floor" ${area.icon==='lamp_floor'?'selected':''}>🕯️ Lámpara pie</option>
            <option value="chest_static" ${area.icon==='chest_static'?'selected':''}>🧰 Baúl</option>
            <option value="chair" ${area.icon==='chair'?'selected':''}>🪑 Silla</option>
            <option value="staircase" ${area.icon==='staircase'?'selected':''}>🪜 Escaleras</option>
            <option value="fireplace" ${area.icon==='fireplace'?'selected':''}>🔥 Chimenea</option>
          </select>
        </div>

        <h5 style="color:var(--text-muted);margin:0.8rem 0 0.3rem;font-size:0.85rem;">⚡ Al hacer click</h5>
        <div id="area-actions-block"></div>
      `;
      this.renderActionBlock('area-actions-block', condBlock, { allowSceneChange: true });
    } else if (el.type === 'npc') {
      const inst = loc.npc_instances[el.index];
      const globalNpc = (this.campaign.npcs || []).find(n => n.id === inst.ref);
      const npcOpts = (this.campaign.npcs || []).map(n => `<option value="${this._esc(n.id)}" ${(inst.ref===n.id)?'selected':''}>${this._esc(n.name)}</option>`).join('');
      const condBlock = inst.on_click || { actions: [] };

      container.innerHTML = `
        <h5 style="color:var(--accent);margin:0.5rem 0;">NPC: ${this._esc(globalNpc ? globalNpc.name : inst.ref)}</h5>
        <div class="editor-group"><label>Referencia</label><select id="prop_npref" onchange="editor.updateSceneFromProps()">${npcOpts}</select></div>
        <div style="display:flex;gap:0.5rem;">
          <div class="editor-group" style="flex:1;"><label>X</label><input type="number" id="prop_npx" value="${inst.position.x}" onchange="editor.updateSceneFromProps()"></div>
          <div class="editor-group" style="flex:1;"><label>Y</label><input type="number" id="prop_npy" value="${inst.position.y}" onchange="editor.updateSceneFromProps()"></div>
        </div>
        <div class="editor-group"><label>Escala</label><input type="number" id="prop_npscale" value="${inst.scale || 1.0}" step="0.1" min="0.2" max="5.0" onchange="editor.updateSceneFromProps()"></div>

        <h5 style="color:var(--text-muted);margin:0.8rem 0 0.3rem;font-size:0.85rem;">⚡ Al hacer click (sobrescribe global)</h5>
        <div id="npc-actions-block"></div>
      `;
      this.renderActionBlock('npc-actions-block', condBlock, { allowSceneChange: true });
    }
  }

  updateSceneFromProps() {
    const loc = this.campaign.locations.find(l => l.id === this.selectedLocId);
    if (!loc || !this._selectedSceneElement) return;
    const el = this._selectedSceneElement;
    if (el.type === 'area') {
      const area = loc.clickable_areas[el.index];
      area.id = document.getElementById('prop_aid').value;
      area.coords.x = parseInt(document.getElementById('prop_x').value) || 0;
      area.coords.y = parseInt(document.getElementById('prop_y').value) || 0;
      if (area.shape === 'rect') {
        area.coords.w = parseInt(document.getElementById('prop_w').value) || 10;
        area.coords.h = parseInt(document.getElementById('prop_h').value) || 10;
      } else {
        area.coords.r = parseInt(document.getElementById('prop_r').value) || 5;
      }
      const groundVal = document.getElementById('prop_ground')?.value;
      area.object_on_ground = groundVal || null;
      const decorGroup = document.getElementById('decor-select-group');
      if (decorGroup) {
        if (groundVal) {
          area.icon = null;
          decorGroup.style.display = 'none';
        } else {
          decorGroup.style.display = '';
        }
      }
      const decorVal = document.getElementById('prop_decor_icon')?.value;
      area.icon = decorVal || null;
    } else if (el.type === 'npc') {
      const inst = loc.npc_instances[el.index];
      inst.ref = document.getElementById('prop_npref').value;
      inst.position.x = parseInt(document.getElementById('prop_npx').value) || 0;
      inst.position.y = parseInt(document.getElementById('prop_npy').value) || 0;
      const scaleEl = document.getElementById('prop_npscale');
      if (scaleEl) {
        let newScale = parseFloat(scaleEl.value) || 1.0;
        if (newScale < 0.2) newScale = 0.2;
        if (newScale > 5.0) newScale = 5.0;
        inst.scale = newScale;
      }
    }
    this._drawScene();
    this._doAutoSave();
  }

  addSceneArea(shape) {
    const loc = this.campaign.locations.find(l => l.id === this.selectedLocId);
    if (!loc) return;
    if (!loc.clickable_areas) loc.clickable_areas = [];
    const idx = loc.clickable_areas.length + 1;
    const area = {
      id: 'Zona_' + idx,
      shape: shape,
      coords: shape === 'circle' ? { x: 200, y: 150, r: 15 } : { x: 150, y: 100, w: 80, h: 60 },
      object_on_ground: null,
      on_click: { actions: [{ type: 'text', value: 'Has hecho click' }] }
    };
    loc.clickable_areas.push(area);
    this._selectedSceneElement = { type: 'area', index: loc.clickable_areas.length - 1 };
    this._drawScene();
    this._renderSceneProperties();
  }

  addSceneNpc() {
    const loc = this.campaign.locations.find(l => l.id === this.selectedLocId);
    if (!loc) return;
    if (!loc.npc_instances) loc.npc_instances = [];
    const firstNpc = (this.campaign.npcs || [])[0];
    const ref = firstNpc ? firstNpc.id : 'npc_1';
    loc.npc_instances.push({
      ref: ref,
      position: { x: 200, y: 150 },
      scale: 1.0
    });
    this._selectedSceneElement = { type: 'npc', index: loc.npc_instances.length - 1 };
    this._drawScene();
    this._renderSceneProperties();
  }

  addSceneItem() {
    // Creates an area with object_on_ground that adds the first item
    const loc = this.campaign.locations.find(l => l.id === this.selectedLocId);
    if (!loc) return;
    if (!loc.clickable_areas) loc.clickable_areas = [];
    const firstItem = this.campaign.items[0];
    const itemId = firstItem ? firstItem.id : 'item_1';
    loc.clickable_areas.push({
      id: 'Item_' + (loc.clickable_areas.length + 1),
      shape: 'circle',
      coords: { x: 200, y: 150, r: 12 },
      object_on_ground: itemId,
      on_click: {
        actions: [
          { type: 'text', value: '¡Has encontrado un objeto!' }
        ]
      }
    });
    this._selectedSceneElement = { type: 'area', index: loc.clickable_areas.length - 1 };
    this._drawScene();
    this._renderSceneProperties();
  }

  deleteSelectedSceneElement() {
    const loc = this.campaign.locations.find(l => l.id === this.selectedLocId);
    if (!loc || !this._selectedSceneElement) return;
    const el = this._selectedSceneElement;
    if (el.type === 'area') {
      loc.clickable_areas.splice(el.index, 1);
    } else if (el.type === 'npc') {
      loc.npc_instances.splice(el.index, 1);
    }
    this._selectedSceneElement = null;
    this._drawScene();
    this._renderSceneProperties();
  }

  // ═══════════════════════════════════════════════════════════════
  //  ITEM FORM
  // ═══════════════════════════════════════════════════════════════

  renderItemForm(item) {
    const gps = item.gps || {};
    const type = gps.type || 'none';
    let gpsFields = '';
    if (type === 'relative') {
      gpsFields = `
        <div class="editor-group"><label>Rumbo (grados)</label><input type="number" id="form_bearing" value="${gps.bearing_degrees || 0}"></div>
        <div class="editor-group"><label>Distancia (metros)</label><input type="number" id="form_distance" value="${gps.distance_meters || 0}"></div>
      `;
    } else if (type === 'absolute') {
      gpsFields = `
        <div class="editor-group"><label>Latitud</label><input type="number" step="0.000001" id="form_lat" value="${gps.lat || 0}"></div>
        <div class="editor-group"><label>Longitud</label><input type="number" step="0.000001" id="form_lng" value="${gps.lng || 0}"></div>
      `;
    }
    const pickupBlock = item.on_pickup || { text: '', actions: [] };
    const useBlock = item.on_use || { text: '', actions: [] };

    document.getElementById('editor-form').innerHTML = `
      <h3 style="color:var(--accent);margin-bottom:1rem;">${this._esc(item.name)}</h3>

      <div class="editor-group"><label>ID (readonly)</label><input type="text" id="form_id" value="${this._esc(item.id)}" disabled></div>
      <div class="editor-group"><label>Nombre</label><input type="text" id="form_name" value="${this._esc(item.name)}"></div>
      <div class="editor-group"><label>Descripción</label><textarea id="form_desc">${this._esc(item.description || '')}</textarea></div>
      <div class="editor-group"><label>Icono</label><select id="form_icon" onchange="editor.onItemIconChange(this.value)"><option value="coin" ${item.icon==='coin'?'selected':''}>🪙 Moneda</option><option value="key" ${item.icon==='key'?'selected':''}>🗝️ Llave</option><option value="chest" ${item.icon==='chest'?'selected':''}>📦 Cofre</option><option value="gem" ${item.icon==='gem'?'selected':''}>💎 Gema</option><option value="scroll" ${item.icon==='scroll'?'selected':''}>📜 Pergamino</option><option value="potion" ${item.icon==='potion'?'selected':''}>🧪 Poción</option><option value="book" ${item.icon==='book'?'selected':''}>📖 Libro</option><option value="cryptex" ${item.icon==='cryptex'?'selected':''}>🔐 Cryptex</option><option value="paper" ${item.icon==='paper'?'selected':''}>📝 Hoja</option><option value="carrot" ${item.icon==='carrot'?'selected':''}>🥕 Zanahoria</option></select></div>

      <div class="editor-group">
        <label style="display:flex;align-items:center;gap:0.4rem;cursor:pointer;">
          <input type="checkbox" id="form_consumable" ${item.consumable ? 'checked' : ''}>
          Consumible (desaparece al usar)
        </label>
      </div>

      <h4 style="color:var(--text-muted);margin:1rem 0 0.5rem;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:0.3rem;">📍 GPS (opcional)</h4>
      <div class="editor-group"><label>Tipo</label><select id="form_gps_type" onchange="editor.onItemGpsTypeChange()"><option value="relative" ${type==='relative'?'selected':''}>Relativo al jugador</option><option value="absolute" ${type==='absolute'?'selected':''}>Absoluto (lat/lng)</option><option value="none" ${type==='none'?'selected':''}>Sin GPS</option></select></div>
      ${type !== 'none' ? `<div id="gps-fields">${gpsFields}</div>` : ''}
      <div class="editor-group"><label>Radio de recogida (metros)</label><input type="number" id="form_pickup_radius" value="${gps.pickup_radius_meters || 30}"></div>
      <div class="editor-group"><label>Radio de visibilidad (metros)</label><input type="number" id="form_visibility_radius" value="${gps.visibility_radius_meters != null ? gps.visibility_radius_meters : ''}" placeholder="Vacío = siempre visible"></div>

      <h4 style="color:var(--text-muted);margin:1rem 0 0.5rem;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:0.3rem;">👁️ Condición de visibilidad</h4>
      <div style="margin-bottom:0.5rem;">
        <label style="display:flex;align-items:center;gap:0.4rem;color:var(--text-muted);font-size:0.85rem;cursor:pointer;">
          <input type="checkbox" id="form_has_visible_condition" ${item.visible_condition ? 'checked' : ''} onchange="editor.toggleVisibleCondition()">
          Solo mostrar bajo condición
        </label>
      </div>
      <div id="visible-condition-fields" style="${item.visible_condition ? '' : 'display:none;'}">
        ${this._buildConditionRowsHTML(item.visible_condition || {conditions:[{}]}, 'item')}
        <button class="btn btn-sm btn-secondary" style="margin-top:0.5rem;" onclick="editor._addConditionRow('item-conditions-container', 'item')">+ Añadir condición</button>
      </div>

      <h4 style="color:var(--text-muted);margin:1rem 0 0.5rem;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:0.3rem;">🎒 Al recoger</h4>
      <div id="item-onpickup-block"></div>

      <h4 style="color:var(--text-muted);margin:1rem 0 0.5rem;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:0.3rem;">🖱️ Al usar desde inventario</h4>
      <div id="item-onuse-block"></div>

      <h4 style="color:var(--text-muted);margin:1rem 0 0.5rem;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:0.3rem;">🎮 Minijuego</h4>
      <div style="margin-bottom:0.5rem;">
        <label style="display:flex;align-items:center;gap:0.4rem;color:var(--text-muted);font-size:0.85rem;cursor:pointer;">
          <input type="checkbox" id="form_has_minigame" ${item.minigame ? 'checked' : ''} onchange="editor.toggleMinigameSection()">
          Este item abre un minijuego al usarlo
        </label>
      </div>
      <div id="minigame-fields" style="${item.minigame ? '' : 'display:none;'}">
        <div class="editor-group"><label>Tipo</label><select id="form_minigame_type" onchange="editor.onMinigameTypeChange()"><option value="cryptex" ${(item.minigame?.type)==='cryptex'?'selected':''}>Criptex</option></select></div>
        <div id="minigame-cryptex-config">
          <div class="editor-group"><label>Símbolos (cadena de caracteres)</label><input type="text" id="form_minigame_symbols" value="${this._esc(item.minigame?.symbols || 'ABCDEFGHI')}" placeholder="Ej: ABCDEFGHI o 🗝⚔🛡💎🔮" oninput="editor._onCryptexSymbolsChange()"></div>
          <div class="editor-group"><label>Número de ruedas</label><input type="number" id="form_minigame_wheels" value="${item.minigame?.wheels || 3}" min="1" max="10" oninput="editor._onCryptexWheelsChange()"></div>
          <div style="margin:1rem 0;">
            <label style="color:var(--text-muted);font-size:0.85rem;display:block;margin-bottom:0.5rem;">Ajusta las ruedas a la posición correcta. La configuración actual es la solución:</label>
            <div id="cryptex-editor-preview"></div>
            <div id="cryptex-solution-display" style="font-size:0.8rem;color:var(--text-muted);margin-top:0.5rem;text-align:center;"></div>
          </div>
        </div>
        <h4 style="color:var(--text-muted);margin:1rem 0 0.5rem;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:0.3rem;">🏆 Al acertar</h4>
        <div id="minigame-success-block"></div>
      </div>

      <div style="height:2rem;"></div>
    `;

    this.renderActionBlock('item-onpickup-block', pickupBlock, { allowSceneChange: true });
    this.renderActionBlock('item-onuse-block', useBlock, { allowSceneChange: true });
    if (item.minigame) {
      this.renderActionBlock('minigame-success-block', item.minigame.on_success || { text: '', actions: [] }, { allowSceneChange: true });
      this._initCryptexEditorPositions();
      this.renderCryptexEditor();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  NPC FORM
  // ═══════════════════════════════════════════════════════════════

  renderNpcForm(npc) {
    const gps = npc.gps || {};
    const type = gps.type || '';
    let gpsFields = '';
    if (type === 'relative') {
      gpsFields = `
        <div class="editor-group"><label>Rumbo (grados)</label><input type="number" id="form_bearing" value="${gps.bearing_degrees || 0}"></div>
        <div class="editor-group"><label>Distancia (metros)</label><input type="number" id="form_distance" value="${gps.distance_meters || 0}"></div>
      `;
    } else if (type === 'absolute') {
      gpsFields = `
        <div class="editor-group"><label>Latitud</label><input type="number" step="0.000001" id="form_lat" value="${gps.lat || 0}"></div>
        <div class="editor-group"><label>Longitud</label><input type="number" step="0.000001" id="form_lng" value="${gps.lng || 0}"></div>
      `;
    }
    const interactBlock = npc.on_interact || { text: '', actions: [] };

    document.getElementById('editor-form').innerHTML = `
      <h3 style="color:var(--accent);margin-bottom:1rem;">${this._esc(npc.name)}</h3>

      <div class="editor-group"><label>ID (readonly)</label><input type="text" id="form_id" value="${this._esc(npc.id)}" disabled></div>
      <div class="editor-group"><label>Nombre</label><input type="text" id="form_name" value="${this._esc(npc.name)}"></div>
      <div class="editor-group"><label>Descripción</label><textarea id="form_desc">${this._esc(npc.description || '')}</textarea></div>
      <div class="editor-group"><label>Icono</label><select id="form_icon" onchange="editor.onNpcIconChange(this.value)"><option value="merchant" ${npc.icon==='merchant'?'selected':''}>🧙 Mercader</option><option value="guard" ${npc.icon==='guard'?'selected':''}>⚔️ Guardia</option><option value="rat" ${npc.icon==='rat'?'selected':''}>🐀 Ratón</option><optgroup label="Chicos"><option value="chico1" ${npc.icon==='chico1'?'selected':''}>👦 Chico 1</option><option value="chico2" ${npc.icon==='chico2'?'selected':''}>👦 Chico 2</option><option value="chico3" ${npc.icon==='chico3'?'selected':''}>👦 Chico 3</option><option value="chico4" ${npc.icon==='chico4'?'selected':''}>👦 Chico 4</option><option value="chico5" ${npc.icon==='chico5'?'selected':''}>👦 Chico 5</option></optgroup><optgroup label="Chicas"><option value="chica1" ${npc.icon==='chica1'?'selected':''}>👧 Chica 1</option><option value="chica2" ${npc.icon==='chica2'?'selected':''}>👧 Chica 2</option><option value="chica3" ${npc.icon==='chica3'?'selected':''}>👧 Chica 3</option><option value="chica4" ${npc.icon==='chica4'?'selected':''}>👧 Chica 4</option><option value="chica5" ${npc.icon==='chica5'?'selected':''}>👧 Chica 5</option></optgroup><optgroup label="Chiques"><option value="chique1" ${npc.icon==='chique1'?'selected':''}>🧑 Chique 1</option><option value="chique2" ${npc.icon==='chique2'?'selected':''}>🧑 Chique 2</option><option value="chique3" ${npc.icon==='chique3'?'selected':''}>🧑 Chique 3</option><option value="chique4" ${npc.icon==='chique4'?'selected':''}>🧑 Chique 4</option><option value="chique5" ${npc.icon==='chique5'?'selected':''}>🧑 Chique 5</option></optgroup><optgroup label="Perros"><option value="perro1" ${npc.icon==='perro1'?'selected':''}>🐕 Perro 1</option><option value="perro2" ${npc.icon==='perro2'?'selected':''}>🐕 Perro 2</option><option value="perro3" ${npc.icon==='perro3'?'selected':''}>🐕 Perro 3</option><option value="perro4" ${npc.icon==='perro4'?'selected':''}>🐕 Perro 4</option><option value="perro5" ${npc.icon==='perro5'?'selected':''}>🐕 Perro 5</option></optgroup><optgroup label="Gatos"><option value="gato1" ${npc.icon==='gato1'?'selected':''}>🐈 Gato 1</option><option value="gato2" ${npc.icon==='gato2'?'selected':''}>🐈 Gato 2</option><option value="gato3" ${npc.icon==='gato3'?'selected':''}>🐈 Gato 3</option><option value="gato4" ${npc.icon==='gato4'?'selected':''}>🐈 Gato 4</option><option value="gato5" ${npc.icon==='gato5'?'selected':''}>🐈 Gato 5</option></optgroup><optgroup label="Granja"><option value="gallina" ${npc.icon==='gallina'?'selected':''}>🐔 Gallina</option><option value="gallo" ${npc.icon==='gallo'?'selected':''}>🐓 Gallo</option><option value="vaca1" ${npc.icon==='vaca1'?'selected':''}>🐄 Vaca 1</option><option value="vaca2" ${npc.icon==='vaca2'?'selected':''}>🐄 Vaca 2</option><option value="toro" ${npc.icon==='toro'?'selected':''}>🐂 Toro</option><option value="caballo1" ${npc.icon==='caballo1'?'selected':''}>🐎 Caballo 1</option><option value="caballo2" ${npc.icon==='caballo2'?'selected':''}>🐎 Caballo 2</option><option value="caballo3" ${npc.icon==='caballo3'?'selected':''}>🐎 Caballo 3</option><option value="cerdo" ${npc.icon==='cerdo'?'selected':''}>🐖 Cerdo</option><option value="burro" ${npc.icon==='burro'?'selected':''}>🫏 Burro</option><option value="mula" ${npc.icon==='mula'?'selected':''}>🫏 Mula</option><option value="cabra_macho" ${npc.icon==='cabra_macho'?'selected':''}>🐐 Cabra Macho</option><option value="cabra_hembra" ${npc.icon==='cabra_hembra'?'selected':''}>🐐 Cabra Hembra</option></optgroup><optgroup label="Objetos"><option value="cartel" ${npc.icon==='cartel'?'selected':''}>🪧 Cartel</option><option value="papel" ${npc.icon==='papel'?'selected':''}>📄 Papel</option></optgroup></select></div>

      <h4 style="color:var(--text-muted);margin:1rem 0 0.5rem;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:0.3rem;">📍 GPS (opcional)</h4>
      <div class="editor-group"><label>Tipo</label><select id="form_gps_type" onchange="editor.onNpcGpsTypeChange()"><option value="" ${type===''?'selected':''}>Sin GPS</option><option value="relative" ${type==='relative'?'selected':''}>Relativo al jugador</option><option value="absolute" ${type==='absolute'?'selected':''}>Absoluto (lat/lng)</option></select></div>
      ${type !== '' ? `<div id="gps-fields">${gpsFields}</div>` : ''}
      <div class="editor-group"><label>Radio de interacción (metros)</label><input type="number" id="form_interact_radius" value="${gps.interact_radius_meters || 30}"></div>

      <h4 style="color:var(--text-muted);margin:1rem 0 0.5rem;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:0.3rem;">👁️ Condición de visibilidad</h4>
      <div style="margin-bottom:0.5rem;">
        <label style="display:flex;align-items:center;gap:0.4rem;color:var(--text-muted);font-size:0.85rem;cursor:pointer;">
          <input type="checkbox" id="form_npc_has_visible_condition" ${npc.visible_condition ? 'checked' : ''} onchange="editor.toggleNpcVisibleCondition()">
          Solo mostrar bajo condición
        </label>
      </div>
      <div id="npc-visible-condition-fields" style="${npc.visible_condition ? '' : 'display:none;'}">
        ${this._buildConditionRowsHTML(npc.visible_condition || {conditions:[{}]}, 'npc')}
        <button class="btn btn-sm btn-secondary" style="margin-top:0.5rem;" onclick="editor._addConditionRow('npc-conditions-container', 'npc')">+ Añadir condición</button>
      </div>

      <h4 style="color:var(--text-muted);margin:1rem 0 0.5rem;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:0.3rem;">💬 Al interactuar</h4>
      <div id="npc-oninteract-block"></div>

      <div style="height:2rem;"></div>
    `;

    this.renderActionBlock('npc-oninteract-block', interactBlock, { allowSceneChange: true });
  }

  // ═══════════════════════════════════════════════════════════════
  //  EVENT FORM
  // ═══════════════════════════════════════════════════════════════

  renderEventForm(evt) {
    document.getElementById('editor-form').innerHTML = `
      <h3 style="color:var(--accent);margin-bottom:1rem;">Evento: ${this._esc(evt.id)}</h3>

      <div class="editor-group"><label>ID (readonly)</label><input type="text" id="form_id" value="${this._esc(evt.id)}" disabled></div>

      <h4 style="color:var(--text-muted);margin:1rem 0 0.5rem;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:0.3rem;">⚡ Acciones del evento</h4>
      <div id="event-actions-block"></div>

      <div style="height:2rem;"></div>
    `;
    const eventBlock = Array.isArray(evt.actions) ? { actions: evt.actions } : (evt.actions || { actions: [] });
    this.renderActionBlock('event-actions-block', eventBlock, { allowSceneChange: true });
  }

  // ═══════════════════════════════════════════════════════════════
  //  CONFIG FORM
  // ═══════════════════════════════════════════════════════════════

  renderConfigForm() {
    const m = this.campaign.metadata;
    const inv = this.campaign.inventory_rules || {};
    const startOpts = this.campaign.locations.map(l => `<option value="${this._esc(l.id)}" ${m.starting_location_id===l.id?'selected':''}>${this._esc(l.name)} (${this._esc(l.id)})</option>`).join('');
    const startLocOptions = `<option value="" ${!m.starting_location_id?'selected':''}>🗺️ Mapa GPS (sin ubicación inicial)</option>` + startOpts;
    const gpsType = this.campaign.gps_type || 'relative';
    const isPublic = this.campaign.is_public || false;
    const origin = this.campaign.origin || { lat: 40.4168, lng: -3.7038 };
    const originDisplay = gpsType === 'absolute' ? '' : 'display:none;';

    document.getElementById('editor-form').innerHTML = `
      <h3 style="color:var(--accent);margin-bottom:1rem;">Configuración de Campaña</h3>

      <div class="editor-group"><label>Campaign ID (readonly)</label><input type="text" id="form_campaign_id" value="${this._esc(this.campaign.campaign_id)}" disabled></div>
      <div class="editor-group"><label>Título</label><input type="text" id="form_title" value="${this._esc(m.title)}"></div>
      <div class="editor-group"><label>Descripción</label><textarea id="form_campaign_desc">${this._esc(m.description || '')}</textarea></div>
      <div class="editor-group"><label>Versión</label><input type="text" id="form_version" value="${this._esc(m.version)}"></div>
      <div class="editor-group"><label>Idioma</label><input type="text" id="form_language" value="${this._esc(m.language)}"></div>
      <div class="editor-group"><label>Dificultad</label><select id="form_difficulty"><option value="easy" ${m.difficulty==='easy'?'selected':''}>Fácil</option><option value="medium" ${m.difficulty==='medium'?'selected':''}>Medio</option><option value="hard" ${m.difficulty==='hard'?'selected':''}>Difícil</option></select></div>
      <div class="editor-group"><label>Minutos estimados</label><input type="number" id="form_estimated" value="${m.estimated_minutes || 0}"></div>
      <div class="editor-group"><label>Ubicación inicial</label><select id="form_start_loc">${startLocOptions}</select></div>
      <div class="editor-group"><label>Slots de inventario</label><input type="number" id="form_max_slots" value="${inv.max_slots || 6}"></div>

      <hr style="border-color:rgba(255,255,255,0.1);margin:1.5rem 0;">
      <h4 style="color:var(--accent);margin-bottom:1rem;">☁️ Configuración de Nube</h4>

      <div class="editor-group"><label>Tipo de GPS</label>
        <select id="form_gps_type" onchange="editor._onGpsTypeChange()">
          <option value="relative" ${gpsType==='relative'?'selected':''}>📍 Relativo (a partir de un origen)</option>
          <option value="absolute" ${gpsType==='absolute'?'selected':''}>🌍 Absoluto (coordenadas GPS reales)</option>
        </select>
      </div>
      <div class="editor-group" id="form_origin_group" style="${originDisplay}">
        <label>Origen (lat, lng) - solo para relativas</label>
        <div style="display:flex;gap:0.5rem;">
          <input type="number" id="form_origin_lat" step="0.000001" value="${origin.lat}" placeholder="Lat">
          <input type="number" id="form_origin_lng" step="0.000001" value="${origin.lng}" placeholder="Lng">
        </div>
        <small style="color:var(--text-muted);display:block;margin-top:0.3rem;">Arrastra el marcador ★ en el mapa para mover el origen.</small>
      </div>
      <div class="editor-group">
        <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
          <input type="checkbox" id="form_is_public" ${isPublic?'checked':''}>
          <span>🌐 Pública (visible en listados públicos)</span>
        </label>
      </div>

      <div style="display:flex;gap:0.5rem;margin-top:1rem;">
        <button class="btn btn-sm btn-primary" style="flex:1;background:#3498db;" onclick="editor.uploadCampaign()">☁️ Subir</button>
        <button class="btn btn-sm btn-primary" style="flex:1;background:#1abc9c;" onclick="editor.showMyCampaigns()">📥 Mis campañas</button>
      </div>
      <div style="display:flex;gap:0.5rem;margin-top:0.5rem;">
        <button class="btn btn-sm btn-secondary" style="flex:1;" onclick="editor.forkCampaign()">🍴 Fork (copiar)</button>
      </div>
    `;
  }

  // ═══════════════════════════════════════════════════════════════
  //  ACTION BLOCK EDITOR (with optional condition)
  // ═══════════════════════════════════════════════════════════════

  renderActionBlock(containerId, block, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const hasCondition = !!block.condition;

    let html = '';
    html += `
      <div style="margin-bottom:0.5rem;">
        <label style="display:flex;align-items:center;gap:0.4rem;color:var(--text-muted);font-size:0.85rem;cursor:pointer;">
          <input type="checkbox" id="${containerId}-hascond" ${hasCondition ? 'checked' : ''} onchange="editor.toggleCondition('${containerId}')">
          Requiere condición
        </label>
      </div>
    `;

    if (hasCondition) {
      html += `<div style="border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:0.5rem;margin-bottom:0.5rem;">`;
      html += this._buildActionConditionHTML(block.condition, containerId);
      html += `</div>`;

      html += `<div style="margin:0.5rem 0;color:#2ecc71;font-size:0.85rem;">✅ Si se cumple:</div>`;
      html += `<div id="${containerId}-if-actions"></div>`;
      html += `<div style="margin:0.5rem 0;color:#e74c3c;font-size:0.85rem;">❌ Si NO se cumple:</div>`;
      html += `<div id="${containerId}-else-actions"></div>`;
    } else {
      html += `<div id="${containerId}-actions"></div>`;
    }

    container.innerHTML = html;

    if (hasCondition) {
      this.renderActions(`${containerId}-if-actions`, block.actions || [], options);
      this.renderActions(`${containerId}-else-actions`, block.else?.actions || [], options);
    } else {
      this.renderActions(`${containerId}-actions`, block.actions || [], options);
    }
    this._attachAutoSave();
  }

  _buildActionConditionHTML(cond, containerId) {
    const conditions = cond.conditions || [cond];
    const operator = cond.operator || 'and';
    const showOp = conditions.length >= 2 || !!cond.operator;
    let html = '';

    html += `<div id="${containerId}-operator-fields" style="${showOp ? '' : 'display:none;'}margin-bottom:0.5rem;">`;
    html += `<label style="color:var(--text-muted);font-size:0.85rem;">Operador</label>`;
    html += `<select id="${containerId}-operator">`;
    html += `<option value="and" ${operator==='and'?'selected':''}>AND (todas)</option>`;
    html += `<option value="nand" ${operator==='nand'?'selected':''}>NAND (no todas)</option>`;
    html += `<option value="or" ${operator==='or'?'selected':''}>OR (alguna)</option>`;
    html += `<option value="nor" ${operator==='nor'?'selected':''}>NOR (ninguna)</option>`;
    html += `</select></div>`;

    html += `<div id="${containerId}-conditions-container">`;
    for (let i = 0; i < conditions.length; i++) {
      html += this._buildSingleConditionRowHTML(conditions[i], containerId, i);
    }
    html += `</div>`;

    html += `<button class="btn btn-sm btn-secondary" style="margin-top:0.5rem;" onclick="editor._addConditionRow('${containerId}-conditions-container', '${containerId}')">+ Añadir condición</button>`;

    return html;
  }

  toggleCondition(containerId) {
    const hasCond = document.getElementById(`${containerId}-hascond`).checked;
    let block = { actions: [] };
    if (hasCond) {
      block = {
        condition: { var: '', eq: true },
        actions: [],
        else: { actions: [] }
      };
    }
    const currentActions = this._collectActionsFromDOM(hasCond ? `${containerId}-if-actions` : `${containerId}-actions`);
    const currentElse = hasCond ? this._collectActionsFromDOM(`${containerId}-else-actions`) : [];
    block.actions = currentActions;
    if (hasCond) block.else = { actions: currentElse };
    this.renderActionBlock(containerId, block);
    this._doAutoSave();
  }

  toggleVisibleCondition() {
    const hasCond = document.getElementById('form_has_visible_condition').checked;
    const fields = document.getElementById('visible-condition-fields');
    if (fields) fields.style.display = hasCond ? '' : 'none';
    this._doAutoSave();
  }

  toggleNpcVisibleCondition() {
    const hasCond = document.getElementById('form_npc_has_visible_condition').checked;
    const fields = document.getElementById('npc-visible-condition-fields');
    if (fields) fields.style.display = hasCond ? '' : 'none';
    this._doAutoSave();
  }

  toggleLocVisibleCondition() {
    const hasCond = document.getElementById('form_loc_has_visible_condition').checked;
    const fields = document.getElementById('loc-visible-condition-fields');
    if (fields) fields.style.display = hasCond ? '' : 'none';
    this._doAutoSave();
  }

  toggleMinigameSection() {
    const hasMg = document.getElementById('form_has_minigame')?.checked;
    const fields = document.getElementById('minigame-fields');
    if (fields) {
      fields.style.display = hasMg ? '' : 'none';
      // Re-render success action block when showing
      if (hasMg) {
        const item = this.campaign.items.find(i => i.id === this.selectedItemId);
        this.renderActionBlock('minigame-success-block', item?.minigame?.on_success || { text: '', actions: [] }, { allowSceneChange: true });
        this._initCryptexEditorPositions();
        this.renderCryptexEditor();
      }
    }
    this._doAutoSave();
  }

  onMinigameTypeChange() {
    const type = document.getElementById('form_minigame_type')?.value;
    const cryptexConfig = document.getElementById('minigame-cryptex-config');
    if (cryptexConfig) cryptexConfig.style.display = type === 'cryptex' ? '' : 'none';
    if (type === 'cryptex') {
      this._initCryptexEditorPositions();
      this.renderCryptexEditor();
    }
    this._doAutoSave();
  }

  _initCryptexEditorPositions() {
    const item = this.campaign.items.find(i => i.id === this.selectedItemId);
    if (!item || !item.minigame) return;
    const wheels = item.minigame.wheels || 3;
    const solution = Array.isArray(item.minigame.solution) ? item.minigame.solution : [];
    // Ensure positions array matches wheels count
    if (!this._cryptexEditorPositions || this._cryptexEditorPositions.length !== wheels) {
      this._cryptexEditorPositions = solution.length === wheels ? [...solution] : new Array(wheels).fill(0);
    }
  }

  renderCryptexEditor() {
    const item = this.campaign.items.find(i => i.id === this.selectedItemId);
    if (!item || !item.minigame) return;
    const container = document.getElementById('cryptex-editor-preview');
    if (!container) return;
    const symbols = item.minigame.symbols || 'ABCDEFGHI';
    const wheels = item.minigame.wheels || 3;
    if (!this._cryptexEditorPositions || this._cryptexEditorPositions.length !== wheels) {
      this._initCryptexEditorPositions();
    }
    const positions = this._cryptexEditorPositions;
    // Update solution display text
    const solDisplay = document.getElementById('cryptex-solution-display');
    if (solDisplay) {
      solDisplay.textContent = `Solución: [${positions.join(', ')}]`;
    }
    let html = '<div style="display:flex;justify-content:center;gap:1rem;flex-wrap:wrap;padding:1rem;background:rgba(0,0,0,0.3);border-radius:8px;border:1px solid var(--accent);">';
    for (let w = 0; w < wheels; w++) {
      const pos = positions[w];
      const len = symbols.length;
      const prev = symbols[(pos - 1 + len) % len];
      const curr = symbols[pos];
      const next = symbols[(pos + 1) % len];
      html += `
        <div style="display:flex;flex-direction:column;align-items:center;gap:0.3rem;">
          <button class="btn btn-sm" onclick="editor._onCryptexEditorWheelChange(${w}, -1)" style="width:40px;height:30px;padding:0;font-size:1rem;background:var(--btn-secondary);color:var(--text);">▲</button>
          <div style="display:flex;flex-direction:column;align-items:center;background:rgba(0,0,0,0.5);border-radius:4px;padding:0.3rem 0.6rem;min-width:50px;">
            <div style="font-size:0.8rem;opacity:0.5;min-height:20px;">${this._esc(prev)}</div>
            <div style="font-size:1.5rem;color:var(--accent);font-weight:bold;min-height:28px;">${this._esc(curr)}</div>
            <div style="font-size:0.8rem;opacity:0.5;min-height:20px;">${this._esc(next)}</div>
          </div>
          <button class="btn btn-sm" onclick="editor._onCryptexEditorWheelChange(${w}, 1)" style="width:40px;height:30px;padding:0;font-size:1rem;background:var(--btn-secondary);color:var(--text);">▼</button>
        </div>
      `;
    }
    html += '</div>';
    container.innerHTML = html;
  }

  _onCryptexEditorWheelChange(wheelIndex, direction) {
    const item = this.campaign.items.find(i => i.id === this.selectedItemId);
    if (!item || !item.minigame) return;
    const symbols = item.minigame.symbols || 'ABCDEFGHI';
    const len = symbols.length;
    if (!this._cryptexEditorPositions) {
      this._initCryptexEditorPositions();
    }
    this._cryptexEditorPositions[wheelIndex] = (this._cryptexEditorPositions[wheelIndex] + direction + len) % len;
    this.renderCryptexEditor();
    this._doAutoSave();
  }

  _onCryptexSymbolsChange() {
    const item = this.campaign.items.find(i => i.id === this.selectedItemId);
    if (!item || !item.minigame) return;
    item.minigame.symbols = document.getElementById('form_minigame_symbols')?.value || 'ABCDEFGHI';
    // Reset positions if new symbol count is different
    this._initCryptexEditorPositions();
    this.renderCryptexEditor();
    this._doAutoSave();
  }

  _onCryptexWheelsChange() {
    const item = this.campaign.items.find(i => i.id === this.selectedItemId);
    if (!item || !item.minigame) return;
    const newWheels = parseInt(document.getElementById('form_minigame_wheels')?.value) || 3;
    item.minigame.wheels = newWheels;
    // Reset positions to match new wheel count
    this._cryptexEditorPositions = null;
    this._initCryptexEditorPositions();
    this.renderCryptexEditor();
    this._doAutoSave();
  }

  onItemIconChange(iconName) {
    const item = this.campaign.items.find(i => i.id === this.selectedItemId);
    if (item) {
      item.icon = iconName;
      this.updateItemMarker(item);
    }
    this._doAutoSave();
  }

  onNpcIconChange(iconName) {
    const npc = (this.campaign.npcs || []).find(n => n.id === this.selectedNpcId);
    if (npc) {
      npc.icon = iconName;
      this.updateNpcMarker(npc);
    }
    this._doAutoSave();
  }

  onLocationIconChange(iconName) {
    const loc = this.campaign.locations.find(l => l.id === this.selectedLocId);
    if (loc) {
      if (iconName) loc.icon = iconName;
      else delete loc.icon;
      this.updateLocationMarker(loc);
    }
    this._doAutoSave();
  }

  renderActions(containerId, actions, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let html = '<div class="actions-list">';
    for (let i = 0; i < actions.length; i++) {
      html += this._actionRowHTML(actions[i], i, containerId, options);
    }
    html += '</div>';
    html += `<button class="btn btn-sm btn-add" style="width:100%;margin-top:0.5rem;" onclick="editor.addAction('${containerId}')">+ Añadir Acción</button>`;
    container.innerHTML = html;
    this._attachAutoSave();
  }

  _actionRowHTML(action, index, containerId, options) {
    const type = action.type || 'text';
    let paramHTML = '';
    if (type === 'text') {
      paramHTML = `<input type="text" class="action-param" data-idx="${index}" data-container="${containerId}" data-field="value" value="${this._esc(action.value || '')}" placeholder="Texto...">`;
    } else if (type === 'add_item' || type === 'remove_item') {
      const itemOpts = this.campaign.items.map(it => `<option value="${this._esc(it.id)}" ${(action.item_id === it.id) ? 'selected' : ''}>${this._esc(it.name)}</option>`).join('');
      paramHTML = `<select class="action-param" data-idx="${index}" data-container="${containerId}" data-field="item_id">${itemOpts}</select>`;
    } else if (type === 'set_var') {
      paramHTML = `
        <input type="text" class="action-param" style="min-width:80px;" data-idx="${index}" data-container="${containerId}" data-field="key" value="${this._esc(action.key || '')}" placeholder="var">
        <input type="text" class="action-param" style="min-width:80px;" data-idx="${index}" data-container="${containerId}" data-field="value" value="${this._esc(String(action.value ?? ''))}" placeholder="valor">
      `;
    } else if (type === 'change_scene') {
      const locOpts = this.campaign.locations.map(l => `<option value="${this._esc(l.id)}" ${(action.target === l.id) ? 'selected' : ''}>${this._esc(l.name)}</option>`).join('');
      paramHTML = `<select class="action-param" data-idx="${index}" data-container="${containerId}" data-field="target">${locOpts}</select>`;
    } else if (type === 'trigger_event') {
      const evtOpts = (this.campaign.events || []).map(e => `<option value="${this._esc(e.id)}" ${(action.event_id === e.id) ? 'selected' : ''}>${this._esc(e.id)}</option>`).join('');
      paramHTML = `<select class="action-param" data-idx="${index}" data-container="${containerId}" data-field="event_id">${evtOpts}</select>`;
    } else if (type === 'play_audio') {
      paramHTML = `<input type="text" class="action-param" data-idx="${index}" data-container="${containerId}" data-field="src" value="${this._esc(action.src || '')}" placeholder="URL del audio">`;
    } else if (type === 'finish_campaign') {
      paramHTML = `<input type="text" class="action-param" data-idx="${index}" data-container="${containerId}" data-field="text" value="${this._esc(action.text || '')}" placeholder="Texto de despedida (opcional)">`;
    } else if (type === 'dialogue') {
      paramHTML = `
        <input type="text" class="action-param" style="min-width:120px;" data-idx="${index}" data-container="${containerId}" data-field="text" value="${this._esc(action.text || '')}" placeholder="Texto del diálogo">
        <input type="text" class="action-param" style="min-width:80px;" data-idx="${index}" data-container="${containerId}" data-field="speaker" value="${this._esc(action.speaker || '')}" placeholder="Personaje">
        <textarea class="action-param" style="min-width:120px;min-height:2rem;" data-idx="${index}" data-container="${containerId}" data-field="options" placeholder="Opciones (una por línea)">${this._esc((action.options || []).map(o => o.text).join('\n'))}</textarea>
      `;
    }

    const typeOpts = [
      ['text', 'Texto'], ['add_item', 'Añadir item'], ['remove_item', 'Quitar item'],
      ['set_var', 'Establecer var'], ['change_scene', 'Cambiar escena'],
      ['exit_scene', 'Salir de escena'], ['trigger_event', 'Evento'], ['play_audio', 'Audio'],
      ['dialogue', 'Diálogo'], ['finish_campaign', 'Terminar campaña']
    ].map(([v, l]) => `<option value="${v}" ${type === v ? 'selected' : ''}>${l}</option>`).join('');

    return `
      <div class="action-row">
        <select class="action-type" data-idx="${index}" data-container="${containerId}" onchange="editor.onActionTypeChange('${containerId}', ${index}, this.value)">${typeOpts}</select>
        ${paramHTML}
        <button class="btn btn-sm btn-danger" onclick="editor.removeAction('${containerId}', ${index})">×</button>
      </div>
    `;
  }

  onActionTypeChange(containerId, index, newType) {
    const actions = this._collectActionsFromDOM(containerId);
    actions[index] = { type: newType };
    this.renderActions(containerId, actions);
    this._doAutoSave();
  }

  addAction(containerId) {
    const actions = this._collectActionsFromDOM(containerId);
    actions.push({ type: 'text', value: '' });
    this.renderActions(containerId, actions);
    this._doAutoSave();
  }

  removeAction(containerId, index) {
    const actions = this._collectActionsFromDOM(containerId);
    actions.splice(index, 1);
    this.renderActions(containerId, actions);
    this._doAutoSave();
  }

  _collectActionsFromDOM(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    const rows = container.querySelectorAll('.action-row');
    const actions = [];
    rows.forEach(row => {
      const typeSel = row.querySelector('.action-type');
      if (!typeSel) return;
      const type = typeSel.value;
      const action = { type };
      row.querySelectorAll('[data-field]').forEach(el => {
        const field = el.dataset.field;
        let val = el.value;
        if (field === 'value' && type === 'set_var') {
          if (val === 'true') val = true;
          else if (val === 'false') val = false;
          else if (!isNaN(val) && val.trim() !== '') val = Number(val);
        }
        if (field === 'options' && type === 'dialogue') {
          val = val.split('\n').map(line => line.trim()).filter(line => line.length > 0).map(line => ({ text: line }));
        }
        action[field] = val;
      });
      actions.push(action);
    });
    return actions;
  }

  _collectActionBlockFromDOM(containerId) {
    const hasCond = document.getElementById(`${containerId}-hascond`)?.checked || false;
    if (!hasCond) {
      return { actions: this._collectActionsFromDOM(`${containerId}-actions`) };
    }
    const condition = this._getVisibleConditionFromDOM(containerId);
    return {
      condition,
      actions: this._collectActionsFromDOM(`${containerId}-if-actions`),
      else: { actions: this._collectActionsFromDOM(`${containerId}-else-actions`) }
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  SAVE
  // ═══════════════════════════════════════════════════════════════

  saveForm() {
    if (this.currentPanel === 'locations' && this.selectedLocId) {
      this.saveLocationForm();
    } else if (this.currentPanel === 'items' && this.selectedItemId) {
      this.saveItemForm();
    } else if (this.currentPanel === 'npcs' && this.selectedNpcId) {
      this.saveNpcForm();
    } else if (this.currentPanel === 'events' && this.selectedEventId) {
      this.saveEventForm();
    } else if (this.currentPanel === 'config') {
      this.saveConfigForm();
    }
  }

  saveLocationForm() {
    const loc = this.campaign.locations.find(l => l.id === this.selectedLocId);
    if (!loc) return;
    loc.name = document.getElementById('form_name').value;
    loc.description = document.getElementById('form_desc').value;
    loc.color = document.getElementById('form_color').value;
    const locIcon = document.getElementById('form_icon').value;
    if (locIcon) loc.icon = locIcon;
    else delete loc.icon;
    loc.background_type = document.getElementById('form_bg_type').value || null;

    const newType = document.getElementById('form_gps_type').value;
    if (newType === 'none') {
      delete loc.gps;
    } else {
      if (!loc.gps) loc.gps = {};
      loc.gps.type = newType;
      if (newType === 'relative') {
        loc.gps.bearing_degrees = parseFloat(document.getElementById('form_bearing').value) || 0;
        loc.gps.distance_meters = parseFloat(document.getElementById('form_distance').value) || 0;
        delete loc.gps.lat;
        delete loc.gps.lng;
      } else {
        loc.gps.lat = parseFloat(document.getElementById('form_lat').value) || 0;
        loc.gps.lng = parseFloat(document.getElementById('form_lng').value) || 0;
        delete loc.gps.bearing_degrees;
        delete loc.gps.distance_meters;
      }
      loc.gps.radius_meters = parseInt(document.getElementById('form_radius').value) || 30;
    }

    // visible_condition
    const locHasVisCond = document.getElementById('form_loc_has_visible_condition').checked;
    if (locHasVisCond) {
      const vc = this._getVisibleConditionFromDOM('loc');
      if (vc) loc.visible_condition = vc;
      else loc.visible_condition = { operator: 'and', conditions: [] };
    } else {
      delete loc.visible_condition;
    }

    // on_enter
    loc.on_enter = this._collectActionBlockFromDOM('loc-onenter-block');

    // Scene elements: read properties directly from inputs to avoid missing onchange
    if (this._selectedSceneElement) {
      const el = this._selectedSceneElement;
      if (el.type === 'area') {
        const area = loc.clickable_areas[el.index];
        const aid = document.getElementById('prop_aid');
        const px = document.getElementById('prop_x');
        const py = document.getElementById('prop_y');
        const pw = document.getElementById('prop_w');
        const ph = document.getElementById('prop_h');
        const pr = document.getElementById('prop_r');
        const pg = document.getElementById('prop_ground');
        if (aid) area.id = aid.value;
        if (px) area.coords.x = parseInt(px.value) || 0;
        if (py) area.coords.y = parseInt(py.value) || 0;
        if (area.shape === 'rect') {
          if (pw) area.coords.w = parseInt(pw.value) || 10;
          if (ph) area.coords.h = parseInt(ph.value) || 10;
        } else {
          if (pr) area.coords.r = parseInt(pr.value) || 5;
        }
        if (pg) area.object_on_ground = pg.value || null;
        area.on_click = this._collectActionBlockFromDOM('area-actions-block');
      } else if (el.type === 'npc') {
        const inst = loc.npc_instances[el.index];
        const npref = document.getElementById('prop_npref');
        const npx = document.getElementById('prop_npx');
        const npy = document.getElementById('prop_npy');
        if (npref) inst.ref = npref.value;
        if (npx) inst.position.x = parseInt(npx.value) || 0;
        if (npy) inst.position.y = parseInt(npy.value) || 0;
        inst.on_click = this._collectActionBlockFromDOM('npc-actions-block');
      }
    }

    this.updateLocationMarker(loc);
    this.renderSidebar();
  }

  saveItemForm() {
    const item = this.campaign.items.find(i => i.id === this.selectedItemId);
    if (!item) return;
    item.name = document.getElementById('form_name').value;
    item.description = document.getElementById('form_desc').value;
    item.icon = document.getElementById('form_icon').value;

    const gpsType = document.getElementById('form_gps_type').value;
    if (gpsType === 'none') {
      delete item.gps;
    } else {
      if (!item.gps) item.gps = {};
      item.gps.type = gpsType;
      if (gpsType === 'relative') {
        item.gps.bearing_degrees = parseFloat(document.getElementById('form_bearing').value) || 0;
        item.gps.distance_meters = parseFloat(document.getElementById('form_distance').value) || 0;
        delete item.gps.lat;
        delete item.gps.lng;
      } else {
        item.gps.lat = parseFloat(document.getElementById('form_lat').value) || 0;
        item.gps.lng = parseFloat(document.getElementById('form_lng').value) || 0;
        delete item.gps.bearing_degrees;
        delete item.gps.distance_meters;
      }
      item.gps.pickup_radius_meters = parseInt(document.getElementById('form_pickup_radius').value) || 30;
      const visRadius = document.getElementById('form_visibility_radius').value;
      if (visRadius && visRadius !== '') {
        item.gps.visibility_radius_meters = parseInt(visRadius);
      } else {
        delete item.gps.visibility_radius_meters;
      }
    }

    const hasVisCond = document.getElementById('form_has_visible_condition').checked;
    if (hasVisCond) {
      const vc = this._getVisibleConditionFromDOM('item');
      if (vc) item.visible_condition = vc;
      else item.visible_condition = { operator: 'and', conditions: [] };
    } else {
      delete item.visible_condition;
    }

    if (!item.on_pickup) item.on_pickup = {};
    item.on_pickup = this._collectActionBlockFromDOM('item-onpickup-block');

    item.consumable = document.getElementById('form_consumable')?.checked || false;

    if (!item.on_use) item.on_use = {};
    item.on_use = this._collectActionBlockFromDOM('item-onuse-block');

    // Minigame config
    const hasMinigame = document.getElementById('form_has_minigame')?.checked;
    if (hasMinigame) {
      const mgType = document.getElementById('form_minigame_type')?.value || 'cryptex';
      const symbols = document.getElementById('form_minigame_symbols')?.value || 'ABCDEFGHI';
      const wheels = parseInt(document.getElementById('form_minigame_wheels')?.value) || 3;
      // Get solution from the visual editor positions
      let solution = [];
      if (this._cryptexEditorPositions && this._cryptexEditorPositions.length === wheels) {
        solution = [...this._cryptexEditorPositions];
      }
      item.minigame = {
        type: mgType,
        symbols: symbols,
        wheels: wheels,
        solution: solution
      };
      if (mgType === 'cryptex') {
        // Validate solution length matches wheels
        if (solution.length !== wheels) {
          alert(`Advertencia: la solución tiene ${solution.length} índices pero hay ${wheels} ruedas. Deben coincidir.`);
        }
        // Validate indices are within symbol range
        const maxIdx = symbols.length - 1;
        const invalid = solution.filter(n => n < 0 || n > maxIdx);
        if (invalid.length > 0) {
          alert(`Advertencia: los índices ${invalid.join(', ')} están fuera de rango (0-${maxIdx}).`);
        }
      }
      item.minigame.on_success = this._collectActionBlockFromDOM('minigame-success-block');
    } else {
      delete item.minigame;
      this._cryptexEditorPositions = null;
    }

    this.updateItemMarker(item);
    this.renderSidebar();
  }

  saveNpcForm() {
    const npc = (this.campaign.npcs || []).find(n => n.id === this.selectedNpcId);
    if (!npc) return;
    npc.name = document.getElementById('form_name').value;
    npc.description = document.getElementById('form_desc').value;
    npc.icon = document.getElementById('form_icon').value;

    const gpsType = document.getElementById('form_gps_type').value;
    if (!gpsType) {
      delete npc.gps;
    } else {
      if (!npc.gps) npc.gps = {};
      npc.gps.type = gpsType;
      if (gpsType === 'relative') {
        npc.gps.bearing_degrees = parseFloat(document.getElementById('form_bearing').value) || 0;
        npc.gps.distance_meters = parseFloat(document.getElementById('form_distance').value) || 0;
        delete npc.gps.lat;
        delete npc.gps.lng;
      } else {
        npc.gps.lat = parseFloat(document.getElementById('form_lat').value) || 0;
        npc.gps.lng = parseFloat(document.getElementById('form_lng').value) || 0;
        delete npc.gps.bearing_degrees;
        delete npc.gps.distance_meters;
      }
      npc.gps.interact_radius_meters = parseInt(document.getElementById('form_interact_radius').value) || 30;
    }

    const npcHasVisCond = document.getElementById('form_npc_has_visible_condition').checked;
    if (npcHasVisCond) {
      const vc = this._getVisibleConditionFromDOM('npc');
      if (vc) npc.visible_condition = vc;
      else npc.visible_condition = { operator: 'and', conditions: [] };
    } else {
      delete npc.visible_condition;
    }

    if (!npc.on_interact) npc.on_interact = {};
    npc.on_interact = this._collectActionBlockFromDOM('npc-oninteract-block');

    this.updateNpcMarker(npc);
    this.renderSidebar();
  }

  saveEventForm() {
    const evt = (this.campaign.events || []).find(e => e.id === this.selectedEventId);
    if (!evt) return;
    evt.actions = this._collectActionBlockFromDOM('event-actions-block');
  }

  saveConfigForm() {
    const titleEl = document.getElementById('form_title');
    if (titleEl) this.campaign.metadata.title = titleEl.value;
    const descEl = document.getElementById('form_campaign_desc');
    if (descEl) this.campaign.metadata.description = descEl.value;
    this.campaign.metadata.author = window._currentUsername || this.campaign.metadata.author || 'Anónimo';
    const versionEl = document.getElementById('form_version');
    if (versionEl) this.campaign.metadata.version = versionEl.value;
    const languageEl = document.getElementById('form_language');
    if (languageEl) this.campaign.metadata.language = languageEl.value;
    const difficultyEl = document.getElementById('form_difficulty');
    if (difficultyEl) this.campaign.metadata.difficulty = difficultyEl.value;
    const estimatedEl = document.getElementById('form_estimated');
    if (estimatedEl) this.campaign.metadata.estimated_minutes = parseInt(estimatedEl.value) || 0;
    const startLocEl = document.getElementById('form_start_loc');
    if (startLocEl) this.campaign.metadata.starting_location_id = startLocEl.value;
    const maxSlotsEl = document.getElementById('form_max_slots');
    if (maxSlotsEl) {
      if (!this.campaign.inventory_rules) this.campaign.inventory_rules = {};
      this.campaign.inventory_rules.max_slots = parseInt(maxSlotsEl.value) || 6;
    }

    // Cloud fields
    const gpsTypeEl = document.getElementById('form_gps_type');
    if (gpsTypeEl) this.campaign.gps_type = gpsTypeEl.value;
    const isPublicEl = document.getElementById('form_is_public');
    if (isPublicEl) this.campaign.is_public = isPublicEl.checked;
    const originLatEl = document.getElementById('form_origin_lat');
    const originLngEl = document.getElementById('form_origin_lng');
    if (originLatEl && originLngEl) {
      if (!this.campaign.origin) this.campaign.origin = {};
      this.campaign.origin.lat = parseFloat(originLatEl.value) || 0;
      this.campaign.origin.lng = parseFloat(originLngEl.value) || 0;
    }
  }

  _onGpsTypeChange() {
    const gpsType = document.getElementById('form_gps_type').value;
    const originGroup = document.getElementById('form_origin_group');
    if (originGroup) originGroup.style.display = gpsType === 'absolute' ? 'none' : '';
    this._doAutoSave();
  }

  // ═══════════════════════════════════════════════════════════════
  //  VISIBLE CONDITION HELPERS
  // ═══════════════════════════════════════════════════════════════

  _buildConditionRowsHTML(vc, prefix) {
    const conditions = vc?.conditions || (vc ? [vc] : [{}]);
    const operator = vc?.operator || 'and';
    let html = '';
    const showOp = conditions.length >= 2 || !!(vc && vc.operator);
    html += `<div id="${prefix}-operator-fields" style="${showOp ? '' : 'display:none;'}margin-bottom:0.5rem;">`;
    html += `<label style="color:var(--text-muted);font-size:0.85rem;">Operador</label>`;
    html += `<select id="${prefix}-operator">`;
    html += `<option value="and" ${operator==='and'?'selected':''}>AND (todas)</option>`;
    html += `<option value="nand" ${operator==='nand'?'selected':''}>NAND (no todas)</option>`;
    html += `<option value="or" ${operator==='or'?'selected':''}>OR (alguna)</option>`;
    html += `<option value="nor" ${operator==='nor'?'selected':''}>NOR (ninguna)</option>`;
    html += `</select></div>`;
    html += `<div id="${prefix}-conditions-container">`;
    for (let i = 0; i < conditions.length; i++) {
      html += this._buildSingleConditionRowHTML(conditions[i], prefix, i);
    }
    html += `</div>`;
    return html;
  }

  _buildSingleConditionRowHTML(cond, prefix, index) {
    const isItem = cond && cond.has_item !== undefined;
    const items = this.campaign.items || [];
    let html = `<div class="condition-row">`;
    html += `<select class="cond-type" onchange="editor._onConditionTypeChange(this, '${prefix}')">`;
    html += `<option value="var" ${!isItem?'selected':''}>Variable</option>`;
    html += `<option value="has_item" ${isItem?'selected':''}>Item</option>`;
    html += `</select>`;
    html += `<span class="cond-var-wrapper" style="${isItem?'display:none;':''}">`;
    html += `<input type="text" class="cond-var" placeholder="var" value="${this._esc(isItem?'':(cond?.var||''))}">`;
    html += `<input type="text" class="cond-eq" placeholder="valor" value="${this._esc(isItem?'':(cond?.eq!==undefined?String(cond.eq):''))}">`;
    html += `</span>`;
    html += `<select class="cond-item" style="${isItem?'':'display:none;'}">`;
    for (const it of items) {
      html += `<option value="${this._esc(it.id)}" ${cond?.has_item===it.id?'selected':''}>${this._esc(it.name)}</option>`;
    }
    html += `</select>`;
    html += `<button class="btn btn-sm btn-danger" onclick="editor._removeConditionRow(this, '${prefix}')">🗑</button>`;
    html += `</div>`;
    return html;
  }

  _onConditionTypeChange(select, prefix) {
    const row = select.closest('.condition-row');
    if (!row) return;
    const isItem = select.value === 'has_item';
    const vw = row.querySelector('.cond-var-wrapper');
    if (vw) vw.style.display = isItem ? 'none' : '';
    const ci = row.querySelector('.cond-item');
    if (ci) ci.style.display = isItem ? '' : 'none';
  }

  _removeConditionRow(btn, prefix) {
    const row = btn.closest('.condition-row');
    if (row) row.remove();
    this._updateOperatorVisibility(prefix);
    this._doAutoSave();
  }

  _updateOperatorVisibility(prefix) {
    const container = document.getElementById(`${prefix}-conditions-container`);
    const opFields = document.getElementById(`${prefix}-operator-fields`);
    if (!container || !opFields) return;
    const count = container.querySelectorAll('.condition-row').length;
    opFields.style.display = count >= 2 ? '' : 'none';
  }

  _addConditionRow(containerId, prefix) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const index = container.querySelectorAll('.condition-row').length;
    container.insertAdjacentHTML('beforeend', this._buildSingleConditionRowHTML({}, prefix, index));
    this._updateOperatorVisibility(prefix);
    this._doAutoSave();
    this._attachAutoSave();
  }

  _getVisibleConditionFromDOM(prefix) {
    const container = document.getElementById(`${prefix}-conditions-container`);
    if (!container) return null;
    const rows = container.querySelectorAll('.condition-row');
    if (rows.length === 0) return null;
    const conditions = [];
    for (const row of rows) {
      const type = row.querySelector('.cond-type').value;
      if (type === 'has_item') {
        const itemSel = row.querySelector('.cond-item');
        conditions.push({ has_item: itemSel ? itemSel.value : '' });
      } else {
        const varName = row.querySelector('.cond-var').value;
        let eq = row.querySelector('.cond-eq').value;
        if (eq === 'true') eq = true;
        else if (eq === 'false') eq = false;
        else if (!isNaN(eq) && eq.trim() !== '') eq = Number(eq);
        conditions.push({ var: varName, eq: eq });
      }
    }
    if (conditions.length === 1) {
      return conditions[0];
    }
    const opSelect = document.getElementById(`${prefix}-operator`);
    return {
      operator: opSelect ? opSelect.value : 'and',
      conditions: conditions
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  MOBILE PANELS (responsive slide-in sidebars)
  // ═══════════════════════════════════════════════════════════════

  toggleSidebar() {
    const sidebar = document.getElementById('editor-sidebar');
    const isOpen = sidebar.classList.contains('open');
    this.closeAllPanels();
    if (!isOpen) {
      sidebar.classList.add('open');
      document.getElementById('editor-overlay').classList.add('visible');
    }
    this._invalidateMap();
  }

  toggleFormPanel() {
    const form = document.getElementById('editor-form');
    const isOpen = form.classList.contains('open');
    this.closeAllPanels();
    if (!isOpen) {
      form.classList.add('open');
      document.getElementById('editor-overlay').classList.add('visible');
    }
    this._invalidateMap();
  }

  closeAllPanels() {
    document.getElementById('editor-sidebar').classList.remove('open');
    document.getElementById('editor-form').classList.remove('open');
    document.getElementById('editor-overlay').classList.remove('visible');
    this._invalidateMap();
  }

  _invalidateMap() {
    setTimeout(() => { if (this.map) this.map.invalidateSize(); }, 350);
  }

  // ═══════════════════════════════════════════════════════════════
  //  UTILITIES
  // ═══════════════════════════════════════════════════════════════

  _esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

const editor = new CampaignEditor();
