class Inventory {
  constructor(maxSlots = 8) {
    this.items = [];
    this.maxSlots = maxSlots;
    this.selectedItem = null;
    this.renderer = null;
  }

  setRenderer(renderer) {
    this.renderer = renderer;
  }

  add(item) {
    if (this.items.length >= this.maxSlots) {
      return {success: false, msg: 'Inventario lleno'};
    }
    this.items.push({...item, uid: Date.now() + Math.random()});
    this.render();
    return {success: true};
  }

  remove(itemId) {
    const idx = this.items.findIndex(i => i.id === itemId);
    if (idx > -1) {
      this.items.splice(idx, 1);
      this.render();
      return true;
    }
    return false;
  }

  has(itemId) {
    return this.items.some(i => i.id === itemId);
  }

  select(index) {
    if (index < 0 || index >= this.items.length) {
      this.selectedItem = null;
    } else {
      this.selectedItem = this.items[index];
    }
    this.render();
  }

  useSelectedItem() {
    if (!this.selectedItem || !this.renderer) return;
    this.renderer.useItem(this.selectedItem.id);
  }

  render() {
    const grid = document.getElementById('inv-grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 0; i < this.maxSlots; i++) {
      const slot = document.createElement('div');
      slot.className = 'inv-slot';
      if (this.items[i]) {
        slot.classList.add('occupied');
        const iconUrl = AssetResolver.itemIcon(this.items[i].icon || 'coin');
        slot.innerHTML = `<img src="${iconUrl}" style="width:70%;height:70%;object-fit:contain;" alt="${this.items[i].name}">`;
        if (this.selectedItem && this.selectedItem.uid === this.items[i].uid) {
          slot.style.borderColor = '#f1c40f';
        }
        slot.onclick = () => this.select(i);
      } else {
        slot.onclick = () => this.select(-1);
      }
      grid.appendChild(slot);
    }

    // Show/hide item info and use button
    const infoDiv = document.getElementById('inv-item-info');
    const infoName = document.getElementById('inv-item-name');
    const infoDesc = document.getElementById('inv-item-desc');
    const actionsDiv = document.getElementById('inv-actions');
    const useBtn = document.getElementById('inv-use');
    
    if (infoDiv && infoName && infoDesc) {
      if (this.selectedItem) {
        infoDiv.style.display = '';
        infoName.textContent = this.selectedItem.name;
        infoDesc.textContent = this.selectedItem.description || 'No hay descripción.';
      } else {
        infoDiv.style.display = 'none';
      }
    }
    
    if (actionsDiv && useBtn) {
      if (this.selectedItem) {
        actionsDiv.style.display = '';
        useBtn.onclick = () => this.useSelectedItem();
      } else {
        actionsDiv.style.display = 'none';
        useBtn.onclick = null;
      }
    }
  }
}
