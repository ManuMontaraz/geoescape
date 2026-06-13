const UIComponents = {
  showModal(title, message, onOk) {
    const div = document.createElement('div');
    div.className = 'modal-overlay';
    div.innerHTML = `
      <div class="modal-box">
        <h3>${title}</h3>
        <p>${message}</p>
        <button class="ui-btn modal-ok">OK</button>
      </div>
    `;
    div.querySelector('.modal-ok').onclick = () => {
      div.remove();
      if (onOk) onOk();
    };
    document.body.appendChild(div);
  },

  toast(message) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = message;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2000);
  }
};
