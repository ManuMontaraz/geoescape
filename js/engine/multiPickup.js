const MultiPickup = {
  show(items, npcs, lat, lng, onPickItem, onInteractNpc) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box" style="max-width: 350px;">
        <h3>Entidades cercanas</h3>
        <div id="multi-list" style="max-height: 200px; overflow-y: auto; margin: 1rem 0; text-align: left;"></div>
        <button class="ui-btn modal-ok" style="width:100%;">Cerrar</button>
      </div>
    `;

    const list = overlay.querySelector('#multi-list');

    for (const item of items) {
      const div = document.createElement('div');
      div.style.cssText = 'padding:0.5rem;border-bottom:1px solid rgba(255,255,255,0.1);display:flex;justify-content:space-between;align-items:center;';
      div.innerHTML = `<span>🪙 ${item.name}</span>`;
      const btn = document.createElement('button');
      btn.className = 'ui-btn';
      btn.textContent = 'Recoger';
      btn.onclick = () => { onPickItem(item.id); overlay.remove(); };
      div.appendChild(btn);
      list.appendChild(div);
    }

    for (const npc of npcs) {
      const div = document.createElement('div');
      div.style.cssText = 'padding:0.5rem;border-bottom:1px solid rgba(255,255,255,0.1);display:flex;justify-content:space-between;align-items:center;';
      div.innerHTML = `<span>🧑 ${npc.name}</span>`;
      const btn = document.createElement('button');
      btn.className = 'ui-btn';
      btn.textContent = 'Interactuar';
      btn.onclick = () => { onInteractNpc(npc.id); overlay.remove(); };
      div.appendChild(btn);
      list.appendChild(div);
    }

    if (items.length === 0 && npcs.length === 0) {
      list.innerHTML = '<p style="color:var(--text-muted);text-align:center;">No hay nada interactuable aquí.</p>';
    }

    overlay.querySelector('.modal-ok').onclick = () => overlay.remove();
    document.body.appendChild(overlay);
  }
};
