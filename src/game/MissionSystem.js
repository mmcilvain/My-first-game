export class MissionSystem {
  constructor(world, player, enemies, callbacks = {}) {
    this.world = world;
    this.player = player;
    this.enemies = enemies;
    this.callbacks = callbacks;
    this.state = 'idle';
    this.blackoutTimer = 0;
    this.elapsed = 0;
    this.activated = new Set();
    this.lastPrompt = '';
  }

  reset() {
    this.state = 'idle';
    this.blackoutTimer = 0;
    this.elapsed = 0;
    this.activated.clear();
    this.lastPrompt = '';
    this.world.terminals?.forEach((terminal) => {
      terminal.activated = false;
      terminal.ring?.material?.color?.set(0x76e8c6);
      terminal.screen?.material?.color?.set(0x9effe3);
      terminal.screen?.material?.emissive?.set(0x28b895);
    });
    this.enemies.reset();
    this.world.setBlackout?.(false);
    this.emitState();
    this.callbacks.onPrompt?.('');
  }

  start() {
    this.reset();
    this.state = 'activate';
    this.callbacks.onToast?.('OPERATION NIGHTFALL // RELAYS OFFLINE');
    this.emitState();
  }

  update(delta, input = {}) {
    if (this.state === 'idle' || this.state === 'complete' || this.state === 'failed') return;
    this.elapsed += delta;
    if (this.player.dead) {
      this.fail();
      return;
    }

    if (this.state === 'activate') {
      const nearest = this.findNearestTerminal();
      const prompt = nearest ? 'PRESS <b>E</b> TO SYNC ' + nearest.label : '';
      if (prompt !== this.lastPrompt) {
        this.lastPrompt = prompt;
        this.callbacks.onPrompt?.(prompt);
      }
      if (nearest && input.interactPressed) this.activate(nearest);
      return;
    }

    this.callbacks.onPrompt?.(this.state === 'extract' ? 'REACH EXTRACTION' : '');
    if (this.state === 'blackout') {
      this.blackoutTimer -= delta;
      if (this.blackoutTimer <= 0) {
        this.state = 'extract';
        this.callbacks.onToast?.('EXTRACTION POINT ACTIVE');
        this.emitState();
      }
      return;
    }

    if (this.state === 'extract') {
      const extraction = this.world.extractionZone;
      if (extraction && this.player.position.distanceTo(extraction.position) <= extraction.radius) this.complete();
    }
  }

  findNearestTerminal() {
    let nearest = null;
    let nearestDistance = Infinity;
    for (const terminal of this.world.terminals ?? []) {
      if (terminal.activated) continue;
      const distance = this.player.position.distanceTo(terminal.position);
      if (distance <= 2.65 && distance < nearestDistance) {
        nearest = terminal;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  activate(terminal) {
    terminal.activated = true;
    this.activated.add(terminal.id);
    terminal.ring?.material?.color?.set(0xffb24d);
    terminal.screen?.material?.color?.set(0xffd28a);
    terminal.screen?.material?.emissive?.set(0xff6a15);
    this.callbacks.onToast?.(terminal.label + ' ONLINE // ' + this.activated.size + '/' + this.world.terminals.length);
    this.emitState();

    if (this.activated.size >= this.world.terminals.length) {
      this.state = 'blackout';
      this.blackoutTimer = 4;
      this.world.setBlackout?.(true);
      this.enemies.setAlerted(true);
      this.callbacks.onToast?.('POWER FAILURE // HOLD THE LINE');
      this.emitState();
    }
  }

  complete() {
    if (this.state === 'complete') return;
    this.state = 'complete';
    this.enemies.setAlerted(false);
    this.callbacks.onToast?.('EXTRACTION COMPLETE // OPERATION SUCCESS');
    this.emitState();
    this.callbacks.onComplete?.();
  }

  fail() {
    if (this.state === 'failed' || this.state === 'complete') return;
    this.state = 'failed';
    this.enemies.setAlerted(false);
    this.callbacks.onToast?.('FIELD FAILURE // OPERATION LOST');
    this.emitState();
    this.callbacks.onFail?.();
  }

  getObjectiveDistance() {
    if (this.state === 'activate') {
      let nearestDistance = Infinity;
      for (const terminal of this.world.terminals ?? []) {
        if (!terminal.activated) nearestDistance = Math.min(nearestDistance, this.player.position.distanceTo(terminal.position));
      }
      return Number.isFinite(nearestDistance) ? nearestDistance : null;
    }
    if (this.state === 'extract') {
      const extraction = this.world.extractionZone;
      return extraction ? this.player.position.distanceTo(extraction.position) : null;
    }
    return null;
  }

  getState() {
    const total = this.world.terminals?.length ?? 0;
    const progress = this.activated.size + '/' + total;
    const states = {
      idle: { objective: 'STANDBY', status: 'READY', progress },
      activate: { objective: 'SYNC RELAY TERMINALS', status: 'RELAYS OFFLINE', progress },
      blackout: { objective: 'HOLD THE LINE', status: 'BLACKOUT ACTIVE', progress },
      extract: { objective: 'REACH EXTRACTION', status: 'EXTRACTION LIVE', progress },
      complete: { objective: 'MISSION COMPLETE', status: 'SUCCESS', progress },
      failed: { objective: 'MISSION FAILED', status: 'FAILED', progress },
    };
    const remaining = this.state === 'blackout' ? Math.max(0, this.blackoutTimer) : 0;
    return {
      state: this.state,
      elapsed: this.elapsed,
      ...states[this.state],
      distance: this.getObjectiveDistance(),
      remaining,
    };
  }

  emitState() {
    this.callbacks.onState?.(this.getState());
  }
}
