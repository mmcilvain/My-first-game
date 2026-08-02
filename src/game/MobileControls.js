export class MobileControls {
  constructor(root, callbacks = {}) {
    this.root = root;
    this.callbacks = callbacks;
    this.joystick = root.querySelector('#joystick');
    this.knob = root.querySelector('#joystickKnob');
    this.lookRegion = root.querySelector('#lookRegion');
    this.joystickPointer = null;
    this.lookPointer = null;
    this.joystickCenter = { x: 0, y: 0 };
    this.lookLast = { x: 0, y: 0 };
    this.actionButtons = new Map();
    this.bindJoystick();
    this.bindLook();
    this.bindAction('mobileFire', 'fire', true);
    this.bindAction('mobileAim', 'aim', true);
    this.bindAction('mobileSprint', 'sprint', true);
    this.bindAction('mobileJump', 'jump', false);
    this.bindAction('mobileReload', 'reload', false);
    this.bindAction('mobileCrouch', 'crouchToggle', false);
  }

  bindJoystick() {
    const begin = (event) => {
      event.preventDefault();
      if (this.joystickPointer !== null) return;
      this.joystickPointer = event.pointerId;
      this.joystick.setPointerCapture?.(event.pointerId);
      const rect = this.joystick.getBoundingClientRect();
      this.joystickCenter.x = rect.left + rect.width / 2;
      this.joystickCenter.y = rect.top + rect.height / 2;
      this.updateJoystick(event);
    };
    const move = (event) => { if (event.pointerId === this.joystickPointer) { event.preventDefault(); this.updateJoystick(event); } };
    const end = (event) => { if (event.pointerId === this.joystickPointer) { this.joystickPointer = null; this.knob.style.transform = 'translate(0, 0)'; this.callbacks.onMove?.(0, 0); } };
    this.joystick.addEventListener('pointerdown', begin, { passive: false });
    this.joystick.addEventListener('pointermove', move, { passive: false });
    this.joystick.addEventListener('pointerup', end, { passive: false });
    this.joystick.addEventListener('pointercancel', end, { passive: false });
  }

  updateJoystick(event) {
    const max = 46;
    let dx = event.clientX - this.joystickCenter.x;
    let dy = event.clientY - this.joystickCenter.y;
    const length = Math.hypot(dx, dy);
    if (length > max) { dx = (dx / length) * max; dy = (dy / length) * max; }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.callbacks.onMove?.(dx / max, -dy / max);
  }

  bindLook() {
    this.lookRegion.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (this.lookPointer !== null) return;
      this.lookPointer = event.pointerId;
      this.lookRegion.setPointerCapture?.(event.pointerId);
      this.lookLast.x = event.clientX; this.lookLast.y = event.clientY;
    }, { passive: false });
    this.lookRegion.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.lookPointer) return;
      event.preventDefault();
      const dx = event.clientX - this.lookLast.x;
      const dy = event.clientY - this.lookLast.y;
      this.lookLast.x = event.clientX; this.lookLast.y = event.clientY;
      this.callbacks.onLook?.(dx, dy);
    }, { passive: false });
    const end = (event) => { if (event.pointerId === this.lookPointer) this.lookPointer = null; };
    this.lookRegion.addEventListener('pointerup', end, { passive: false });
    this.lookRegion.addEventListener('pointercancel', end, { passive: false });
  }

  bindAction(id, action, hold) {
    const button = this.root.querySelector(`#${id}`);
    if (!button) return;
    this.actionButtons.set(action, button);
    const down = (event) => { event.preventDefault(); button.classList.add('active'); this.callbacks.onAction?.(action, true); };
    const up = (event) => { event.preventDefault(); button.classList.remove('active'); if (hold) this.callbacks.onAction?.(action, false); };
    button.addEventListener('pointerdown', down, { passive: false });
    button.addEventListener('pointerup', up, { passive: false });
    button.addEventListener('pointercancel', up, { passive: false });
    button.addEventListener('pointerleave', (event) => { if (hold && event.buttons === 0) up(event); }, { passive: false });
  }

  setVisible(visible) { this.root.classList.toggle('hidden', !visible); }
}
