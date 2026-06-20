// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Manuel Arjona Blanco <manuel@manumontaraz.es>

class TextOverlay {
  constructor() {
    this.el = document.getElementById('text-overlay');
    this.content = document.getElementById('text-content');
    this.closeBtn = document.getElementById('text-close');
    this.queue = [];
    this.isOpen = false;
    this.onComplete = null;
    this.closeBtn.onclick = () => this.advance();
  }

  show(text) {
    this.queue.push(text);
    if (!this.isOpen) this.advance();
  }

  advance() {
    if (this.queue.length === 0) {
      this.hide();
      if (this.onComplete) this.onComplete();
      return;
    }
    const text = this.queue.shift();
    this.content.textContent = text;
    this.el.classList.remove('hidden');
    this.isOpen = true;
    document.body.classList.add('text-overlay-active');
    
    // Close any open panels
    const invPanel = document.getElementById('inventory-panel');
    const menuPanel = document.getElementById('menu-panel');
    if (invPanel) invPanel.classList.add('hidden');
    if (menuPanel) menuPanel.classList.add('hidden');
  }

  hide() {
    this.el.classList.add('hidden');
    this.isOpen = false;
    document.body.classList.remove('text-overlay-active');
  }
}
