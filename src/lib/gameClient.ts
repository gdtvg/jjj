type Listener = (data?: any) => void;

// HTTP transport with the same event interface used by the game UI.
export class GameClient {
  id = '';
  private listeners = new Map<string, Listener[]>();
  private roomId: string | null = null;
  private revision = -1;
  private timer?: ReturnType<typeof setInterval>;
  private stopped = false;
  private pollPending = false;
  private pollFailure = '';
  private queue: Promise<unknown> = Promise.resolve();
  private ready: Promise<void>;
  constructor() {
    this.ready = this.request('session', {}).then(res => {
      this.id = res.playerId;
      if (this.stopped) return;
      this.dispatch('connect');
      // An invite link (?room=CODE) takes priority over the last saved room.
      const url = new URL(window.location.href);
      const invited = url.searchParams.get('room')?.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      if (invited) { url.searchParams.delete('room'); history.replaceState(null, '', url.pathname + url.search + url.hash); }
      const saved = invited || localStorage.getItem('monopoly-room');
      if (saved) {
        if (invited && invited !== localStorage.getItem('monopoly-room')) this.revision = -1;
        this.emit('lobby:join', { roomId: saved, ...(invited ? this.inviteProfile() : {}) });
      }
      this.timer = setInterval(() => {
        if (this.roomId && !document.hidden && !this.pollPending) this.emit('room:poll', { roomId: this.roomId });
      }, 1500);
    }).catch(() => this.dispatch('error', 'Verbindung fehlgeschlagen. Bitte lade die Seite neu.'));
  }
  private inviteProfile() {
    try { return JSON.parse(localStorage.getItem('monopoly-profile') || '{}'); } catch { return {}; }
  }
  on(event: string, listener: Listener) {
    this.listeners.set(event, [...(this.listeners.get(event) || []), listener]);
  }
  private dispatch(event: string, data?: any) {
    if (!this.stopped) this.listeners.get(event)?.forEach(fn => fn(data));
  }
  private async request(event: string, data: unknown) {
    const response = await fetch('/.netlify/functions/game', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, data }), signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Request failed');
    return result;
  }
  emit(event: string, data: any, callback?: Listener) {
    if (event === 'room:poll') this.pollPending = true;
    this.queue = this.queue.then(async () => {
      await this.ready;
      if (this.stopped) return;
      try {
        const result = await this.request(event, data);
        if (event === 'room:poll') this.pollFailure = '';
        if (event === 'lobby:leave') {
          this.roomId = null; this.revision = -1; localStorage.removeItem('monopoly-room');
        } else {
          if (result.roomId !== this.roomId) this.revision = -1;
          this.roomId = result.roomId;
          localStorage.setItem('monopoly-room', result.roomId);
          if (event !== 'room:poll' || result.revision !== this.revision) {
            this.revision = result.revision;
            this.dispatch('lobby:update', result.lobby);
            if (result.gameState) {
              this.dispatch('game:started');
              this.dispatch('game:state', result.gameState);
            } else if (event === 'lobby:join') this.dispatch('lobby:joined');
          }
        }
        callback?.(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Connection failed';
        if (message === 'You are no longer in this room' || message === 'Room not found') {
          this.roomId = null; localStorage.removeItem('monopoly-room'); this.dispatch('lobby:kicked');
        }
        if (!callback && (event !== 'room:poll' || this.pollFailure !== message)) this.dispatch('error', message);
        if (event === 'room:poll') this.pollFailure = message;
        callback?.({ success: false, error: message });
      } finally {
        if (event === 'room:poll') this.pollPending = false;
      }
    });
  }
  disconnect() { this.stopped = true; clearInterval(this.timer); }
}
