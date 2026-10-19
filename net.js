/* OUROBOROS · red para partidas online
 *
 * No hay servidor propio: las salas usan un relé MQTT público por WebSocket seguro. Aquí hay dos capas, sin dependencias:
 *   Mqtt  cliente MQTT 3.1.1 mínimo (CONNECT, SUBSCRIBE, PUBLISH QoS 0, PING) con reconexión automática.
 *   Room  protocolo de sala. El anfitrión ordena las decisiones de todos en un registro numerado y lo reparte;
 *         cada jugador ejecuta la misma partida (misma semilla) aplicando ese registro en orden.
 * Como MQTT en QoS 0 puede perder mensajes, Room añade reintentos, detección de huecos (NACK), latidos y desconexión por inactividad.
 * Funciona en el navegador y en Node (para las pruebas). */
(function (root) {
'use strict';

const BROKERS = [
  { name: 'EMQX', url: 'wss://broker.emqx.io:8084/mqtt' },
  { name: 'HiveMQ', url: 'wss://broker.hivemq.com:8884/mqtt' },
  { name: 'Mosquitto', url: 'wss://test.mosquitto.org:8081' },
];
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';        // 32 símbolos sin I, O, 0 ni 1
const CODE_LEN = 6;
const PREFIX = 'ouro/v1/';

const enc = new TextEncoder(), dec = new TextDecoder();
const rnd = n => Math.floor(Math.random() * n);
const rid = n => Array.from({ length: n }, () => ALPHA[rnd(32)]).join('');

// ── códigos de sala: el primer símbolo elige el relé; el resto es aleatorio
function makeCode(brokerIdx, nB = BROKERS.length) {
  const firsts = [...ALPHA].filter((c, i) => i % nB === brokerIdx);
  return firsts[rnd(firsts.length)] + rid(CODE_LEN - 1);
}
function cleanCode(s) { return String(s || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, CODE_LEN); }
const validCode = c => c.length === CODE_LEN && [...c].every(ch => ALPHA.includes(ch));
const brokerOf = (code, nB = BROKERS.length) => ALPHA.indexOf(code[0]) % nB;
// el tema no contiene el código en claro, solo un resumen (así un curioso no lo ve en el relé)
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
const topicOf = code => PREFIX + cyrb53('ouroboros:' + code).toString(36);

/* ═════════════ cliente MQTT ═════════════ */
const utf = s => { const b = enc.encode(s); return [b.length >> 8, b.length & 255, ...b]; };
const remLen = n => { const o = []; do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; o.push(d); } while (n > 0); return o; };

class Mqtt {
  constructor(url, opt = {}) {
    this.url = url; this.clientId = opt.clientId || 'ouro_' + rid(12); this.onmessage = opt.onmessage || (() => {}); this.onstatus = opt.onstatus || (() => {});
    this.keepalive = opt.keepalive || 30; this.WS = opt.WebSocket || root.WebSocket;
    this.ws = null; this.state = 'idle'; this.subs = new Set(); this.closed = false; this.retry = 0; this.pid = 1; this.buf = new Uint8Array(0);
    this.lastIn = 0; this.lastOut = 0; this.timers = []; this.everUp = false; this._first = null;
  }
  setState(s) { if (this.state !== s) { this.state = s; try { this.onstatus(s); } catch (e) {} } }
  // abre la conexión; la promesa se cumple al primer CONNACK y falla si no se consigue a tiempo. Después reconecta sola.
  connect(timeout = 8000) {
    return new Promise((res, rej) => {
      let done = false;
      const t = setTimeout(() => { if (!done) { done = true; this.close(); rej(new Error('timeout')); } }, timeout);
      this._first = { ok: () => { if (!done) { done = true; clearTimeout(t); res(); } }, fail: e => { if (!done) { done = true; clearTimeout(t); this.close(); rej(e); } } };
      this._open();
    });
  }
  _open() {
    if (this.closed) return; this.setState(this.everUp ? 'reconnecting' : 'connecting'); this.buf = new Uint8Array(0);
    let ws; try { ws = new this.WS(this.url, 'mqtt'); } catch (e) { if (this._first && !this.everUp) this._first.fail(e); else this._again(); return; }
    ws.binaryType = 'arraybuffer'; this.ws = ws;
    ws.onopen = () => {
      const id = utf(this.clientId), vh = [...utf('MQTT'), 4, 0x02, this.keepalive >> 8, this.keepalive & 255];
      this._send([0x10, ...remLen(vh.length + id.length), ...vh, ...id]);
    };
    ws.onmessage = ev => { if (ws !== this.ws) return; this.lastIn = Date.now(); this._feed(new Uint8Array(ev.data)); };
    ws.onerror = () => {};
    ws.onclose = () => { if (ws !== this.ws) return; this._stopTimers(); this.ws = null; if (this.closed) return; if (this._first && !this.everUp) { this._first.fail(new Error('cerrado')); return; } this.setState('reconnecting'); this._again(); };
  }
  _again() { if (this.closed) return; const d = Math.min(8000, 400 * 2 ** this.retry++) + rnd(300); this.timers.push(setTimeout(() => this._open(), d)); }
  _stopTimers() { this.timers.forEach(clearTimeout); this.timers = []; if (this._ping) { clearInterval(this._ping); this._ping = null; } }
  _send(arr) { if (this.ws && this.ws.readyState === 1) { try { this.ws.send(Uint8Array.from(arr)); this.lastOut = Date.now(); return true; } catch (e) {} } return false; }
  _feed(chunk) {
    const b = new Uint8Array(this.buf.length + chunk.length); b.set(this.buf); b.set(chunk, this.buf.length); this.buf = b;
    for (;;) {
      const x = this.buf; if (x.length < 2) return;
      let len = 0, mul = 1, i = 1, ok = false;
      for (; i < Math.min(5, x.length); i++) { len += (x[i] & 127) * mul; mul *= 128; if (!(x[i] & 128)) { ok = true; i++; break; } }
      if (!ok || x.length < i + len) return;
      const head = x[0], p = x.subarray(i, i + len); this.buf = x.subarray(i + len);
      this._packet(head, p);
    }
  }
  _packet(head, p) {
    const type = head >> 4;
    if (type === 2) { // CONNACK
      if (p[1] !== 0) { const e = new Error('rechazado ' + p[1]); if (this._first && !this.everUp) this._first.fail(e); else this.close(); return; }
      this.everUp = true; this.retry = 0; this.setState('connected');
      if (this.subs.size) this._subscribe([...this.subs]);
      this._ping = setInterval(() => {
        const now = Date.now();
        if (now - this.lastIn > this.keepalive * 1500) { try { this.ws && this.ws.close(); } catch (e) {} return; }   // conexión muerta: forzar reconexión
        if (now - this.lastOut > this.keepalive * 500) this._send([0xC0, 0]);
      }, 4000);
      if (this._first) this._first.ok();
    } else if (type === 3) { // PUBLISH
      const qos = (head >> 1) & 3, tl = (p[0] << 8) | p[1], topic = dec.decode(p.subarray(2, 2 + tl)); let o = 2 + tl;
      if (qos > 0) { const id = (p[o] << 8) | p[o + 1]; o += 2; if (qos === 1) this._send([0x40, 2, id >> 8, id & 255]); }
      try { this.onmessage(topic, dec.decode(p.subarray(o))); } catch (e) { if (root.console) console.error('Mqtt.onmessage', e); }
    }
  }
  _subscribe(topics) {
    const id = this.pid++ & 0xffff || 1, body = [id >> 8, id & 255]; topics.forEach(t => body.push(...utf(t), 0));
    this._send([0x82, ...remLen(body.length), ...body]);
  }
  unsubscribe(topic) { this.subs.delete(topic); if (this.state === 'connected') { const id = this.pid++ & 0xffff || 1, body = [id >> 8, id & 255, ...utf(topic)]; this._send([0xA2, ...remLen(body.length), ...body]); } }
  subscribe(topic) { this.subs.add(topic); if (this.state === 'connected') this._subscribe([topic]); }
  publish(topic, text) { const body = [...utf(topic), ...enc.encode(text)]; return this._send([0x30, ...remLen(body.length), ...body]); }
  close() { this.closed = true; this._stopTimers(); const ws = this.ws; this.ws = null; if (ws) { try { ws.readyState === 1 && ws.send(Uint8Array.from([0xE0, 0])); ws.close(); } catch (e) {} } this.setState('closed'); }
}

/* ═════════════ sala ═════════════ */
const T = { HB: 2000, JOIN_RETRY: 1200, JOIN_GIVEUP: 12000, RETRY: 1500, NACK: 600, DROP: 25000, HOST_WARN: 6000, HOST_LOST: 18000, LOBBY_IDLE: 12000, START_RESEND: 1500, BATCH: 25 };
const MAX_PLAYERS = 4;

class Room {
  /* opt: { code, host:boolean, cid, name, skin, ver, brokerUrl, settings, WebSocket, timers (override T),
            onLobby(lobby), onStart(payload, slot, resync), onEntry(entry), onStatus(info), onClosed(reason, detail), onNotice(kind, data), onDesync(info) } */
  constructor(opt) {
    this.o = opt; this.T = { ...T, ...(opt.timers || {}) }; this.code = opt.code; this.isHost = !!opt.host; this.cid = opt.cid || 'c' + rid(10);
    this.name = opt.name || 'Jugador'; this.skin = opt.skin || null; this.ver = opt.ver || '0';
    this.topic = topicOf(this.code); this.up = this.topic + '/up'; this.dn = this.topic + '/dn';
    this.mq = null; this.timers = []; this.tset = new Set(); this.closed = false; this.all = []; this.status = 'idle';
    this.gameNo = 0; this.phase = 'lobby'; this.log = []; this.slot = this.isHost ? 0 : -1; this.settings = opt.settings || {};
    this.attached = false; this.buf = []; this.have = new Map(); this.next = 1; this.lastNack = 0;
    this.rtt = null; this.lastHost = Date.now(); this.joined = false; this.pend = new Map(); this.ridc = 0; this.inc = Date.now(); this.startPayload = null;
    this.players = []; this.chk = new Map();
    if (this.isHost) this.players.push({ cid: this.cid, name: this.name, skin: this.skin, slot: 0, host: true, lastSeen: Date.now() });
  }
  now() { return Date.now(); }
  every(ms, fn) { const id = setInterval(() => { if (!this.closed) fn(); }, ms); this.timers.push(id); return id; }
  after(ms, fn) { const id = setTimeout(() => { this.tset.delete(id); if (!this.closed) fn(); }, ms); this.tset.add(id); return id; }

  // ── conexión
  async open() {
    const url = this.o.brokerUrl || BROKERS[brokerOf(this.code)].url;
    this.mq = new Mqtt(url, { WebSocket: this.o.WebSocket, onmessage: (t, s) => this._msg(t, s), onstatus: s => this._mqStatus(s) });
    await this.mq.connect(this.o.connectTimeout || 8000);
    this.mq.subscribe(this.isHost ? this.up : this.dn);
    if (this.isHost) {
      // ¿ya hay otra sala con este código? (solo escuchamos un momento)
      this.mq.subscribe(this.dn);
      this._probe = true; await new Promise(r => this.after(this.o.probeMs != null ? this.o.probeMs : 1300, r)); this._probe = false;
      if (this._taken) { this.close(); throw Object.assign(new Error('code-taken'), { taken: true }); }
      this.mq.unsubscribe(this.dn);
      this._startHost();
    } else this._startGuest();
    return this;
  }
  _mqStatus(s) { this._setStatus(s === 'connected' ? 'ok' : s === 'closed' ? 'closed' : s === 'connecting' ? 'connecting' : 'reconnecting'); }
  _setStatus(s) { if (this.status !== s) { this.status = s; this._emitStatus(); } }
  _emitStatus() { try { this.o.onStatus && this.o.onStatus({ status: this.status, rtt: this.rtt, hostLate: this.hostLate || false, broker: this.mq && this.mq.url }); } catch (e) {} }
  _pub(topic, obj) { return this.mq && this.mq.publish(topic, JSON.stringify({ m: 1, ...obj })); }
  _msg(topic, text) {
    let d; try { d = JSON.parse(text); } catch (e) { return; } if (!d || d.m !== 1) return;
    if (this._probe && topic === this.dn) { this._taken = true; return; }
    if (this.isHost && topic === this.up) this._hostRecv(d);
    else if (!this.isHost && topic === this.dn) this._guestRecv(d);
  }

  /* ───────── anfitrión ───────── */
  _startHost() {
    this.every(this.T.HB, () => this._hostTick());
    this._hostTick();
  }
  lobbyMsg(to) {
    return { t: 'lobby', g: this.gameNo, phase: this.phase, host: this.cid, settings: this.settings, to,
      players: this.players.map(p => ({ cid: p.cid, name: p.name, skin: p.skin, slot: p.slot, host: !!p.host, dropped: !!p.dropped, late: !!p.late })) };
  }
  _bcastLobby() { this._pub(this.dn, this.lobbyMsg()); try { this.o.onLobby && this.o.onLobby(this.lobbyMsg()); } catch (e) {} }
  _hostTick() {
    const now = this.now(); let changed = false;
    for (const p of [...this.players]) {
      if (p.host) continue; const idle = now - p.lastSeen;
      const late = idle > this.T.HOST_WARN; if (late !== !!p.late) { p.late = late; changed = true; }
      if (this.phase === 'playing') {
        if (idle > this.T.DROP && !p.dropped) { p.dropped = true; changed = true; this.append({ p: p.slot, k: 'drop', why: 'timeout' }); this._notice('drop', { slot: p.slot, name: p.name, why: 'timeout' }); }
      } else if (idle > this.T.LOBBY_IDLE) { this._removePlayer(p, 'timeout'); changed = true; }
    }
    if (this.phase === 'playing' && this.startPayload) for (const p of this.players) if (!p.host && !p.dropped && !p.ack && now - (this.startAt || 0) > this.T.START_RESEND) { this._pub(this.dn, this.startMsg()); break; }
    this._pub(this.dn, { t: 'hb', g: this.gameNo, n: this.log.length, phase: this.phase });
    if (changed || this.phase !== 'playing' || (this._lt = (this._lt || 0) + 1) % 3 === 0) this._bcastLobby();
  }
  startMsg() { return { t: 'start', g: this.gameNo, payload: this.startPayload }; }
  _hostRecv(d) {
    const now = this.now(), p = this.players.find(x => x.cid === d.cid); if (p) { p.lastSeen = now; if (p.late) { p.late = false; } }
    switch (d.t) {
      case 'hb': if (p && d.ts) this._pub(this.dn, { t: 'pong', to: d.cid, ts: d.ts }); return;
      case 'join': return this._onJoin(d, p);
      case 'req': return this._onReq(d, p);
      case 'nack': return p && this._resend(d.from, d.cid);
      case 'ready': if (p) { p.ack = d.g === this.gameNo; } return;
      case 'chk': return p && this._onChk(d, p);
      case 'leave': return p && this._onLeave(p);
    }
  }
  _onJoin(d, known) {
    const reply = why => this._pub(this.dn, { t: 'nok', cid: d.cid, why });
    if (d.ver !== this.ver) return reply('ver');
    if (known) {
      if (known.dropped) return reply('dropped');
      known.name = d.name || known.name; known.skin = d.skin || known.skin; known.lastSeen = this.now(); known.ack = false;
      this._pub(this.dn, this.lobbyMsg(d.cid)); if (this.phase === 'playing') this._pub(this.dn, this.startMsg()); return;
    }
    if (this.phase === 'playing') return reply('started');
    if (this.phase === 'over') this.phase = 'lobby';
    const max = this.settings.max || MAX_PLAYERS; if (this.players.length >= max) return reply('full');
    const used = new Set(this.players.map(x => x.slot)); let slot = 0; while (used.has(slot)) slot++;
    let name = String(d.name || 'Jugador').trim().slice(0, 12) || 'Jugador';
    for (let k = 2; this.players.some(x => x.name === name); k++) name = name.slice(0, 10) + ' ' + k;      // nombres únicos en la sala
    this.players.push({ cid: d.cid, name, skin: d.skin || null, slot, lastSeen: this.now() }); this.players.sort((a, b) => a.slot - b.slot);
    this._notice('join', { slot, name }); this._bcastLobby();
  }
  _removePlayer(p, why) {
    this.players = this.players.filter(x => x !== p); this.players.forEach((x, i) => { x.slot = i; });      // en la sala los puestos se compactan
    this._notice('leave', { slot: p.slot, name: p.name, why }); this._bcastLobby();
  }
  _onLeave(p) {
    if (this.phase === 'playing') { if (!p.dropped) { p.dropped = true; this.append({ p: p.slot, k: 'drop', why: 'leave' }); this._notice('drop', { slot: p.slot, name: p.name, why: 'leave' }); this._bcastLobby(); } }
    else this._removePlayer(p, 'leave');
  }
  kick(slot) {
    const p = this.players.find(x => x.slot === slot && !x.host); if (!p) return;
    this._pub(this.dn, { t: 'kick', cid: p.cid });
    if (this.phase === 'playing') { if (!p.dropped) { p.dropped = true; this.append({ p: p.slot, k: 'drop', why: 'kick' }); this._notice('drop', { slot: p.slot, name: p.name, why: 'kick' }); this._bcastLobby(); } }
    else this._removePlayer(p, 'kick');
  }
  setSettings(s) { this.settings = { ...this.settings, ...s }; this._bcastLobby(); }
  // reparte la partida: `payload` lo arma la aplicación (semilla, configuración…); aquí se le añade quién ocupa cada puesto
  purgeDropped() { if (this.players.some(p => p.dropped)) { this.players = this.players.filter(p => !p.dropped); this.players.forEach((x, i) => { x.slot = i; }); } }
  startGame(payload) {
    this.purgeDropped(); this.gameNo++; this.all = []; this.attached = false; this.phase = 'playing'; this.log = []; this.chk.clear(); this.have.clear(); this.next = 1; this.buf = [];
    this.players.forEach(p => { p.ack = !!p.host; p.dropped = false; p.inc = 0; p.expect = 1; p.hold = new Map(); p.late = false; p.lastSeen = this.now(); });
    this.startPayload = { ...payload, slots: this.players.map(p => ({ cid: p.cid, slot: p.slot, name: p.name, skin: p.skin })) }; this.startAt = this.now();
    this._pub(this.dn, this.startMsg()); this._bcastLobby();
    try { this.o.onStart && this.o.onStart(this.startPayload, 0, false); } catch (e) { if (root.console) console.error(e); }
    return this.startPayload;
  }
  gameOver() { this.phase = 'over'; this._bcastLobby(); }
  backToLobby() { this.purgeDropped(); this.phase = 'lobby'; this.startPayload = null; this._bcastLobby(); }
  // las peticiones de cada jugador se registran en orden estricto y sin repetirse, aunque lleguen perdidas, duplicadas o desordenadas.
  // «inc» identifica a cada ejecución del cliente (si recarga la página, su numeración empieza de nuevo).
  _onReq(d, p) {
    if (!p || this.phase !== 'playing' || d.g !== this.gameNo || p.dropped) return;
    if (!(d.rid >= 1)) return; const inc = +d.inc || 0;
    if (inc < (p.inc || 0)) return;
    if (inc > (p.inc || 0)) { p.inc = inc; p.expect = 1; p.hold = new Map(); }
    if (d.rid < p.expect) return;                      // repetición de algo ya registrado
    p.hold.set(d.rid, d.e); if (p.hold.size > 64) p.hold.clear();
    while (p.hold.has(p.expect)) {
      const e = p.hold.get(p.expect) || {}; p.hold.delete(p.expect); const r = p.expect++;
      if (['r', 'd', 'res', 'gold', 'ans'].includes(e.k)) this.append({ p: p.slot, k: e.k, d: e.d, v: e.v, i: e.i, t: e.t, cid: p.cid, rid: r });
    }
  }
  // registra una entrada en el registro de la partida y la reparte (también a la propia aplicación del anfitrión)
  append(e) {
    if (this.phase !== 'playing') return null;
    e.n = this.log.length + 1; e.g = this.gameNo; this.log.push(e);
    (this.outq = this.outq || []).push(e);                      // las entradas muy seguidas viajan juntas en un solo mensaje
    if (!this.outT) this.outT = setTimeout(() => { this.outT = null; this._flushOut(); }, this.T.BATCH);
    this._ingest(e); return e;
  }
  _flushOut() { const l = this.outq; this.outq = []; if (l && l.length && !this.closed) this._pub(this.dn, { t: 'ev', g: this.gameNo, list: l }); }
  _resend(from, cid) {
    from = Math.max(1, from | 0); if (from > this.log.length) return;
    for (let i = from - 1; i < this.log.length; i += 40) this._pub(this.dn, { t: 'ev', g: this.gameNo, list: this.log.slice(i, i + 40), to: cid });
  }
  _onChk(d, p) {
    if (d.g !== this.gameNo) return; const k = d.key, prev = this.chk.get(k);
    if (!prev) { this.chk.set(k, { h: d.h, slot: p.slot }); if (this.chk.size > 400) this.chk.delete(this.chk.keys().next().value); return; }
    if (prev.h !== d.h) { const info = { key: k, a: prev.slot, b: p.slot }; this._pub(this.dn, { t: 'desync', ...info }); try { this.o.onDesync && this.o.onDesync(info); } catch (e) {} }
  }
  _notice(kind, data) { try { this.o.onNotice && this.o.onNotice(kind, data); } catch (e) {} }

  /* ───────── jugador ───────── */
  _startGuest() {
    this._joinT0 = this.now();
    const tryJoin = () => {
      if (this.joined) return;
      if (this.now() - this._joinT0 > this.T.JOIN_GIVEUP) { this._fail('not-found'); return; }
      this._pub(this.up, { t: 'join', cid: this.cid, name: this.name, skin: this.skin, ver: this.ver }); this.after(this.T.JOIN_RETRY, tryJoin);
    };
    tryJoin();
    this.every(this.T.HB, () => this._guestTick());
  }
  _fail(reason, detail) { if (this.closed) return; try { this.o.onClosed && this.o.onClosed(reason, detail); } finally { this.close(true); } }
  _guestTick() {
    if (!this.joined) return;
    const now = this.now(), silent = now - this.lastHost;
    const late = silent > this.T.HOST_WARN; if (late !== !!this.hostLate) { this.hostLate = late; this._emitStatus(); }
    if (silent > this.T.HOST_LOST) { this._fail('host-lost'); return; }
    this._pub(this.up, { t: 'hb', cid: this.cid, g: this.gameNo, n: this.next - 1, ts: now });
    for (const [r, x] of this.pend) if (now - x.t > this.T.RETRY) { x.t = now; x.tries++; this._pub(this.up, { t: 'req', cid: this.cid, g: this.gameNo, inc: this.inc, rid: r, e: x.e }); }
  }
  _guestRecv(d) {
    this.lastHost = this.now(); if (this.hostLate) { this.hostLate = false; this._emitStatus(); }
    if (d.to && d.to !== this.cid) return;
    switch (d.t) {
      case 'nok': if (d.cid === this.cid) this._fail(d.why); return;
      case 'kick': if (d.cid === this.cid) this._fail('kicked'); return;
      case 'bye': this._fail('closed'); return;
      case 'lobby': return this._onLobby(d);
      case 'start': return this._onStart(d);
      case 'ev': if (d.g === this.gameNo) (d.list || []).forEach(e => this._ingest(e)); return;
      case 'hb': return this._onHb(d);
      case 'pong': { const r = this.now() - d.ts; if (r >= 0 && r < 60000) { this.rtt = this.rtt == null ? r : Math.round(this.rtt * .6 + r * .4); this._emitStatus(); } return; }
      case 'desync': try { this.o.onDesync && this.o.onDesync(d); } catch (e) {} return;
    }
  }
  _onLobby(d) {
    const me = (d.players || []).find(p => p.cid === this.cid);
    if (!me) { if (this.joined && d.phase !== 'playing') this._pub(this.up, { t: 'join', cid: this.cid, name: this.name, skin: this.skin, ver: this.ver }); return; }
    if (me.dropped && d.phase === 'playing') { this._fail('dropped'); return; }
    this.slot = me.slot; this.phase = d.phase; this.settings = d.settings || {}; this.players = d.players;
    if (!this.joined) { this.joined = true; this.lastHost = this.now(); this._emitStatus(); }
    try { this.o.onLobby && this.o.onLobby(d); } catch (e) {}
  }
  _onStart(d) {
    if (!this.joined) return;
    if (d.g > this.gameNo || (d.g === this.gameNo && !this.startPayload)) {
      const resync = d.g === this.gameNo; this.gameNo = d.g; this.startPayload = d.payload; this.phase = 'playing'; this.have.clear(); this.next = 1; this.buf = []; this.all = []; this.pend.clear(); this.ridc = 0;
      const me = (d.payload.slots || []).find(s => s.cid === this.cid); this.slot = me ? me.slot : this.slot; this.attached = false;
      try { this.o.onStart && this.o.onStart(d.payload, this.slot, resync); } catch (e) { if (root.console) console.error(e); }
    }
    this._pub(this.up, { t: 'ready', cid: this.cid, g: d.g });
  }
  _onHb(d) {
    this.phase = d.phase;
    if (d.phase === 'playing' && (!this.startPayload || d.g > this.gameNo) && this.joined) this._pub(this.up, { t: 'join', cid: this.cid, name: this.name, skin: this.skin, ver: this.ver });
    else if (d.g === this.gameNo && d.n >= this.next && this.startPayload) this._nack();
  }
  // pide lo que falta; si no llega, espera cada vez más (por si el relé nos está limitando) y vuelve a empezar al avanzar
  _nack() {
    const now = this.now(); if (this.nackFrom !== this.next) { this.nackFrom = this.next; this.nackTries = 0; }
    const wait = Math.min(4000, this.T.NACK * 2 ** Math.min(this.nackTries, 6)); if (now - this.lastNack < wait) return;
    this.lastNack = now; this.nackTries++; this._pub(this.up, { t: 'nack', cid: this.cid, from: this.next });
  }
  // petición de un jugador (tirar, elegir dado…): se reintenta hasta verla registrada
  request(e) {
    if (this.isHost) { const p = this.players[0]; return this.append({ p: p.slot, k: e.k, d: e.d, v: e.v, i: e.i, t: e.t, cid: this.cid, rid: ++this.ridc }); }
    const r = ++this.ridc; this.pend.set(r, { e, t: this.now(), tries: 0 }); this._pub(this.up, { t: 'req', cid: this.cid, g: this.gameNo, inc: this.inc, rid: r, e }); return r;
  }
  check(key, h) {
    if (this.isHost) { const prev = this.chk.get(key); if (!prev) this.chk.set(key, { h, slot: 0 }); else if (prev.h !== h) { const info = { key, a: prev.slot, b: 0 }; this._pub(this.dn, { t: 'desync', ...info }); try { this.o.onDesync && this.o.onDesync(info); } catch (e) {} } return; }
    this._pub(this.up, { t: 'chk', cid: this.cid, g: this.gameNo, key, h });
  }

  /* ───────── entradas ordenadas (anfitrión y jugadores) ───────── */
  _ingest(e) {
    if (!e || e.g !== this.gameNo || e.n < this.next) return;
    if (e.rid && e.cid === this.cid) this.pend.delete(e.rid);
    this.have.set(e.n, e);
    while (this.have.has(this.next)) { const x = this.have.get(this.next); this.have.delete(this.next); this.next++; this._deliver(x); }
    if (this.have.size && !this.isHost && !this.nackT) this.nackT = this.after(this.T.NACK, () => { this.nackT = null; if (this.have.size) this._nack(); });
  }
  _deliver(e) { this.all.push(e); if (this.attached) { try { this.o.onEntry && this.o.onEntry(e); } catch (x) { if (root.console) console.error(x); } } else this.buf.push(e); }
  // la aplicación llama a attach() cuando su partida ya está creada: recibe lo acumulado y, desde entonces, lo nuevo
  attach() { this.attached = true; const b = this.buf; this.buf = []; b.forEach(e => this._deliver(e)); }
  // todo lo registrado hasta ahora (para reiniciar la partida local sin red)
  entries() { return this.all.slice(); }
  // para reiniciar la partida local (resincronizar): se vuelve a entregar todo desde el principio
  rewind() { this.attached = false; this.buf = this.all.slice(); this.all = []; }

  close(silent) {
    if (this.closed) return;
    if (!silent && this.mq) { if (this.isHost) this._pub(this.dn, { t: 'bye' }); else if (this.joined) this._pub(this.up, { t: 'leave', cid: this.cid }); }
    if (this.outT) { clearTimeout(this.outT); this.outT = null; if (!silent) this._flushOut(); }
    this.closed = true; this.timers.forEach(t => clearInterval(t)); this.tset.forEach(t => clearTimeout(t)); this.timers = []; this.tset.clear();
    const mq = this.mq; if (mq) setTimeout(() => mq.close(), silent ? 0 : 150);
    this._setStatus('closed');
  }
}

root.OuroNet = { Mqtt, Room, BROKERS, ALPHA, CODE_LEN, makeCode, cleanCode, validCode, brokerOf, topicOf, MAX_PLAYERS, T };
if (typeof module !== 'undefined' && module.exports) module.exports = root.OuroNet;
})(typeof window !== 'undefined' ? window : globalThis);
