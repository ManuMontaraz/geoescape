class StateMachine {
  constructor() {
    this.state = 'loading'; // loading, playing, puzzle, dialogue, overlay
    this.listeners = [];
  }

  set(state) {
    this.state = state;
    this.listeners.forEach(cb => cb(state));
  }

  get() {
    return this.state;
  }

  onChange(cb) {
    this.listeners.push(cb);
  }
}
