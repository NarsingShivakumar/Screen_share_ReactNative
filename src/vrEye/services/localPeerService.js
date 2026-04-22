/**
 * localPeerService.js  v1.0
 *
 * Manages a direct LOCAL Wi-Fi peer connection between:
 *   - VR Host device  (runs in VR cardboard, acts as "server")
 *   - Controller device (runs outside headset, acts as "client")
 *
 * Transport: react-native-tcp-socket  (pure TCP over LAN, no internet needed)
 *
 * Protocol (newline-delimited JSON):
 *   → All messages: { type: string, payload?: any, ts: number }
 *
 * Connection flow:
 *   HOST:        localPeerService.startServer(port)
 *   CONTROLLER:  localPeerService.connectToHost(ip, port)
 *
 * Ping-pong (keep-alive + latency):
 *   HOST sends { type:'ping', ts } every PING_INTERVAL ms
 *   CONTROLLER replies { type:'pong', ts }  (echoes same ts)
 *   HOST measures RTT; if no pong within PONG_TIMEOUT → reconnect attempt
 *
 * Reconnection:
 *   CONTROLLER auto-reconnects with exponential back-off on disconnect.
 *   HOST marks controller as disconnected and updates listeners.
 *
 * Install:
 *   npm install react-native-tcp-socket
 *   iOS:  cd ios && pod install
 *   Android: auto-linked
 */

import { Platform } from 'react-native';
import TcpSocket from 'react-native-tcp-socket';

// ── Constants ─────────────────────────────────────────────────────────────────
const PING_INTERVAL   = 3000;   // ms between host pings
const PONG_TIMEOUT    = 8000;   // ms before host marks peer dead
const RECONNECT_BASE  = 1500;   // ms base reconnect delay (controller)
const RECONNECT_MAX   = 16000;  // ms max reconnect delay
const MAX_RECONNECT   = 20;     // give up after N attempts (0 = infinite)
const TCP_PORT        = 54321;  // default port (must be open on host device)

// ── Roles ─────────────────────────────────────────────────────────────────────
export const PEER_ROLE = { HOST: 'host', CONTROLLER: 'controller' };

// ── LocalPeerService ──────────────────────────────────────────────────────────

class LocalPeerService {
  constructor() {
    this._role          = null;
    this._server        = null;   // TcpSocket.Server (host only)
    this._socket        = null;   // active connection socket
    this._hostIp        = null;
    this._port          = TCP_PORT;
    this._listeners     = {};     // event → Set<fn>
    this._pingTimer     = null;
    this._pongTimer     = null;
    this._reconnectTimer= null;
    this._reconnectCount= 0;
    this._reconnectDelay= RECONNECT_BASE;
    this._connected     = false;
    this._destroyed     = false;
    this._rtt           = null;   // last measured round-trip ms
    this._readBuffer    = '';     // partial message buffer
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────

  /** Start as HOST: opens a TCP server on given port */
  startServer(port = TCP_PORT) {
    if (this._server) return;
    this._role    = PEER_ROLE.HOST;
    this._port    = port;
    this._destroyed = false;

    this._server  = TcpSocket.createServer((socket) => {
      console.log('[LocalPeer] Controller connected from', socket.remoteAddress);
      this._attachSocket(socket);
      this._connected = true;
      this._startPingLoop();
      this._emit('connected', { role: PEER_ROLE.CONTROLLER, address: socket.remoteAddress });
    });

    this._server.listen({ port, host: '0.0.0.0' });

    this._server.on('error', (err) => {
      console.error('[LocalPeer] Server error:', err.message);
      this._emit('error', { message: err.message });
    });

    console.log(`[LocalPeer] Server listening on port ${port}`);
    this._emit('server_ready', { port });
  }

  /** Connect as CONTROLLER to host IP:port */
  connectToHost(ip, port = TCP_PORT) {
    this._role      = PEER_ROLE.CONTROLLER;
    this._hostIp    = ip;
    this._port      = port;
    this._destroyed = false;
    this._doConnect();
  }

  /** Send an event to the peer */
  send(type, payload = {}) {
    if (!this._socket || !this._connected) {
      console.warn('[LocalPeer] Cannot send — not connected:', type);
      return false;
    }
    const msg = JSON.stringify({ type, payload, ts: Date.now() }) + '\n';
    try {
      this._socket.write(msg);
      return true;
    } catch (e) {
      console.warn('[LocalPeer] Send error:', e.message);
      return false;
    }
  }

  /** Subscribe to an event. Returns unsubscribe fn. */
  on(event, handler) {
    if (!this._listeners[event]) this._listeners[event] = new Set();
    this._listeners[event].add(handler);
    return () => this._listeners[event]?.delete(handler);
  }

  /** Whether a peer is currently connected */
  isConnected() { return this._connected; }

  /** Last measured ping RTT in ms (null if unknown) */
  getRTT() { return this._rtt; }

  /** Current role */
  getRole() { return this._role; }

  /** Full teardown */
  destroy() {
    this._destroyed = true;
    this._clearTimers();
    this._socket?.destroy();
    this._server?.close();
    this._socket = null;
    this._server = null;
    this._connected = false;
    this._listeners = {};
    console.log('[LocalPeer] Destroyed');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Internal
  // ──────────────────────────────────────────────────────────────────────────

  _doConnect() {
    if (this._destroyed) return;
    const opts = {
      port: this._port,
      host: this._hostIp,
      tls: false,
    };

    const socket = TcpSocket.createConnection(opts, () => {
      console.log('[LocalPeer] Connected to host', this._hostIp);
      this._reconnectCount = 0;
      this._reconnectDelay = RECONNECT_BASE;
      this._connected = true;
      this._emit('connected', { role: PEER_ROLE.HOST, address: this._hostIp });
    });

    this._attachSocket(socket);
  }

  _attachSocket(socket) {
    // Destroy previous socket cleanly
    if (this._socket && this._socket !== socket) {
      this._socket.removeAllListeners();
      this._socket.destroy();
    }
    this._socket    = socket;
    this._readBuffer = '';

    socket.setEncoding('utf8');
    socket.setNoDelay(true);

    socket.on('data', (data) => this._onData(data));

    socket.on('error', (err) => {
      console.warn('[LocalPeer] Socket error:', err.message);
      this._emit('error', { message: err.message });
    });

    socket.on('close', () => {
      console.log('[LocalPeer] Socket closed');
      this._connected = false;
      this._clearPingLoop();
      this._emit('disconnected', {});

      if (this._role === PEER_ROLE.CONTROLLER && !this._destroyed) {
        this._scheduleReconnect();
      }
    });
  }

  _onData(chunk) {
    this._readBuffer += chunk;
    // Messages are newline-delimited
    const lines = this._readBuffer.split('\n');
    this._readBuffer = lines.pop(); // last may be partial
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        this._handleMessage(msg);
      } catch (e) {
        console.warn('[LocalPeer] Parse error:', e.message, '| raw:', line.slice(0, 80));
      }
    }
  }

