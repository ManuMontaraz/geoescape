// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Manuel Arjona Blanco <manuel@manumontaraz.es>

/* global CampaignParser, Inventory, TextOverlay, StateMachine, GeoManager, GpsBlockMap, LocationSimulator, UIComponents, DB */
class GameEngine {
  constructor(campaign) {
    this.campaign = campaign;
    this.location = null;
    this.inventory = new Inventory(campaign.inventory_rules?.max_slots || 8);
    this.inventory.setRenderer(this);
    this.textOverlay = new TextOverlay();
    this.dialogueBox = new DialogueBox();
    this.state = new StateMachine();
    this.geo = new GeoManager();
    this.variables = {};

    // Init global vars
    if (campaign.global_vars) {
      for (const [k, v] of Object.entries(campaign.global_vars)) {
        this.variables[k] = v?.default ?? null;
      }
    }

    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this._itemIconCache = {}; // Cache for SVG item icons
    this._decorIconCache = {}; // Cache for SVG decor icons
    this._npcIconCache = {}; // Cache for SVG NPC icons
    this._bgImageCache = {}; // Cache for background images
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Input handling
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.handleClick({clientX: touch.clientX, clientY: touch.clientY});
    }, {passive: false});

    // UI bindings (safe: skip if element missing)
    this._bind('btn-inv', 'click', () => this.toggleInventory());
    this._bind('inv-close', 'click', () => this.toggleInventory());
    this._bind('btn-exit', 'click', () => this.exitToMap());
    this._bind('btn-menu', 'click', () => this.toggleMenu());
    this._bind('menu-close', 'click', () => this.toggleMenu());
    // GPS panel top-bar bindings
    this._bind('btn-gps-inv', 'click', () => this.toggleInventory());
    this._bind('btn-gps-menu', 'click', () => this.toggleMenu());

    // Test mode will be verified asynchronously in start()
    this.isTestMode = false;

    // Item & NPC Managers
    this.itemManager = new ItemManager(this.geo, this.campaign);
    this.npcManager = new NpcManager(this.geo, this.campaign);

    // Minigame Manager
    this.minigameManager = new MinigameManager(this);

    // GPS Map & Simulator
    this.gpsMap = new GpsBlockMap(this.geo, this.isTestMode, this.itemManager, this.npcManager);
    this.simulator = new LocationSimulator(this.geo, this.campaign, this.itemManager, this.npcManager);

    // GPS tracking will be started when needed (on map open or GPS request)

    // Action queue for sequential execution
    this.actionQueue = [];
    this.isProcessingQueue = false;
    this.textOverlay.onComplete = () => this._processNextAction();

    // Show Fork button if campaign is public
    const isPublic = localStorage.getItem('ge_campaign_is_public') === '1';
    const forkBtn = document.getElementById('menu-fork-btn');
    if (forkBtn && isPublic) {
      forkBtn.style.display = '';
    }
  }

  _bind(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  }

  async _autoSave() {
    const state = {
      variables: this.variables,
      inventory: this.inventory.items,
      pickedUp: Array.from(this.itemManager.pickedUp),
      currentLocation: this.location ? this.location.id : null,
      currentState: this.state.get()
    };
    const indicator = document.getElementById('save-indicator');
    if (indicator) indicator.classList.remove('hidden');
    try {
      await DB.saveProgress(this.campaign.campaign_id, state);
    } catch (e) {
      console.error('Autoguardado fallido:', e);
    } finally {
      setTimeout(() => {
        if (indicator) indicator.classList.add('hidden');
      }, 500);
    }
  }

  resize() {
    const container = document.getElementById('game-main-area');
    const w = container ? container.clientWidth : window.innerWidth;
    const h = container ? container.clientHeight : window.innerHeight;
    this.canvas.width = w;
    this.canvas.height = h;
    if (this.location) this.render();
  }

  async start() {
    // Verify test mode permission before proceeding
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('test')) {
      const hasPermission = await this._checkTestModePermission();
      if (hasPermission) {
        this.isTestMode = true;
        this.gpsMap.setTestMode(true);
      }
      // If no permission, isTestMode stays false (ignore test param)
    }

    // Check if we are in "finish" mode (campaign ended, show vote modal)
    if (urlParams.has('finish') && !this.isTestMode) {
      this._showFinishModal();
      return;
    }

    // Check if campaign has a starting location configured
    const startLoc = CampaignParser.getStartLocation(this.campaign);
    if (startLoc) {
      // Resolve GPS coordinates before entering location
      if (this.isTestMode) {
        const origin = this.campaign.origin || { lat: 40.4168, lng: -3.7038 };
        this._resolveRelativeGPS(origin.lat, origin.lng);
        this.geo.simulate(origin.lat, origin.lng);
      } else if (this.geo.current.lat != null) {
        this._resolveRelativeGPS(this.geo.current.lat, this.geo.current.lng);
      } else if (this._hasRelativeGPS()) {
        this._requestGPSAndStart(startLoc);
        return;
      }
      // Start directly in the location
      this._doEnterLocation(startLoc);
      return;
    }

    // Otherwise, start on GPS map
    if (!this._hasRelativeGPS()) {
      this._openMap();
      return;
    }

    if (this.isTestMode) {
      const origin = this.campaign.origin || { lat: 40.4168, lng: -3.7038 };
      this._resolveRelativeGPS(origin.lat, origin.lng);
      this.geo.simulate(origin.lat, origin.lng);
      this._openMap();
      return;
    }

    if (this.geo.current.lat != null) {
      this._resolveRelativeGPS(this.geo.current.lat, this.geo.current.lng);
      this._openMap();
    } else {
      this._requestGPSAndStart();
    }
  }

  async _checkTestModePermission() {
    const currentCampaign = localStorage.getItem('ge_current_campaign');
    // Allow test mode for local editor campaigns (no cloud UUID needed)
    if (currentCampaign === 'editor_test') return true;

    const cloudUuid = localStorage.getItem('ge_cloud_uuid');
    if (!cloudUuid) return false;
    try {
      const res = await fetch('api/campaigns/check-owner.php?uuid=' + encodeURIComponent(cloudUuid), {
        credentials: 'same-origin'
      });
      const data = await res.json();
      if (data.success) {
        // Allow test mode if user is owner or campaign is public
        return data.isOwner || data.isPublic;
      }
    } catch (e) {
      console.error('Error checking test mode permission:', e);
    }
    return false;
  }

  _openMap() {
    this.state.set('gps_block');
    const btnExit = document.getElementById('btn-exit');
    if (btnExit) btnExit.style.display = 'none';
    // Start GPS tracking if not already started
    this.geo.startTracking(() => {
      if (this.gpsMap.active) {
        this.gpsMap._updateDistanceText();
      }
    });
    this.gpsMap.open(this.campaign, this.campaign.campaign_id);
  }

  _hasRelativeGPS() {
    for (const loc of this.campaign.locations || []) {
      if (loc.gps?.type === 'relative') return true;
    }
    for (const item of this.campaign.items || []) {
      if (item.gps?.type === 'relative') return true;
    }
    for (const npc of this.campaign.npcs || []) {
      if (npc.gps?.type === 'relative') return true;
    }
    return false;
  }

  _requestGPSAndStart(startLoc = null) {
    const waitingPanel = document.getElementById('gps-waiting-panel');
    const failPanel = document.getElementById('gps-fail-panel');
    const timerEl = document.getElementById('gps-timer');
    waitingPanel.classList.remove('hidden');

    let remaining = 60;
    timerEl.textContent = remaining;

    const countdown = setInterval(() => {
      remaining--;
      timerEl.textContent = remaining;
      if (remaining <= 0) clearInterval(countdown);
    }, 1000);

    const timeoutId = setTimeout(() => {
      clearInterval(countdown);
      waitingPanel.classList.add('hidden');
      failPanel.classList.remove('hidden');
      // Auto-redirect after showing the fail panel for 5 seconds
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 5000);
    }, 60000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timeoutId);
        clearInterval(countdown);
        waitingPanel.classList.add('hidden');
        // Update geo manager
        this.geo.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
        // Restart continuous tracking now that we have permission
        this.geo.startTracking(() => {
          if (this.gpsMap.active) {
            this.gpsMap._updateDistanceText();
          }
        });
        this._resolveRelativeGPS(pos.coords.latitude, pos.coords.longitude);
        if (startLoc) {
          this._doEnterLocation(startLoc);
        } else {
          this._openMap();
        }
      },
      (err) => {
        clearTimeout(timeoutId);
        clearInterval(countdown);
        waitingPanel.classList.add('hidden');
        failPanel.classList.remove('hidden');
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 5000);
      },
      { enableHighAccuracy: true, timeout: 60000, maximumAge: 0 }
    );
  }

  _resolveRelativeGPS(originLat, originLng) {
    // Resolve locations
    for (const loc of this.campaign.locations) {
      if (loc.gps && loc.gps.type === 'relative') {
        const rel = loc.gps;
        const bearing = rel.bearing_degrees || 0;
        const dist = rel.distance_meters || 50;
        const abs = this.geo.calculateRelativePosition(originLat, originLng, bearing, dist);
        loc.gps.lat = abs.lat;
        loc.gps.lng = abs.lng;
        delete loc.gps.type;
      }
    }

    // Resolve items
    this.itemManager.resolveGPS(originLat, originLng);
    // Resolve NPCs
    this.npcManager.resolveGPS(originLat, originLng);
  }

  enterLocation(location) {
    this._doEnterLocation(location);
  }

  _doEnterLocation(location) {
    const btnExit = document.getElementById('btn-exit');
    if (btnExit) btnExit.style.display = '';
    this.gpsMap.close();
    this.dialogueBox.hide();
    this.location = location;
    this._bgImage = null;
    this.state.set('playing');
    this.render();

    if (location.on_enter) {
      if (Array.isArray(location.on_enter)) {
        this.executeActions(location.on_enter);
      } else {
        this._handleConditionalBlock(location.on_enter);
      }
    }
  }

  openSimulator() {
    this.simulator.open(this.campaign.campaign_id);
  }

  executeActions(actions) {
    if (!Array.isArray(actions)) return;
    this.actionQueue.push(...actions);
    this._processNextAction();
  }

  _processNextAction() {
    if (this.isProcessingQueue) return;
    if (this.actionQueue.length === 0) {
      this.state.set('playing');
      this._autoSave();
      return;
    }
    this.isProcessingQueue = true;
    const action = this.actionQueue.shift();
    this._executeActionNow(action);
  }

  _executeActionNow(action) {
    switch (action.type) {
      case 'text':
        this.state.set('overlay');
        this.textOverlay.show(action.value);
        this.isProcessingQueue = false;
        // TextOverlay.onComplete will call _processNextAction when user clicks "Continue"
        break;
      case 'add_item': {
        const item = this.campaign.items?.find(i => i.id === action.item_id);
        if (item) {
          const res = this.inventory.add(item);
          if (!res.success) this.textOverlay.show(res.msg);
        }
        this.isProcessingQueue = false;
        this._processNextAction();
        break;
      }
      case 'remove_item':
        this.inventory.remove(action.item_id);
        this.isProcessingQueue = false;
        this._processNextAction();
        break;
      case 'set_var':
        this.variables[action.key] = action.value;
        this.isProcessingQueue = false;
        this._processNextAction();
        break;
      case 'change_scene': {
        const next = this.campaign.locations.find(l => l.id === action.target);
        if (next) {
          this.isProcessingQueue = false;
          this.enterLocation(next);
        }
        this.isProcessingQueue = false;
        this._processNextAction();
        break;
      }
      case 'exit_scene':
        this.exitToMap();
        this.isProcessingQueue = false;
        this._processNextAction();
        break;
      case 'trigger_event': {
        const evt = this.campaign.events?.find(e => e.id === action.event_id);
        if (evt) {
          this.isProcessingQueue = false;
          if (Array.isArray(evt.actions)) {
            this.executeActions(evt.actions);
          } else {
            this._handleConditionalBlock(evt.actions);
          }
        }
        this.isProcessingQueue = false;
        this._processNextAction();
        break;
      }
      case 'dialogue':
        this.state.set('dialogue');
        this.dialogueBox.onComplete = (actions) => {
          // ENCOLAR en actionQueue en lugar de ejecutar directamente
          if (actions && actions.length > 0) {
            this.actionQueue.unshift(...actions);
          }
          this.isProcessingQueue = false;
          this._processNextAction();
        };
        this.dialogueBox.show(action.text, action.speaker, action.options);
        this.isProcessingQueue = false;
        break;
      case 'finish_campaign':
        if (action.text) this.textOverlay.show(action.text);
        if (this.isTestMode) {
          setTimeout(() => {
            if (confirm('Caso terminado (modo test). ¿Volver al editor?')) {
              window.location.href = 'editor.html';
            }
          }, 1500);
        } else {
          this._showFinishModal();
        }
        this.isProcessingQueue = false;
        this._processNextAction();
        break;
      default:
        console.warn('Acción desconocida:', action.type);
        this.isProcessingQueue = false;
        this._processNextAction();
    }
  }

  _handleConditionalBlock(data) {
    if (!data) return;
    if (data.condition) {
      const pass = this._evaluateCondition(data.condition);
      const branch = pass ? data : (data.else || null);
      if (branch) {
        if (branch.text) this.executeActions([{type: 'text', value: branch.text}]);
        if (branch.actions) this.executeActions(branch.actions);
      }
    } else {
      if (data.text) this.executeActions([{type: 'text', value: data.text}]);
      if (data.actions) this.executeActions(data.actions);
    }
  }

  useItem(itemId) {
    const item = this.campaign.items?.find(i => i.id === itemId);
    if (!item) return;

    // If item has a minigame, start it
    if (item.minigame) {
      this.minigameManager.start(item.minigame, () => {
        // On success callback: execute on_success actions
        if (item.minigame.on_success) {
          this._handleConditionalBlock(item.minigame.on_success);
        }
        if (item.consumable) {
          this.inventory.remove(itemId);
        }
        this._autoSave();
      });
      return;
    }

    // Normal on_use flow
    if (item.on_use) {
      this._handleConditionalBlock(item.on_use);
    } else {
      this.executeActions([{type: 'text', value: 'No puedes usar este objeto.'}]);
    }

    if (item.consumable) {
      this.inventory.remove(itemId);
    }
    this._autoSave();
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Background
    if (this.location.background_type) {
      const iconUrl = AssetResolver.bgIcon(this.location.background_type);
      const img = this._bgImageCache[iconUrl];
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, 0, 0, w, h);
      } else {
        ctx.fillStyle = this.location.color || '#1a1a2e';
        ctx.fillRect(0,0,w,h);
        if (!img) {
          const im = new Image();
          im.onload = () => { this._bgImageCache[iconUrl] = im; this.render(); };
          im.onerror = () => { console.warn('Failed to load background:', iconUrl); };
          im.src = iconUrl;
          this._bgImageCache[iconUrl] = im;
        }
      }
    } else if (this.location.background) {
      // Try to draw image if preloaded, else fallback color
      const img = this._bgImage;
      if (img) {
        ctx.drawImage(img, 0, 0, w, h);
      } else {
        // Try load
        const im = new Image();
        im.src = this.location.background;
        im.onload = () => { this._bgImage = im; this.render(); };
        ctx.fillStyle = '#222';
        ctx.fillRect(0,0,w,h);
      }
    } else {
      ctx.fillStyle = this.location.color || '#1a1a2e';
      ctx.fillRect(0,0,w,h);
      // Draw visible brick/panel pattern
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      const bw = 60, bh = 40;
      for (let row = 0; row < h/bh + 1; row++) {
        for (let col = 0; col < w/bw + 1; col++) {
          const offset = (row % 2) * (bw/2);
          ctx.strokeRect(col * bw + offset, row * bh, bw - 4, bh - 4);
        }
      }
      // Vignette overlay to lighten center
      const grad = ctx.createRadialGradient(w/2, h/2, h*0.2, w/2, h/2, h*0.8);
      grad.addColorStop(0, 'rgba(255,255,255,0.08)');
      grad.addColorStop(1, 'rgba(0,0,0,0.3)');
      ctx.fillStyle = grad;
      ctx.fillRect(0,0,w,h);
    }

    // Scale scene elements uniformly from logical 400x300 to physical canvas size
    const scale = Math.min(w / 400, h / 300);
    const offsetX = (w - 400 * scale) / 2;
    const offsetY = (h - 300 * scale) / 2;
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Draw clickable areas debug/hints
    if (this.location.clickable_areas) {
      for (const area of this.location.clickable_areas) {
        this.drawArea(ctx, area);
      }
    }

    // Draw NPC instances
    if (this.location.npc_instances) {
      for (const inst of this.location.npc_instances) {
        const globalNpc = this.npcManager.getGlobalNpc(inst.ref);
        if (globalNpc) this.drawNPC(ctx, inst, globalNpc);
      }
    }

    ctx.restore();

    // Draw location name
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, w, 40);
    ctx.fillStyle = '#ecf0f1';
    ctx.font = '18px sans-serif';
    ctx.fillText(this.location.name, 10, 28);

    // GPS debug badge
    if (this.geo && (this.geo.current.lat != null || this.geo.simulated.active)) {
      const pos = this.geo.simulated.active ? this.geo.simulated : this.geo.current;
      const txt = `GPS: ${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)} ${this.geo.simulated.active ? '[SIM]' : ''}`;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      const tw = ctx.measureText(txt).width;
      ctx.fillRect(w - tw - 12, h - 22, tw + 10, 18);
      ctx.fillStyle = this.geo.simulated.active ? '#f1c40f' : '#7f8c8d';
      ctx.font = '11px monospace';
      ctx.fillText(txt, w - tw - 8, h - 8);
    }
  }

  drawArea(ctx, area) {
    const c = area.coords;

    if (area.object_on_ground) {
      const item = this.itemManager.items.find(i => i.id === area.object_on_ground);
      // Si el item ya está recogido, no dibujar nada
      if (!item || this.itemManager.isPickedUp(item.id)) return;

      const cx = c.x + (c.r ? 0 : c.w/2);
      const cy = c.y + (c.r ? 0 : c.h/2);
      const r = c.r || Math.min(c.w, c.h)/2;

      // Glow
      ctx.beginPath();
      ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(241, 196, 15, 0.3)';
      ctx.fill();

      // Dibujar icono SVG del item
      this._drawItemIcon(ctx, item.icon, cx, cy, r * 2);
      return;
    }

    if (area.icon) {
      const cx = c.x + (c.r ? 0 : c.w/2);
      const cy = c.y + (c.r ? 0 : c.h/2);
      const w = c.r ? c.r * 2 : c.w;
      const h = c.r ? c.r * 2 : c.h;
      this._drawDecorIcon(ctx, area.icon, cx, cy, w, h);
      return;
    }

    // Default debug outline — bright and visible on dark backgrounds
    ctx.save();
    ctx.shadowColor = '#e94560';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(233, 69, 96, 0.25)';

    if (area.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeRect(c.x, c.y, c.w, c.h);
    }
    ctx.restore();

    // Label
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    const label = area.id || '';
    ctx.fillText(label, c.x + 4, c.y + 14);
    ctx.restore();
  }

  _drawItemIcon(ctx, iconName, cx, cy, size) {
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
      this.render(); // Redraw when loaded
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

  _drawDecorIcon(ctx, iconName, cx, cy, w, h) {
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
      this.render(); // Redraw when loaded
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

  _drawNpcIcon(ctx, iconName, cx, cy, size) {
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
      this.render(); // Redraw when loaded
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

  drawNPC(ctx, inst, globalNpc) {
    const p = inst.position || {x: 100, y: 100};
    const npcScale = inst.scale || 1.0;
    const size = 30 * npcScale;
    const iconName = globalNpc.icon || 'merchant';

    // Draw NPC icon
    this._drawNpcIcon(ctx, iconName, p.x, p.y, size);

    // Draw name below
    ctx.fillStyle = '#ecf0f1';
    ctx.font = '12px sans-serif';
    ctx.fillText(globalNpc.name || 'NPC', p.x - 20, p.y + size/2 + 14);
  }

  handleClick(e) {
    if (this.state.get() !== 'playing' || this.textOverlay.isOpen || this.dialogueBox.isOpen) return;
    const rect = this.canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / 400, rect.height / 300);
    const offsetX = (rect.width - 400 * scale) / 2;
    const offsetY = (rect.height - 300 * scale) / 2;
    const x = (e.clientX - rect.left - offsetX) / scale;
    const y = (e.clientY - rect.top - offsetY) / scale;

    // Check NPC instances first
    if (this.location.npc_instances) {
      for (const inst of this.location.npc_instances) {
        if (this.hitTestNPC(inst, x, y)) {
          const globalNpc = this.npcManager.getGlobalNpc(inst.ref);
          if (inst.on_click) {
            this._handleConditionalBlock(inst.on_click);
          } else if (globalNpc && globalNpc.on_interact) {
            this._handleConditionalBlock(globalNpc.on_interact);
          }
          this._autoSave();
          return;
        }
      }
    }

    // Check clickable areas
    if (this.location.clickable_areas) {
      for (const area of this.location.clickable_areas) {
        if (this.hitTest(area, x, y)) {
          this.handleAreaClick(area);
          return;
        }
      }
    }
  }

  hitTest(area, x, y) {
    const c = area.coords;
    if (area.shape === 'circle') {
      const dx = x - c.x;
      const dy = y - c.y;
      return (dx*dx + dy*dy) <= c.r*c.r;
    }
    return x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h;
  }

  hitTestNPC(inst, x, y) {
    const p = inst.position || {x:0,y:0};
    const dx = x - p.x;
    const dy = y - p.y;
    return (dx*dx + dy*dy) <= 20*20;
  }

  _evaluateSingleCondition(cond) {
    if (!cond) return true;
    if (cond.has_item) return this.inventory.has(cond.has_item);
    if (cond.var !== undefined && cond.var !== null && cond.var !== '') {
      const varValue = this.variables[cond.var];
      return String(varValue).toLowerCase() === String(cond.eq).toLowerCase();
    }
    return true;
  }

  _evaluateCondition(vc) {
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

  handleAreaClick(area) {
    // 1. Si hay item en el suelo, intentar recoger
    if (area.object_on_ground) {
      const item = this.itemManager.items.find(i => i.id === area.object_on_ground);
      if (item && !this.itemManager.isPickedUp(item.id)) {
        const res = this.inventory.add(item);
        if (res.success) {
          this.itemManager.markPickedUp(item.id);
          this._handleConditionalBlock(item.on_pickup);
          this.render(); // Redibujar para que desaparezca visualmente
          this._autoSave(); // Autoguardar al recoger item
        } else {
          UIComponents.toast('Inventario lleno');
        }
      }
    }

    // 2. Ejecutar on_click del área (si existe)
    const clickData = area.on_click || area.interactions?.[0];
    if (!clickData) return;

    if (clickData.condition) {
      const pass = this._evaluateCondition(clickData.condition);
      if (pass) {
        this.executeActions(clickData.actions || []);
      } else if (clickData.else) {
        this.executeActions(clickData.else.actions || []);
      }
    } else {
      this.executeActions(clickData.actions || []);
    }
  }

  toggleInventory() {
    if (this.dialogueBox.isOpen || this.textOverlay.isOpen) return;
    const panel = document.getElementById('inventory-panel');
    panel.classList.toggle('hidden');
    this.inventory.render();
  }

  toggleMenu() {
    if (this.dialogueBox.isOpen || this.textOverlay.isOpen) return;
    const panel = document.getElementById('menu-panel');
    panel.classList.toggle('hidden');
  }

  goToEditor() {
    window.location.href = 'editor.html';
  }

  exitToMap() {
    if (this.dialogueBox.isOpen || this.textOverlay.isOpen) return;
    this.state.set('gps_block');
    this.location = null;  // Clear current location when exiting to map
    const btnExit = document.getElementById('btn-exit');
    if (btnExit) btnExit.style.display = 'none';
    this._openMap();
  }

  async saveGame() {
    const state = {
      variables: this.variables,
      inventory: this.inventory.items,
      pickedUp: Array.from(this.itemManager.pickedUp),
      currentLocation: this.location ? this.location.id : null,
      currentState: this.state.get()
    };
    try {
      await DB.saveProgress(this.campaign.campaign_id, state);
      UIComponents.toast('Partida guardada');
    } catch (e) {
      console.error(e);
      UIComponents.toast('Error al guardar');
    }
  }

  async loadGame() {
    try {
      const state = await DB.getProgress(this.campaign.campaign_id);
      if (state) {
        this.variables = state.variables || {};
        this.inventory.items = state.inventory || [];
        // Restaurar items recogidos del mapa GPS
        if (state.pickedUp) {
          this.itemManager.pickedUp = new Set(state.pickedUp);
          for (const itemId of state.pickedUp) {
            this.variables['item_' + itemId + '_picked'] = true;
          }
        }

        // Reset resolution flags so relative GPS can be recalculated on load
        this.itemManager._resolved = false;
        this.npcManager._resolved = false;

        // Resolve relative GPS coordinates using current GPS position
        if (this._hasRelativeGPS()) {
          if (this.geo.current.lat != null) {
            this._resolveRelativeGPS(this.geo.current.lat, this.geo.current.lng);
          } else {
            // Need GPS first, then resolve, then restore location/map
            const savedLocId = state.currentLocation;
            const savedLoc = savedLocId ? this.campaign.locations.find(l => l.id === savedLocId) : null;
            this._requestGPSAndStart(savedLoc);
            UIComponents.toast('Partida cargada');
            return;
          }
        }

        // Restaurar estado
        const savedState = state.currentState || 'gps_block';
        const savedLocId = state.currentLocation;
        if (savedLocId) {
          const loc = this.campaign.locations.find(l => l.id === savedLocId);
          if (loc) {
            this.state.set('playing');
            this._doEnterLocation(loc);
          } else {
            this.state.set(savedState);
            this._openMap();
          }
        } else {
          this.state.set(savedState);
          this._openMap();
        }
        UIComponents.toast('Partida cargada');
      }
    } catch (e) {
      console.error(e);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  FINISH / VOTE MODAL
  // ═══════════════════════════════════════════════════════════════

  _showFinishModal() {
    const modal = document.getElementById('finish-modal');
    if (modal) {
      modal.classList.remove('hidden');
    }
  }

  async voteCampaign(voteType) {
    const urlParams = new URLSearchParams(window.location.search);
    const campaignId = urlParams.get('campaign') || this.campaign.campaign_id;
    // We need the UUID to vote, but we don't have it in the local JSON.
    // For now, we store the cloud UUID in localStorage when downloading.
    const cloudUuid = localStorage.getItem('ge_cloud_uuid');
    if (!cloudUuid) {
      document.getElementById('vote-msg').textContent = 'No se puede votar: caso no descargado desde la nube.';
      return;
    }
    try {
      const res = await fetch('api/campaigns/vote.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ uuid: cloudUuid, vote_type: voteType })
      });
      const data = await res.json();
      if (data.success) {
        document.getElementById('vote-msg').textContent = `¡Gracias! Voto registrado. Votos totales: ${data.vote_count}`;
      } else {
        document.getElementById('vote-msg').textContent = 'Error: ' + (data.error || 'Error al votar');
      }
    } catch (e) {
      document.getElementById('vote-msg').textContent = 'Error de red: ' + e.message;
    }
  }
}
