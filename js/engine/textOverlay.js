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
  }

  hide() {
    this.el.classList.add('hidden');
    this.isOpen = false;
  }
}
