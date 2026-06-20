// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Manuel Arjona Blanco <manuel@manumontaraz.es>

/**
 * DialogueModal - Recursive modal for editing dialogue actions
 * Each instance creates its own DOM element and manages its own state
 */
class DialogueModal {
  constructor(parentModal, actionsArray, actionIndex) {
    this.parentModal = parentModal; // null for root modal
    this.actionsArray = actionsArray; // reference to the array containing this action
    this.actionIndex = actionIndex; // index within the array
    
    this.element = null;
    this.uniqueId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    this.optionsCounter = 0;
    
    // Get the action data
    this.action = this.actionsArray[this.actionIndex] || { type: 'dialogue', text: '', speaker: '', options: [] };
  }
  
  open() {
    // Clone template
    const template = document.getElementById('dialogue-modal-template');
    if (!template) {
      console.error('Dialogue modal template not found');
      return;
    }
    
    const clone = template.content.cloneNode(true);
    this.element = clone.querySelector('.dialogue-modal-overlay');
    this.element.id = 'dialogue-modal-' + this.uniqueId;
    
    // Bind close button
    this.element.querySelector('.dialogue-modal-close').addEventListener('click', () => this.close());
    
    // Bind close button (replaces save/cancel)
    const closeBtn = this.element.querySelector('.btn-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }
    
    // Bind add option button
    this.element.querySelector('.btn-add-option').addEventListener('click', () => this.addOption());
    
    // Add to body
    document.body.appendChild(this.element);
    
    // Render content
    this.render();
    
    // Attach auto-save listeners
    this._attachAutoSaveListeners();
    
    // Prevent closing when clicking inside
    this.element.querySelector('.dialogue-modal-content').addEventListener('click', (e) => e.stopPropagation());
    
    // Close on overlay click
    this.element.addEventListener('click', () => this.close());
  }
  
  render() {
    if (!this.element) return;
    
    // Fill text and speaker
    this.element.querySelector('.dialogue-text').value = this.action.text || '';
    this.element.querySelector('.dialogue-speaker').value = this.action.speaker || '';
    
    // Render options
    this.renderOptions();
  }
  
  renderOptions() {
    const optionsContainer = this.element.querySelector('.dialogue-options');
    const options = this.action.options || [];
    
    let html = '';
    for (let i = 0; i < options.length; i++) {
      html += this._optionHTML(options[i], i);
    }
    
    optionsContainer.innerHTML = html;
    
    // Bind option events
    this.element.querySelectorAll('.dialogue-option').forEach((optEl, i) => {
      // Toggle actions
      const toggleBtn = optEl.querySelector('.btn-toggle-actions');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => this.toggleOption(i));
      }
      
      // Remove option
      const removeBtn = optEl.querySelector('.btn-remove-option');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => this.removeOption(i));
      }
      
      // Add action
      const addActionBtn = optEl.querySelector('.btn-add-action');
      if (addActionBtn) {
        addActionBtn.addEventListener('click', () => this.addOptionAction(i));
      }
      
