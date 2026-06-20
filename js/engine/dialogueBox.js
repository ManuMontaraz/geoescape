// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Manuel Arjona Blanco <manuel@manumontaraz.es>

class DialogueBox {
  constructor() {
    this.el = document.getElementById('dialogue-box');
    this.speakerEl = document.getElementById('dialogue-speaker');
    this.textEl = document.getElementById('dialogue-text');
    this.optionsEl = document.getElementById('dialogue-options');
    this.onComplete = null;
    this.isOpen = false;
  }

  show(text, speaker, options) {
    // Close any open panels
    const invPanel = document.getElementById('inventory-panel');
    const menuPanel = document.getElementById('menu-panel');
    if (invPanel) invPanel.classList.add('hidden');
    if (menuPanel) menuPanel.classList.add('hidden');
    
    this.textEl.textContent = text;
    this.speakerEl.textContent = speaker || '';
    this.optionsEl.innerHTML = '';
    if (options && options.length > 0) {
      for (const opt of options) {
        const btn = document.createElement('button');
        btn.className = 'dialogue-option';
        btn.textContent = opt.text || '...';
        btn.onclick = () => this._choose(opt);
        this.optionsEl.appendChild(btn);
      }
    } else {
      const btn = document.createElement('button');
      btn.className = 'dialogue-option';
      btn.textContent = 'Continuar';
      btn.onclick = () => this._finish();
      this.optionsEl.appendChild(btn);
    }
    this.el.classList.remove('hidden');
    this.isOpen = true;
    document.body.classList.add('dialogue-active');
  }

  _choose(opt) {
    this.hide();
    if (opt.actions) {
      // Defer so the engine can pick up the actions and continue the queue
      setTimeout(() => {
        if (this.onComplete) this.onComplete(opt.actions);
      }, 0);
    } else {
      this._finish();
    }
  }

  _finish() {
    this.hide();
    if (this.onComplete) this.onComplete([]);
  }

  hide() {
    this.el.classList.add('hidden');
    this.isOpen = false;
    document.body.classList.remove('dialogue-active');
  }
}
