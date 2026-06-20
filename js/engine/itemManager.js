// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Manuel Arjona Blanco <manuel@manumontaraz.es>

class ItemManager {
  constructor(geoManager, campaign) {
    this.geo = geoManager;
    this.campaign = campaign;
    this.pickedUp = new Set(); // item ids
    this.items = campaign.items || [];
    this._resolved = false;
  }

  resolveGPS(originLat, originLng) {
    if (this._resolved) return;
    for (const item of this.items) {
      if (item.gps && item.gps.type === 'relative') {
        const bearing = item.gps.bearing_degrees || 0;
        const dist = item.gps.distance_meters || 10;
        const abs = this.geo.calculateRelativePosition(originLat, originLng, bearing, dist);
        item.gps.lat = abs.lat;
        item.gps.lng = abs.lng;
        delete item.gps.type;
      }
    }
    this._resolved = true;
  }

  isPickedUp(itemId) {
    return this.pickedUp.has(itemId) || (window.game?.variables?.['item_' + itemId + '_picked'] === true);
  }

  markPickedUp(itemId) {
    this.pickedUp.add(itemId);
    if (window.game) window.game.variables['item_' + itemId + '_picked'] = true;
  }

  isVisible(item, pos = null) {
    if (this.isPickedUp(item.id)) return false;

    // Check visibility radius
    if (pos && item.gps?.visibility_radius_meters != null) {
      const dist = this.geo.distance(pos.lat, pos.lng, item.gps.lat, item.gps.lng);
      if (dist > item.gps.visibility_radius_meters) return false;
    }

    if (!this._evaluateCondition(item.visible_condition)) return false;
    return true;
  }

  getVisibleItems(pos = null) {
    return this.items.filter(item => item.gps && item.gps.lat != null && item.gps.lng != null && this.isVisible(item, pos));
  }

  isInPickupRange(item, pos) {
    if (!item.gps || pos.lat == null) return false;
    const dist = this.geo.distance(pos.lat, pos.lng, item.gps.lat, item.gps.lng);
    return dist <= (item.gps.pickup_radius_meters || 5);
  }

  getDistanceText(item, pos) {
    if (!item.gps || pos.lat == null) return null;
    const dist = this.geo.distance(pos.lat, pos.lng, item.gps.lat, item.gps.lng);
    if (dist < 1000) return `${Math.round(dist)}m`;
    return `${(dist/1000).toFixed(1)}km`;
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

  pickup(itemId) {
    const item = this.items.find(i => i.id === itemId);
    if (!item || this.isPickedUp(itemId)) return false;

    // Solo recoger si cabe en el inventario
    if (window.game && window.game.inventory) {
      const res = window.game.inventory.add(item);
      if (!res.success) {
        UIComponents.toast(res.msg || 'Inventario lleno');
        return false; // No marcar como recogido, item sigue en el mapa
      }
    }

    this.markPickedUp(itemId); // Solo si entró al inventario

    const pickupData = item.on_pickup;
    if (pickupData) {
      const pass = this._evaluateCondition(pickupData.condition);
      const branch = pass ? pickupData : (pickupData.else || null);

      if (branch) {
        if (branch.text) {
          UIComponents.toast(branch.text);
        }
        if (branch.actions && window.game) {
          window.game.executeActions(branch.actions);
        }
      }
    }
    if (window.game) window.game._autoSave();
    return true;
  }

  getItemsAt(lat, lng, radius) {
    const pos = {lat, lng};
    return this.getVisibleItems().filter(item => this.isInPickupRange(item, pos));
  }
}
