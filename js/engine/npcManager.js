// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Manuel Arjona Blanco <manuel@manumontaraz.es>

class NpcManager {
  constructor(geoManager, campaign) {
    this.geo = geoManager;
    this.campaign = campaign;
    this._resolved = false;
  }

  // Resolve relative GPS for global NPCs
  resolveGPS(originLat, originLng) {
    if (this._resolved) return;
    const globalNpcs = this.campaign.npcs || [];
    for (const npc of globalNpcs) {
      if (npc.gps && npc.gps.type === 'relative') {
        const bearing = npc.gps.bearing_degrees || 0;
        const dist = npc.gps.distance_meters || 10;
        const abs = this.geo.calculateRelativePosition(originLat, originLng, bearing, dist);
        npc.gps.lat = abs.lat;
        npc.gps.lng = abs.lng;
        delete npc.gps.type;
      }
    }
    this._resolved = true;
  }

  getGlobalNpc(npcId) {
    return (this.campaign.npcs || []).find(n => n.id === npcId);
  }

  isVisible(npc) {
    return this._evaluateCondition(npc.visible_condition);
  }

  // NPCs visible on the GPS map (global NPCs with GPS)
  getVisibleNpcs() {
    const result = [];
    for (const npc of this.campaign.npcs || []) {
      if (npc.gps && npc.gps.lat != null && npc.gps.lng != null && this.isVisible(npc)) result.push(npc);
    }
    return result;
  }

  isInInteractRange(npc, pos) {
    if (!npc.gps || pos.lat == null) return false;
    const dist = this.geo.distance(pos.lat, pos.lng, npc.gps.lat, npc.gps.lng);
    return dist <= (npc.gps.interact_radius_meters || 5);
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

  _evaluateSingleCondition(cond) {
    if (!cond) return true;
    if (cond.has_item) return window.game?.inventory?.has(cond.has_item) || false;
    if (cond.var !== undefined) {
      const varValue = window.game?.variables?.[cond.var];
      return String(varValue).toLowerCase() === String(cond.eq).toLowerCase();
    }
    return true;
  }

  interact(npcId) {
    const npc = this.getGlobalNpc(npcId);
    if (!npc) return false;
    const interactData = npc.on_interact;
    if (!interactData) return false;

    const pass = this._evaluateCondition(interactData.condition);
    const branch = pass ? interactData : (interactData.else || null);

    if (branch) {
      if (branch.text) {
        UIComponents.toast(branch.text);
      }
      if (branch.actions && window.game) {
        window.game.executeActions(branch.actions);
      }
    }
    if (window.game) window.game._autoSave();
    return true;
  }

  getNpcsAt(lat, lng, radius) {
    const pos = {lat, lng};
    return this.getVisibleNpcs().filter(npc => this.isInInteractRange(npc, pos));
  }
}