      // Action events
      const actionsContainer = optEl.querySelector('.option-actions');
      if (actionsContainer) {
        actionsContainer.querySelectorAll('.option-action-row').forEach((row, j) => {
          // Type change
          const typeSelect = row.querySelector('.action-type');
          if (typeSelect) {
            typeSelect.addEventListener('change', (e) => this.onOptionActionTypeChange(i, j, e.target.value));
          }
          
          // Remove action
          const removeBtn = row.querySelector('.btn-remove-action');
          if (removeBtn) {
            removeBtn.addEventListener('click', () => this.removeOptionAction(i, j));
          }
          
          // Edit dialogue (nested)
          const editBtn = row.querySelector('.btn-edit-dialogue');
          if (editBtn) {
            editBtn.addEventListener('click', () => this.openNestedDialogue(i, j));
          }
        });
      }
    });
  }
  
  _optionHTML(option, index) {
    const actions = option.actions || [];
    const expanded = option._expanded !== false;
    
    let actionsHtml = '';
    if (expanded) {
      for (let i = 0; i < actions.length; i++) {
        actionsHtml += this._optionActionHTML(actions[i], i);
      }
    }
    
    return `
      <div class="dialogue-option" style="border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:0.5rem;margin-bottom:0.5rem;">
        <div style="display:flex;align-items:center;gap:0.3rem;margin-bottom:0.3rem;">
          <input type="text" class="option-text" data-option-index="${index}" value="${this._esc(option.text || '')}" placeholder="Texto de la opción..." style="flex:1;padding:0.3rem;background:#000;color:var(--text);border:1px solid var(--accent);border-radius:4px;">
          <button type="button" class="btn btn-sm btn-secondary btn-toggle-actions">${expanded ? '▲' : '▼'}</button>
          <button type="button" class="btn btn-sm btn-danger btn-remove-option">×</button>
        </div>
        <div class="option-actions ${expanded ? '' : 'hidden'}" style="padding-left:1rem;">
          ${actionsHtml}
          <button type="button" class="btn btn-sm btn-add btn-add-action" style="width:100%;margin-top:0.3rem;">+ Añadir acción</button>
        </div>
      </div>
    `;
  }
  
  _optionActionHTML(action, index) {
    const type = action.type || 'text';
    let paramHTML = '';
    
    if (type === 'text') {
      paramHTML = `<input type="text" class="action-param" data-action-index="${index}" data-field="value" value="${this._esc(action.value || '')}" placeholder="Texto..." style="flex:1;padding:0.3rem;background:#000;color:var(--text);border:1px solid var(--accent);border-radius:4px;">`;
    } else if (type === 'add_item' || type === 'remove_item') {
      const itemOpts = (window.editor?.campaign?.items || []).map(it => `<option value="${this._esc(it.id)}" ${(action.item_id === it.id) ? 'selected' : ''}>${this._esc(it.name)}</option>`).join('');
      paramHTML = `<select class="action-param" data-action-index="${index}" data-field="item_id" style="flex:1;padding:0.3rem;background:#000;color:var(--text);border:1px solid var(--accent);border-radius:4px;">${itemOpts}</select>`;
    } else if (type === 'set_var') {
      paramHTML = `
        <input type="text" class="action-param" data-action-index="${index}" data-field="key" value="${this._esc(action.key || '')}" placeholder="var" style="flex:1;padding:0.3rem;background:#000;color:var(--text);border:1px solid var(--accent);border-radius:4px;">
        <input type="text" class="action-param" data-action-index="${index}" data-field="value" value="${this._esc(String(action.value ?? ''))}" placeholder="valor" style="flex:1;padding:0.3rem;background:#000;color:var(--text);border:1px solid var(--accent);border-radius:4px;">
      `;
    } else if (type === 'change_scene') {
      const locOpts = (window.editor?.campaign?.locations || []).map(l => `<option value="${this._esc(l.id)}" ${(action.target === l.id) ? 'selected' : ''}>${this._esc(l.name)}</option>`).join('');
      paramHTML = `<select class="action-param" data-action-index="${index}" data-field="target" style="flex:1;padding:0.3rem;background:#000;color:var(--text);border:1px solid var(--accent);border-radius:4px;">${locOpts}</select>`;
    } else if (type === 'trigger_event') {
      const evtOpts = (window.editor?.campaign?.events || []).map(e => `<option value="${this._esc(e.id)}" ${(action.event_id === e.id) ? 'selected' : ''}>${this._esc(e.id)}</option>`).join('');
      paramHTML = `<select class="action-param" data-action-index="${index}" data-field="event_id" style="flex:1;padding:0.3rem;background:#000;color:var(--text);border:1px solid var(--accent);border-radius:4px;">${evtOpts}</select>`;
    } else if (type === 'exit_scene') {
      paramHTML = `<span style="color:var(--text-muted);">Salir al mapa</span>`;
    } else if (type === 'finish_campaign') {
      paramHTML = `<input type="text" class="action-param" data-action-index="${index}" data-field="text" value="${this._esc(action.text || '')}" placeholder="Texto de despedida" style="flex:1;padding:0.3rem;background:#000;color:var(--text);border:1px solid var(--accent);border-radius:4px;">`;
    } else if (type === 'dialogue') {
      const optsCount = (action.options || []).length;
      paramHTML = `
        <span style="color:var(--text-muted);font-size:0.85rem;">
          <i class="fa-solid fa-comments"></i> "${this._esc(action.text || 'Sin texto')}" (${optsCount} opción${optsCount !== 1 ? 'es' : ''})
        </span>
        <button type="button" class="btn btn-sm btn-secondary btn-edit-dialogue">Editar</button>
      `;
    }
    
    const typeOpts = [
      ['text', 'Texto'], ['add_item', 'Añadir item'], ['remove_item', 'Quitar item'],
      ['set_var', 'Establecer var'], ['change_scene', 'Cambiar escena'],
      ['exit_scene', 'Salir de escena'], ['trigger_event', 'Evento'],
      ['dialogue', 'Diálogo'], ['finish_campaign', 'Terminar caso']
    ].map(([v, l]) => `<option value="${v}" ${type === v ? 'selected' : ''}>${l}</option>`).join('');
    
    return `
      <div class="option-action-row" style="display:flex;align-items:center;gap:0.3rem;margin-bottom:0.3rem;">
        <select class="action-type" data-action-index="${index}" style="padding:0.3rem;background:#000;color:var(--text);border:1px solid var(--accent);border-radius:4px;">${typeOpts}</select>
        ${paramHTML}
        <button type="button" class="btn btn-sm btn-danger btn-remove-action">×</button>
      </div>
    `;
  }
  
  addOption() {
    const options = this.action.options || [];
    options.push({ text: '', actions: [], _expanded: true });
    this.renderOptions();
    this.save(); // Immediate save
  }
  
  removeOption(index) {
    const options = this.action.options || [];
    options.splice(index, 1);
    this.renderOptions();
    this.save(); // Immediate save
  }
  
  toggleOption(index) {
    const options = this.action.options || [];
    if (options[index]) {
      options[index]._expanded = !options[index]._expanded;
      this.renderOptions();
    }
    // No save needed for toggle (visual only)
  }
  
  addOptionAction(optIndex) {
    const options = this.action.options || [];
    if (options[optIndex]) {
      options[optIndex].actions.push({ type: 'text', value: '' });
      options[optIndex]._expanded = true;
      this.renderOptions();
      this.save(); // Immediate save
    }
  }
  
  removeOptionAction(optIndex, actionIndex) {
    const options = this.action.options || [];
    if (options[optIndex] && options[optIndex].actions) {
      options[optIndex].actions.splice(actionIndex, 1);
      this.renderOptions();
      this.save(); // Immediate save
    }
  }
  
  onOptionActionTypeChange(optIndex, actionIndex, newType) {
    const options = this.action.options || [];
    if (options[optIndex] && options[optIndex].actions[actionIndex]) {
      if (newType === 'dialogue') {
        options[optIndex].actions[actionIndex] = { type: 'dialogue', text: '', speaker: '', options: [] };
      } else {
        options[optIndex].actions[actionIndex] = { type: newType };
      }
      this.renderOptions();
      this.save(); // Immediate save
    }
  }
  
  openNestedDialogue(optIndex, actionIndex) {
    const options = this.action.options || [];
    if (options[optIndex] && options[optIndex].actions[actionIndex]) {
      const nestedModal = new DialogueModal(this, options[optIndex].actions, actionIndex);
      nestedModal.open();
    }
  }
  
  collectOptions() {
    const options = [];
    const currentOptions = this.action.options || [];
    
    this.element.querySelectorAll('.dialogue-option').forEach((optEl, optIndex) => {
      const opt = {};
      const textInput = optEl.querySelector('.option-text');
      if (textInput) opt.text = textInput.value;
      
      const actions = [];
      const actionsContainer = optEl.querySelector('.option-actions');
      if (actionsContainer) {
        const currentActions = currentOptions[optIndex]?.actions || [];
        actionsContainer.querySelectorAll('.option-action-row').forEach((row, actionIndex) => {
          const typeSel = row.querySelector('.action-type');
          if (!typeSel) return;
          const type = typeSel.value;
          
          // Para diálogos anidados, usar la acción del array actual (ya actualizada por el modal hijo)
          if (type === 'dialogue') {
            if (currentActions[actionIndex] && currentActions[actionIndex].type === 'dialogue') {
              // Clean the nested action to remove internal properties
              const cleanAction = this._cleanActionForJSON(currentActions[actionIndex]);
              actions.push(cleanAction);
            } else {
              actions.push({ type: 'dialogue', text: '', speaker: '', options: [] });
            }
            return;
          }
          
          const action = { type };
          row.querySelectorAll('.action-param').forEach(el => {
            const field = el.dataset.field;
            let val = el.value;
            if (field === 'value' && type === 'set_var') {
              if (val === 'true') val = true;
              else if (val === 'false') val = false;
              else if (!isNaN(val) && val.trim() !== '') val = Number(val);
            }
            action[field] = val;
          });
          actions.push(action);
        });
      }
      opt.actions = actions;
      options.push(opt);
    });
    // Clean all options to remove internal properties
    return options.map(opt => {
      if (opt.actions) {
        opt.actions = opt.actions.map(action => this._cleanActionForJSON(action));
      }
      return opt;
    });
  }
  
  _cleanActionForJSON(action) {
    if (!action || typeof action !== 'object') return action;
    // Create a clean copy without internal properties
    const clean = {};
    for (const key of Object.keys(action)) {
      if (key.startsWith('_')) continue; // Skip internal properties like _expanded
      const val = action[key];
      if (val === undefined || typeof val === 'function') continue;
      if (Array.isArray(val)) {
        clean[key] = val.map(item => this._cleanActionForJSON(item));
      } else if (typeof val === 'object' && val !== null) {
        clean[key] = this._cleanActionForJSON(val);
      } else {
        clean[key] = val;
      }
    }
    return clean;
  }
  
  save() {
    if (!this.element) return;
    
    // Collect data from DOM
    const textEl = this.element.querySelector('.dialogue-text');
    const speakerEl = this.element.querySelector('.dialogue-speaker');
    const text = textEl ? textEl.value : '';
    const speaker = speakerEl ? speakerEl.value : '';
    const options = this.collectOptions();
    
    console.log('[DialogueModal] Saving:', text, '- Options:', options.length);
    
    // Clean internal properties from the action before saving
    const cleanAction = this._cleanActionForJSON(this.action);
    
    // Update the action in the array
    cleanAction.text = text;
    cleanAction.speaker = speaker;
    cleanAction.options = options;
    
    // Replace the action in the parent array with the clean version
    this.actionsArray[this.actionIndex] = cleanAction;
    this.action = cleanAction;
    
    console.log('[DialogueModal] Action updated:', this.action);
    
    // Validate JSON
    try {
      JSON.stringify(this.action);
    } catch (e) {
      console.error('JSON invalid after save:', e);
      alert('Error: La estructura del diálogo es inválida. No se puede serializar. Revisa las opciones anidadas.');
    }
    
    // Show visual feedback
    this._showAutoSaveIndicator();
  }
  
  _showAutoSaveIndicator() {
    if (!this.element) return;
    const indicator = this.element.querySelector('.dialogue-autosave-indicator');
    if (indicator) {
      indicator.style.opacity = '1';
      setTimeout(() => {
        if (indicator) indicator.style.opacity = '0';
      }, 1500);
    }
  }
  
  close() {
    // Save before closing (capture everything from DOM)
    this.save();
    
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
    
    // If there's a parent, re-render it so it shows updated nested dialogue info
    if (this.parentModal) {
      this.parentModal.renderOptions();
      // Also save the parent so the chain propagates up the tree
      this.parentModal.save();
    }
    
    // If this is the root modal (no parent), trigger auto-save on editor
    if (!this.parentModal && window.editor) {
      window.editor._doAutoSave();
    }
  }
  
  _attachAutoSaveListeners() {
    if (!this.element) return;
    
    // Store reference to this modal for the debounce closure
    const modal = this;
    
    // Debounced auto-save for text inputs
    let debounceTimer;
    const debouncedSave = () => {
      console.log('[AutoSave] Debounce triggered for modal:', modal.uniqueId);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log('[AutoSave] Executing save for modal:', modal.uniqueId);
        modal.save();
      }, 500);
    };
    
    // Immediate save on blur/change
    const immediateSave = () => {
      console.log('[AutoSave] Immediate save triggered');
      modal.save();
    };
    
    // Dialogue text and speaker
    const textEl = this.element.querySelector('.dialogue-text');
    const speakerEl = this.element.querySelector('.dialogue-speaker');
    if (textEl) {
      textEl.addEventListener('input', debouncedSave);
      textEl.addEventListener('change', immediateSave);
      textEl.addEventListener('blur', immediateSave);
    }
    if (speakerEl) {
      speakerEl.addEventListener('input', debouncedSave);
      speakerEl.addEventListener('change', immediateSave);
      speakerEl.addEventListener('blur', immediateSave);
    }
    
    // Option texts use event delegation on the container
    const optionsContainer = this.element.querySelector('.dialogue-options');
    if (optionsContainer) {
      optionsContainer.addEventListener('input', (e) => {
        if (e.target.classList.contains('option-text')) {
          debouncedSave();
        }
      });
      optionsContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('option-text')) {
          immediateSave();
        }
      });
      optionsContainer.addEventListener('blur', (e) => {
        if (e.target.classList.contains('option-text')) {
          immediateSave();
        }
      }, true);
    }
  }
  
  _esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

// Make it available globally
window.DialogueModal = DialogueModal;
