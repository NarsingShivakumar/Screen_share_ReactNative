import { useRef, useState, useCallback } from 'react';
import {
  RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, mediaDevices,
} from 'react-native-webrtc';

const ICE = {
  iceServers: {
    iceServers: [
      { urls: 'stun:52.140.52.186:3478' },
      {
        urls: 'turn:52.140.52.186:3478',
        username: 'deal',
        credential: 'deal@niw'
      },
      {
        urls: 'turn:52.140.52.186:5349?transport=tcp',
        username: 'deal',
        credential: 'deal@niw'
      }
    ],
  }
};

export function useWebRTC(socket) {
  const pcRef = useRef(null);
  const localStream = useRef(null);
  const roomCodeRef = useRef('');
  const roleRef = useRef('assistant');
  const pending = useRef([]);
  const remoteSet = useRef(false);
  const offerSent = useRef(false);
  const unsubs = useRef([]);

  const [isMuted, setIsMuted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialising, setIsInitialising] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [remoteStream, setRemoteStream] = useState(null);

  const applyCandidate = useCallback(async c => {
    try { await pcRef.current.addIceCandidate(new RTCIceCandidate(c)); }
    catch (e) { console.warn('[WebRTC] addIceCandidate:', e); }
  }, []);

  const flushPending = useCallback(async () => {
    for (const c of pending.current) await applyCandidate(c);
    pending.current = [];
  }, [applyCandidate]);

  const sendOffer = useCallback(async () => {
    if (!pcRef.current || offerSent.current) return;
    offerSent.current = true;
    const offer = await pcRef.current.createOffer({ offerToReceiveAudio: true });
    await pcRef.current.setLocalDescription(offer);
    socket.emit('vr_webrtc_offer', { roomCode: roomCodeRef.current, sdp: offer });
  }, [socket]);

  const buildPC = useCallback(() => {
    const pc = new RTCPeerConnection(ICE);
    pcRef.current = pc;
    localStream.current?.getTracks().forEach(t => pc.addTrack(t, localStream.current));
    pc.ontrack = e => setRemoteStream(e.streams[0]);
    pc.onicecandidate = e => {
      if (e.candidate) socket.emit('vr_webrtc_ice', {
        roomCode: roomCodeRef.current,
        candidate: e.candidate.toJSON?.() ?? e.candidate,
      });
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      setIsConnected(s === 'connected');
      if (['connected', 'failed', 'disconnected'].includes(s)) setIsInitialising(false);
      if (['failed', 'disconnected'].includes(s)) {
        setHasError(true);
        setErrorMessage('Audio connection dropped — try restarting the call.');
      }
    };
  }, [socket]);

  const listenForSignaling = useCallback(() => {
    unsubs.current.push(
      socket.on('webrtc_patient_ready', async () => {
        if (roleRef.current === 'assistant') await sendOffer();
      }),
      socket.on('vr_offer', async sdp => {
        if (roleRef.current !== 'patient' || !pcRef.current) return;
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        remoteSet.current = true; await flushPending();
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socket.emit('vr_webrtc_answer', { roomCode: roomCodeRef.current, sdp: answer });
      }),
      socket.on('vr_answer', async sdp => {
        if (roleRef.current !== 'assistant' || !pcRef.current) return;
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        remoteSet.current = true; await flushPending();
      }),
      socket.on('vr_candidate', async data => {
        if (!pcRef.current || !data?.candidate) return;
        if (!remoteSet.current) { pending.current.push(data.candidate); return; }
        await applyCandidate(data.candidate);
      }),
    );
  }, [socket, sendOffer, flushPending, applyCandidate]);

  const initAudio = useCallback(async (role, roomCode) => {
    if (isInitialising || isConnected) return;
    roleRef.current = role; roomCodeRef.current = roomCode;
    setHasError(false); setErrorMessage(''); setIsInitialising(true);
    pending.current = []; remoteSet.current = false; offerSent.current = false;
    try {
      localStream.current = await mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }, video: false,
      });
    } catch {
      setHasError(true);
      setErrorMessage('Microphone access denied — check device permissions.');
      setIsInitialising(false); return;
    }
    buildPC(); listenForSignaling();
    if (role === 'assistant') socket.emit('vr_webrtc_ping_patient', { roomCode });
    else socket.emit('vr_webrtc_patient_ready', { roomCode });
  }, [isInitialising, isConnected, buildPC, listenForSignaling, socket]);

  const toggleMute = useCallback(() => {
    const next = !isMuted; setIsMuted(next);
    localStream.current?.getAudioTracks().forEach(t => { t.enabled = !next; });
  }, [isMuted]);

  const forceLocalMute = useCallback(muted => {
    setIsMuted(muted);
    localStream.current?.getAudioTracks().forEach(t => { t.enabled = !muted; });
  }, []);

  const disconnect = useCallback(() => {
    unsubs.current.forEach(u => u()); unsubs.current = [];
    localStream.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close(); pcRef.current = null; localStream.current = null;
    setRemoteStream(null); setIsConnected(false); setIsInitialising(false); setIsMuted(false);
    pending.current = []; remoteSet.current = false; offerSent.current = false;
  }, []);

  return {
    initAudio, toggleMute, forceLocalMute, disconnect,
    isMuted, isConnected, isInitialising, hasError, errorMessage, remoteStream
  };
}