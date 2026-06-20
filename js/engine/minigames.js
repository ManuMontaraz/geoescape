// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Manuel Arjona Blanco <manuel@manumontaraz.es>

/* global UIComponents */

/**
 * MinigameManager - routes and manages minigame overlays
 */
class MinigameManager {
  constructor(renderer) {
    this.renderer = renderer;
    this.active = null; // current minigame instance
    this.overlayEl = null;
  }

  start(config, onSuccessCallback) {
    if (this.active) this.close();
    this.renderer.state.set('puzzle');

    const wrap = document.createElement('div');
    wrap.id = 'minigame-overlay';
    wrap.className = 'minigame-overlay';
    document.body.appendChild(wrap);
    this.overlayEl = wrap;

    switch (config.type) {
      case 'cryptex':
        this.active = new CryptexMinigame(this, config, onSuccessCallback);
        break;
      default:
        console.warn('Unknown minigame type:', config.type);
        this.close();
        return;
    }
  }

  close() {
    if (this.active) {
      this.active.destroy();
      this.active = null;
    }
    if (this.overlayEl) {
      this.overlayEl.remove();
      this.overlayEl = null;
    }
    this.renderer.state.set('playing');
  }
}

/**
 * CryptexMinigame - scrollable symbol wheels puzzle
 */
class CryptexMinigame {
  constructor(manager, config, onSuccess) {
    this.manager = manager;
    this.config = config;
    this.onSuccess = onSuccess;
    this.symbols = config.symbols || 'ABCDEFGHI';
    this.wheels = Math.max(1, parseInt(config.wheels) || 3);
    this.solution = Array.isArray(config.solution) ? config.solution : [];
    this.positions = new Array(this.wheels).fill(0);
    this.container = null;
    this.render();
  }

  render() {
    const overlay = this.manager.overlayEl;
    if (!overlay) return;

    // Title
    const title = document.createElement('div');
    title.className = 'cryptex-title';
    title.textContent = 'Criptex';
    overlay.appendChild(title);

    // Exit button
    const exitBtn = document.createElement('button');
    exitBtn.className = 'cryptex-exit-btn';
    exitBtn.textContent = 'Salir';
    exitBtn.onclick = () => {
      this.manager.close();
      if (this.manager.renderer) this.manager.renderer._autoSave();
    };
    overlay.appendChild(exitBtn);

    // Wheels container
    this.container = document.createElement('div');
    this.container.className = 'cryptex-wheels';
    overlay.appendChild(this.container);

    // Build each wheel
    for (let w = 0; w < this.wheels; w++) {
      const wheel = document.createElement('div');
      wheel.className = 'cryptex-wheel';
      wheel.dataset.index = w;

      // Up arrow
      const upBtn = document.createElement('button');
      upBtn.className = 'cryptex-btn-up';
      upBtn.textContent = '▲';
      upBtn.onclick = () => this._cycleWheel(w, -1);
      wheel.appendChild(upBtn);

      // Symbol strip (shows prev, current, next)
      const strip = document.createElement('div');
      strip.className = 'cryptex-strip';
      strip.dataset.wheel = w;
      wheel.appendChild(strip);

      // Down arrow
      const downBtn = document.createElement('button');
      downBtn.className = 'cryptex-btn-down';
      downBtn.textContent = '▼';
      downBtn.onclick = () => this._cycleWheel(w, 1);
      wheel.appendChild(downBtn);

      this.container.appendChild(wheel);
    }

    // Try button
    const tryBtn = document.createElement('button');
    tryBtn.className = 'cryptex-try-btn';
    tryBtn.textContent = 'Probar';
    tryBtn.onclick = () => this._tryUnlock();
    overlay.appendChild(tryBtn);

    // Touch swipe support
    this._setupSwipe();

    // Initial render
    this._updateDisplay();
  }

  _cycleWheel(wheelIndex, direction) {
    const len = this.symbols.length;
    this.positions[wheelIndex] = (this.positions[wheelIndex] + direction + len) % len;
    this._updateDisplay();
  }

  _updateDisplay() {
    const strips = this.container.querySelectorAll('.cryptex-strip');
    strips.forEach((strip, w) => {
      const pos = this.positions[w];
      const len = this.symbols.length;
      const prev = this.symbols[(pos - 1 + len) % len];
      const curr = this.symbols[pos];
      const next = this.symbols[(pos + 1) % len];
      strip.innerHTML = `
        <div class="cryptex-symbol cryptex-symbol-prev">${this._esc(prev)}</div>
        <div class="cryptex-symbol cryptex-symbol-active">${this._esc(curr)}</div>
        <div class="cryptex-symbol cryptex-symbol-next">${this._esc(next)}</div>
      `;
    });
  }

  _tryUnlock() {
    // Check if solution matches
    let match = true;
    for (let i = 0; i < this.wheels; i++) {
      if (this.positions[i] !== this.solution[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      this._onSuccess();
    } else {
      // Shake animation for feedback
      this.container.classList.add('shake');
      setTimeout(() => this.container.classList.remove('shake'), 400);
    }
  }

  _onSuccess() {
    // Success glow animation
    const wheels = this.container.querySelectorAll('.cryptex-wheel');
    wheels.forEach(w => w.classList.add('success-glow'));

    setTimeout(() => {
      this.manager.close();
      if (this.onSuccess) this.onSuccess();
      if (this.manager.renderer) this.manager.renderer._autoSave();
    }, 800);
  }

  _setupSwipe() {
    const wheels = this.container.querySelectorAll('.cryptex-wheel');
    wheels.forEach((wheel, idx) => {
      let startY = 0;
      wheel.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
      }, { passive: true });
      wheel.addEventListener('touchend', (e) => {
        const endY = e.changedTouches[0].clientY;
        const diff = endY - startY;
        if (Math.abs(diff) > 30) {
          this._cycleWheel(idx, diff > 0 ? -1 : 1); // swipe up = prev, down = next
        }
      }, { passive: true });
    });
  }

  _esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  destroy() {
    // DOM cleanup handled by removing overlay parent
  }
}
