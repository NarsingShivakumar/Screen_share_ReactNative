/**
 * useLocalPeer.js  v1.0
 *
 * React hook wrapping localPeerService.
 *
 * HOST device (VR in headset):
 *   const peer = useLocalPeer();
 *   peer.startServer();                 // call once on mount
 *   peer.send('vr_state_update', data); // broadcast state to controller
 *
 * CONTROLLER device:
 *   const peer = useLocalPeer();
 *   peer.connect(hostIp);               // connect to host
 *   peer.send('controller_event', data);
 *   peer.on('vr_state_update', handler);
 *
 * Status object returned:
 *   {
 *     connected: bool,
 *     connecting: bool,
 *     reconnecting: bool,
 *     reconnectAttempt: number,
 *     rtt: number|null,
 *     error: string|null,
 *   }
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import localPeerService, { PEER_ROLE } from './localPeerService';

export function useLocalPeer() {
  const [status, setStatus] = useState({
    connected:        false,
    connecting:       false,
    reconnecting:     false,
    reconnectAttempt: 0,
    rtt:              null,
    error:            null,
    peerAddress:      null,
    serverReady:      false,
  });

  const unsubs = useRef([]);

  const updateStatus = useCallback((patch) => {
    setStatus(prev => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    const U = unsubs.current;

    U.push(localPeerService.on('server_ready', ({ port }) => {
      updateStatus({ serverReady: true, connecting: false, error: null });
    }));

    U.push(localPeerService.on('connected', ({ address }) => {
      updateStatus({
        connected: true,
        connecting: false,
        reconnecting: false,
        reconnectAttempt: 0,
        peerAddress: address,
        error: null,
      });
    }));

    U.push(localPeerService.on('disconnected', () => {
      updateStatus({ connected: false, rtt: null, peerAddress: null });
    }));

    U.push(localPeerService.on('reconnecting', ({ attempt, delay }) => {
      updateStatus({
        reconnecting: true,
        connecting: true,
        reconnectAttempt: attempt,
        connected: false,
      });
    }));

    U.push(localPeerService.on('reconnect_failed', ({ attempts }) => {
      updateStatus({
        reconnecting: false,
        connecting: false,
        error: `Failed to reconnect after ${attempts} attempts`,
      });
    }));

    U.push(localPeerService.on('ping_rtt', ({ rtt }) => {
      updateStatus({ rtt });
    }));

    U.push(localPeerService.on('peer_timeout', () => {
      updateStatus({ connected: false, error: 'Peer timed out', rtt: null });
    }));

    U.push(localPeerService.on('error', ({ message }) => {
      updateStatus({ error: message });
    }));

    return () => {
      U.forEach(fn => fn());
      unsubs.current = [];
    };
  }, [updateStatus]);

  /** HOST: start TCP server */
  const startServer = useCallback((port) => {
    updateStatus({ connecting: true, serverReady: false });
    localPeerService.startServer(port);
  }, [updateStatus]);

  /** CONTROLLER: connect to host */
  const connect = useCallback((ip, port) => {
    updateStatus({ connecting: true, error: null });
    localPeerService.connectToHost(ip, port);
  }, [updateStatus]);

  /** Send a typed event to peer */
  const send = useCallback((type, payload) => {
    return localPeerService.send(type, payload);
  }, []);

  /** Subscribe to peer event. Returns unsub fn. */
  const on = useCallback((event, handler) => {
    return localPeerService.on(event, handler);
  }, []);

  /** Teardown */
  const destroy = useCallback(() => {
    localPeerService.destroy();
    setStatus({
      connected: false, connecting: false, reconnecting: false,
      reconnectAttempt: 0, rtt: null, error: null,
      peerAddress: null, serverReady: false,
    });
  }, []);

  return { status, startServer, connect, send, on, destroy };
}
