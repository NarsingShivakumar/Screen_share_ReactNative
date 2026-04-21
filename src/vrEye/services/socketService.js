/**
 * socketService.js
 * Converted from Angular SocketService (socket.service.ts)
 * Uses socket.io-client — install: npm install socket.io-client
 */
import { io } from 'socket.io-client';
import { SOCKET_ENDPOINT } from '../config';
import { socketURI } from '../../assets/constants';

const VR_EVENTS = [
  'session_created', 'session_joined', 'session_error', 'session_closed', 'session_ended',
  'patient_ready', 'patient_disconnected', 'patient_status_update',
  'show_optotype', 'show_instruction',
  'show_color_plate', 'show_color_eye', 'show_near_eye',
  'response_recorded', 'phase_changed', 'test_complete',
  'peer_disconnected', 'lens_check',
  'vr_offer', 'vr_answer', 'vr_candidate',
  'webrtc_patient_ready', 'webrtc_ping', 'mute_patient',
];

class SocketService {
  constructor() {
    this.socket = null;
    this._listeners = {}; // { eventName: [callbacks] }
  }

  /**
   * Connect to socket server and register role.
   * @param {'assistant' | 'patient'} role
   */
  connect(role) {
    this.socket = io(socketURI, {
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log(`[Socket] Connected as ${role} | id=${this.socket.id}`);
      this.socket.emit('register_role', { role });
      this._dispatch('_connected', null);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected =>', reason);
    });

    // PRINT ALL SERVER EVENTS + DATA
    this.socket.onAny((eventName, ...args) => {
      console.log(`[Socket][onAny] Event => ${eventName}`);
      console.log('[Socket][onAny] Data =>', args);
    });

    VR_EVENTS.forEach(event => {
      this.socket.on(event, (data) => {
        console.log(`[Socket] Received event => ${event}`);
        console.log('[Socket] Received data =>', data);
        this._dispatch(event, data);
      });
    });
  }

  /** Emit an event to the server */
  emit(event, data) {
    if (this.socket?.connected) {
      console.log(`[Socket] Emitting event => ${event}`);
      console.log('[Socket] Emitting data =>', data);
      this.socket.emit(event, data);
    } else {
      console.warn('[Socket] Not connected — cannot emit', event);
    }
  }

  /**
   * Subscribe to a socket event. Returns an unsubscribe function.
   * @param {string} eventName
   * @param {Function} callback
   * @returns {Function} unsubscribe
   */
  on(eventName, callback) {
    if (!this._listeners[eventName]) this._listeners[eventName] = [];
    this._listeners[eventName].push(callback);
    return () => this.off(eventName, callback);
  }

  /** Unsubscribe a specific callback from an event */
  off(eventName, callback) {
    if (this._listeners[eventName]) {
      this._listeners[eventName] = this._listeners[eventName].filter(l => l !== callback);
    }
  }

  _dispatch(eventName, data) {
    (this._listeners[eventName] || []).forEach(cb => cb(data));
  }

  isConnected() {
    return this.socket?.connected ?? false;
  }

  /**
   * Calls callback once the socket is connected (or immediately if already connected).
   * @param {Function} callback
   */
  onConnected(callback) {
    if (this.isConnected()) {
      callback();
    } else {
      const unsub = this.on('_connected', () => {
        callback();
        unsub();
      });
    }
  }

  disconnect() {
    this.socket?.disconnect();
    this._listeners = {};
  }
}

export default new SocketService();
