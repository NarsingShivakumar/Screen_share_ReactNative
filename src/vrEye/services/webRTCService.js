/**
 * webRTCService.js
 * Converted from Angular WebRtcService (web-rtc.service.ts)
 * Uses react-native-webrtc — install: npm install react-native-webrtc
 * Also requires microphone permission in AndroidManifest.xml & Info.plist
 */
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
} from 'react-native-webrtc';
import socketService from './socketService';
import { iceServers, socketURI } from '../../assets/constants';
// import { socketURI } from '../config';

class WebRTCService {
  constructor() {
    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;
    this.roomCode = '';
    this.role = 'assistant';
    this.pendingCandidates = [];
    this.remoteDescSet = false;
    this.offerSent = false;

    // Public state (mirrors the Angular class properties)
    this.isMuted = false;
    this.isConnected = false;
    this.isInitialising = false;
    this.hasError = false;
    this.errorMessage = '';

    this._socketUnsubs = []; // socket listener cleanup fns
    this._stateListeners = [];
  }

  /**
   * Subscribe to WebRTC state changes (replaces Angular's property binding).
   * @param {Function} callback - receives state snapshot
   * @returns {Function} unsubscribe
   */
  onStateChange(callback) {
    this._stateListeners.push(callback);
    return () => {
      this._stateListeners = this._stateListeners.filter(l => l !== callback);
    };
  }

  _notifyState() {
    const state = {
      isMuted: this.isMuted,
      isConnected: this.isConnected,
      isInitialising: this.isInitialising,
      hasError: this.hasError,
      errorMessage: this.errorMessage,
      remoteStream: this.remoteStream,
    };
    this._stateListeners.forEach(l => l(state));
  }

  /**
   * Initialise audio and WebRTC peer connection.
   * @param {'assistant' | 'patient'} role
   * @param {string} roomCode
   */
  async initAudio(role, roomCode) {
    if (this.isInitialising || this.isConnected) {
      console.warn('[WebRTC] initAudio called while already initialising/connected — ignored');
      return;
    }

    this.role = role;
    this.roomCode = roomCode;
    this.hasError = false;
    this.errorMessage = '';
    this.isInitialising = true;
    this.pendingCandidates = [];
    this.remoteDescSet = false;
    this.offerSent = false;
    this._notifyState();

    try {
      this.localStream = await mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
    } catch {
      this.hasError = true;
      this.errorMessage = 'Microphone access denied – check app permissions.';
      this.isInitialising = false;
      this._notifyState();
      return;
    }

    this._buildPeerConnection();
    this._listenForSignaling();

    if (role === 'assistant') {
      socketService.emit('vr_webrtc_ping_patient', { roomCode: this.roomCode });
      console.log('[WebRTC] Assistant ready — pinging patient');
    } else {
      socketService.emit('vr_webrtc_patient_ready', { roomCode: this.roomCode });
      console.log('[WebRTC] Patient ready signal sent');
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.localStream?.getAudioTracks().forEach(t => (t.enabled = !this.isMuted));
    this._notifyState();
  }

  /** Called when assistant sends a remote mute/unmute command */
  forceLocalMute(muted) {
    this.isMuted = muted;
    this.localStream?.getAudioTracks().forEach(t => (t.enabled = !muted));
    this._notifyState();
  }

  disconnect() {
    this._socketUnsubs.forEach(unsub => unsub());
    this._socketUnsubs = [];
    this.localStream?.getTracks().forEach(t => t.stop());
    this.pc?.close();
    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;
    this.isConnected = false;
    this.isInitialising = false;
    this.isMuted = false;
    this.pendingCandidates = [];
    this.remoteDescSet = false;
    this.offerSent = false;
    this._notifyState();
  }

  _buildPeerConnection() {
    this.pc = new RTCPeerConnection(iceServers);

    this.localStream.getTracks().forEach(t =>
      this.pc.addTrack(t, this.localStream)
    );

    this.pc.ontrack = (event) => {
      console.log('[WebRTC] Remote track received');
      this.remoteStream = event.streams[0];
      this._notifyState();
    };

    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketService.emit('vr_webrtc_ice', {
          roomCode: this.roomCode,
          candidate: e.candidate.toJSON(),
        });
      }
    };

    this.pc.onconnectionstatechange = () => {
      const s = this.pc?.connectionState;
      console.log('[WebRTC] Connection state:', s);
      this.isConnected = s === 'connected';

      if (s === 'connected' || s === 'failed' || s === 'disconnected') {
        this.isInitialising = false;
      }
      if (s === 'failed' || s === 'disconnected') {
        this.hasError = true;
        this.errorMessage = 'Audio connection dropped – try ending and restarting the call.';
      }
      this._notifyState();
    };

    this.pc.onicegatheringstatechange = () => {
      console.log('[WebRTC] ICE gathering state:', this.pc?.iceGatheringState);
    };
  }

  _listenForSignaling() {
    // Assistant receives this after pinging the patient
    const onPatientReady = async () => {
      if (this.role !== 'assistant') return;
      console.log('[WebRTC] Patient is ready — sending offer');
      await this._createAndSendOffer();
    };
    this._socketUnsubs.push(socketService.on('webrtc_patient_ready', onPatientReady));

    const onOffer = async (sdp) => {
      if (this.role !== 'patient' || !this.pc) return;
      console.log('[WebRTC] Received offer');
      try {
        await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
        this.remoteDescSet = true;
        await this._flushPendingCandidates();
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        socketService.emit('vr_webrtc_answer', { roomCode: this.roomCode, sdp: answer });
        console.log('[WebRTC] Answer sent');
      } catch (err) {
        console.error('[WebRTC] answer error', err);
      }
    };
    this._socketUnsubs.push(socketService.on('vr_offer', onOffer));

    const onAnswer = async (sdp) => {
      if (this.role !== 'assistant' || !this.pc) return;
      console.log('[WebRTC] Received answer');
      try {
        await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
        this.remoteDescSet = true;
        await this._flushPendingCandidates();
      } catch (err) {
        console.error('[WebRTC] setRemote answer error', err);
      }
    };
    this._socketUnsubs.push(socketService.on('vr_answer', onAnswer));

    const onCandidate = async (data) => {
      if (!this.pc || !data?.candidate) return;
      if (!this.remoteDescSet) {
        console.log('[WebRTC] Buffering ICE candidate (remote desc not set yet)');
        this.pendingCandidates.push(data.candidate);
        return;
      }
      await this._applyCandidate(data.candidate);
    };
    this._socketUnsubs.push(socketService.on('vr_candidate', onCandidate));
  }

  async _flushPendingCandidates() {
    if (!this.pendingCandidates.length) return;
    console.log(`[WebRTC] Flushing ${this.pendingCandidates.length} buffered ICE candidate(s)`);
    for (const c of this.pendingCandidates) {
      await this._applyCandidate(c);
    }
    this.pendingCandidates = [];
  }

  async _applyCandidate(candidate) {
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('[WebRTC] addIceCandidate error:', err);
    }
  }

  async _createAndSendOffer() {
    if (!this.pc) return;
    if (this.offerSent) {
      console.warn('[WebRTC] createAndSendOffer called again — already sent, ignoring');
      return;
    }
    this.offerSent = true;
    try {
      const offer = await this.pc.createOffer({ offerToReceiveAudio: true });
      await this.pc.setLocalDescription(offer);
      socketService.emit('vr_webrtc_offer', { roomCode: this.roomCode, sdp: offer });
      console.log('[WebRTC] Offer sent');
    } catch (err) {
      console.error('[WebRTC] offer error', err);
    }
  }
}

export default new WebRTCService();
