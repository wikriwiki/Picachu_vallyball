// WebSocket 연결 (자동 재연결 + 세션 토큰으로 재입장)
const KEY = 'life.session';

export class Net {
  constructor({ onMessage, onStatus }) {
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.ws = null;
    this.outbox = [];
    this.retry = 0;
    setInterval(() => this.send({ type: 'ping', t: Date.now() }), 25000);
  }

  url() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/ws`;
  }

  connect() {
    this.onStatus('connecting');
    const ws = new WebSocket(this.url());
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.onStatus('open');
      const sess = this.session();
      const urlRoom = new URLSearchParams(location.search).get('room');
      if (sess && (!urlRoom || urlRoom.toUpperCase() === sess.code)) {
        ws.send(JSON.stringify({ type: 'join', code: sess.code, token: sess.token }));
      }
      for (const m of this.outbox.splice(0)) ws.send(m);
    };
    ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      this.onMessage(m);
    };
    ws.onclose = () => {
      this.onStatus('closed');
      const delay = Math.min(8000, 800 * 2 ** this.retry++);
      setTimeout(() => this.connect(), delay);
    };
  }

  send(obj) {
    const s = JSON.stringify(obj);
    if (this.ws && this.ws.readyState === 1) this.ws.send(s);
    else if (obj.type !== 'ping') this.outbox.push(s);
  }

  session() {
    try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; }
  }
  saveSession(code, token) {
    try { sessionStorage.setItem(KEY, JSON.stringify({ code, token })); } catch { /* ignore */ }
  }
  clearSession() {
    try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  }
}
