import { useRef, useCallback, useEffect } from 'react';
import { io } from 'socket.io-client';

const VR_EVENTS = [
  'session_created','session_joined','session_error',
  'patient_ready','patient_disconnected','patient_status_update',
  'show_optotype','show_instruction','show_color_plate','show_color_eye','show_near_eye',
  'response_recorded','phase_changed','test_complete','peer_disconnected',
  'vr_offer','vr_answer','vr_candidate','webrtc_patient_ready','webrtc_ping','mute_patient',
];

export function useSocket() {
  const socketRef = useRef(null);
  const listenersRef = useRef(new Map());

  const connect = useCallback((role, endpoint) => {
    if (socketRef.current?.connected) return;
    const socket = io(endpoint, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => {
      console.log('[Socket] Connected as', role);
      socket.emit('register_role', { role });
    });
    socket.on('disconnect', () => console.log('[Socket] Disconnected'));
    VR_EVENTS.forEach(event => {
      socket.on(event, data => listenersRef.current.get(event)?.forEach(h => h(data)));
    });
  }, []);

  const emit = useCallback((event, data) => {
    if (socketRef.current?.connected) socketRef.current.emit(event, data);
    else console.warn('[Socket] Not connected — cannot emit', event);
  }, []);

  const on = useCallback((event, handler) => {
    if (!listenersRef.current.has(event)) listenersRef.current.set(event, new Set());
    listenersRef.current.get(event).add(handler);
    return () => listenersRef.current.get(event)?.delete(handler);
  }, []);

  const onConnected = useCallback(cb => {
    if (socketRef.current?.connected) cb();
    else socketRef.current?.once('connect', cb);
  }, []);

  const isConnected = useCallback(() => socketRef.current?.connected ?? false, []);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    listenersRef.current.clear();
  }, []);

  useEffect(() => () => disconnect(), [disconnect]);

  return { connect, emit, on, onConnected, isConnected, disconnect };
}