  _handleMessage(msg) {
    const { type, payload, ts } = msg;

    if (type === 'ping') {
      // Controller replies with pong immediately
      this.send('pong', { ts });
      return;
    }

    if (type === 'pong') {
      // Host receives pong — measure RTT and reset watchdog
      this._rtt = Date.now() - ts;
      this._resetPongWatchdog();
      this._emit('ping_rtt', { rtt: this._rtt });
      return;
    }

    // All other messages forwarded to app listeners
    this._emit(type, payload ?? {});
    // Also emit generic 'message' event
    this._emit('message', { type, payload, ts });
  }

  // ── Ping loop (host only) ──────────────────────────────────────────────────

  _startPingLoop() {
    this._clearPingLoop();
    this._pingTimer = setInterval(() => {
      if (!this._connected) return;
      this.send('ping', { ts: Date.now() });
      // Arm pong watchdog
      this._armPongWatchdog();
    }, PING_INTERVAL);
  }

  _armPongWatchdog() {
    if (this._pongTimer) return; // already armed
    this._pongTimer = setTimeout(() => {
      console.warn('[LocalPeer] Pong timeout — peer unresponsive');
      this._pongTimer = null;
      this._emit('peer_timeout', {});
      // Host tries to accept a fresh connection; close stale socket
      this._socket?.destroy();
      this._connected = false;
    }, PONG_TIMEOUT);
  }

  _resetPongWatchdog() {
    if (this._pongTimer) {
      clearTimeout(this._pongTimer);
      this._pongTimer = null;
    }
  }

  _clearPingLoop() {
    if (this._pingTimer) { clearInterval(this._pingTimer); this._pingTimer = null; }
    this._resetPongWatchdog();
  }

  // ── Reconnection (controller only) ────────────────────────────────────────

  _scheduleReconnect() {
    if (this._reconnectTimer) return;
    if (MAX_RECONNECT > 0 && this._reconnectCount >= MAX_RECONNECT) {
      console.warn('[LocalPeer] Max reconnect attempts reached');
      this._emit('reconnect_failed', { attempts: this._reconnectCount });
      return;
    }

    this._reconnectCount++;
    const delay = Math.min(this._reconnectDelay, RECONNECT_MAX);
    this._reconnectDelay = Math.min(delay * 1.5, RECONNECT_MAX);

    console.log(`[LocalPeer] Reconnect attempt ${this._reconnectCount} in ${delay}ms`);
    this._emit('reconnecting', { attempt: this._reconnectCount, delay });

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      if (!this._destroyed) this._doConnect();
    }, delay);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _clearTimers() {
    this._clearPingLoop();
    if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
  }

  _emit(event, data) {
    (this._listeners[event] || new Set()).forEach(fn => {
      try { fn(data); } catch (e) { console.warn('[LocalPeer] listener error', event, e); }
    });
  }
}

export default new LocalPeerService();
