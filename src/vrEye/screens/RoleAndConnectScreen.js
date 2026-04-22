/**
 * RoleAndConnectScreen.js  v1.0
 *
 * Single screen handling:
 *   1. Role selection  → HOST or CONTROLLER
 *   2a. HOST           → starts server, shows LAN IP + 6-digit pairing code + QR
 *   2b. CONTROLLER     → scans for LAN hosts (mDNS/UDP broadcast) OR
 *                        scans QR OR manual IP entry
 *   3. On connection   → navigate to PatientScreen (host) or ControllerScreen
 *
 * Dependencies:
 *   npm install react-native-tcp-socket react-native-network-info
 *   npm install react-native-camera  (QR scan)   ← optional, graceful fallback
 *   npm install react-native-qrcode-svg          (QR display)
 *   iOS: cd ios && pod install
 *
 * mDNS / UDP Discovery:
 *   Host broadcasts a UDP beacon on port 54322 every 2 s:
 *     { type:'vreye_host', ip, port, code, name }
 *   Controller listens on 54322 and collects discovered hosts.
 *   Uses react-native-udp (npm install react-native-udp)
 *   Falls back gracefully if UDP is unavailable.
 */

import React, {
  useState, useEffect, useRef, useCallback, memo,
} from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  Dimensions, Platform, ActivityIndicator, Animated,
  ScrollView, StatusBar, Vibration, Alert,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import localPeerService, { PEER_ROLE } from '../services/localPeerService';

// ── Optional native modules (graceful fallback) ───────────────────────────────
let NetworkInfo  = null;
let QRCode       = null;
let RNCamera     = null;
let UdpSocket    = null;

try { NetworkInfo  = require('react-native-network-info').NetworkInfo;  } catch {}
try { QRCode       = require('react-native-qrcode-svg').default;        } catch {}
try { RNCamera     = require('react-native-camera').RNCamera;           } catch {}
try { UdpSocket    = require('react-native-udp');                       } catch {}

// ── Constants ─────────────────────────────────────────────────────────────────
const TCP_PORT       = 54321;
const UDP_PORT       = 54322;
const BEACON_INTERVAL = 2000;   // ms between UDP broadcasts
const DISCOVERY_TIMEOUT = 300;  // ms a discovered host stays "alive"
const { width: W, height: H } = Dimensions.get('window');

// ── Helpers ───────────────────────────────────────────────────────────────────
const randomCode = () => String(Math.floor(100000 + Math.random() * 900000));

const qrPayload = (ip, port, code) =>
  JSON.stringify({ t: 'vreye', ip, port: String(port), code });

// ─────────────────────────────────────────────────────────────────────────────
export default function RoleAndConnectScreen({ navigation }) {
  // ── Step: 'role' | 'host' | 'controller' ─────────────────────────────────
  const [step, setStep] = useState('role');

  // ── Shared ─────────────────────────────────────────────────────────────────
  const [peerStatus, setPeerStatus] = useState({
    connected: false, connecting: false, reconnecting: false,
    reconnectAttempt: 0, rtt: null, error: null,
  });
  const [navigating, setNavigating] = useState(false);
  const navigated = useRef(false);

  // ── HOST state ─────────────────────────────────────────────────────────────
  const [localIp,   setLocalIp]   = useState('');
  const [pairingCode, setPairingCode] = useState(() => randomCode());
  const [serverReady, setServerReady] = useState(false);

  // ── CONTROLLER state ───────────────────────────────────────────────────────
  const [ctrlTab, setCtrlTab] = useState('discover'); // 'discover' | 'qr' | 'manual'
  const [discovered, setDiscovered] = useState([]);   // [{ ip, port, code, name, ts }]
  const [manualIp,  setManualIp]  = useState('');
  const [manualPort, setManualPort] = useState(String(TCP_PORT));
  const [scanning,  setScanning]  = useState(false);
  const [scanError, setScanError] = useState('');

  const udpRef     = useRef(null);
  const beaconRef  = useRef(null);
  const peerUnsubs = useRef([]);

  // ── Peer service listeners (shared) ──────────────────────────────────────
  useEffect(() => {
    const U = peerUnsubs.current;

    U.push(localPeerService.on('server_ready', () =>
      setPeerStatus(p => ({ ...p, connecting: false, error: null }))));

    U.push(localPeerService.on('connected', ({ address }) => {
      setPeerStatus(p => ({ ...p, connected: true, connecting: false, reconnecting: false, error: null, peerAddress: address }));
    }));

    U.push(localPeerService.on('disconnected', () =>
      setPeerStatus(p => ({ ...p, connected: false, rtt: null }))));

    U.push(localPeerService.on('reconnecting', ({ attempt }) =>
      setPeerStatus(p => ({ ...p, reconnecting: true, connecting: true, reconnectAttempt: attempt, connected: false }))));

    U.push(localPeerService.on('ping_rtt', ({ rtt }) =>
      setPeerStatus(p => ({ ...p, rtt }))));

    U.push(localPeerService.on('peer_timeout', () =>
      setPeerStatus(p => ({ ...p, connected: false, error: 'Peer timed out', rtt: null }))));

    U.push(localPeerService.on('error', ({ message }) =>
      setPeerStatus(p => ({ ...p, error: message }))));

    return () => {
      U.forEach(fn => fn());
      peerUnsubs.current = [];
    };
  }, []);

  // ── Navigate once connected ───────────────────────────────────────────────
  useEffect(() => {
    if (peerStatus.connected && !navigated.current) {
      navigated.current = true;
      setNavigating(true);
      Vibration.vibrate(60);
      setTimeout(() => {
        if (step === 'host') {
          navigation.replace('PatientScreen', { deviceRole: PEER_ROLE.HOST });
        } else {
          navigation.replace('ControllerScreen');
        }
      }, 900);
    }
  }, [peerStatus.connected, step]); // eslint-disable-line

  // ── HOST: fetch IP + start server ─────────────────────────────────────────
  const startHost = useCallback(async () => {
    setStep('host');
    setPeerStatus(p => ({ ...p, connecting: true }));

    // Get local IP
    try {
      const ip = await NetworkInfo?.getIPV4Address?.()
               ?? await NetworkInfo?.getIPAddress?.()
               ?? '';
      setLocalIp(ip);
      startUdpBeacon(ip, TCP_PORT, pairingCode);
    } catch { setLocalIp(''); }

    localPeerService.startServer(TCP_PORT);
    setServerReady(true);
  }, [pairingCode]); // eslint-disable-line

  // ── HOST: UDP broadcast beacon ────────────────────────────────────────────
  const startUdpBeacon = useCallback((ip, port, code) => {
    if (!UdpSocket) return;
    try {
      const sock = UdpSocket.createSocket({ type: 'udp4', reusePort: true });
      udpRef.current = sock;
      sock.bind(0, () => {
        try { sock.setBroadcast(true); } catch {}
        const msg = JSON.stringify({ t: 'vreye_host', ip, port, code, name: `VREye-${code}` });
        const buf  = Buffer.from(msg);
        const broadcast = () => {
          try { sock.send(buf, 0, buf.length, UDP_PORT, '255.255.255.255'); } catch {}
        };
        broadcast();
        beaconRef.current = setInterval(broadcast, BEACON_INTERVAL);
      });
    } catch (e) {
      console.warn('[Beacon] UDP unavailable:', e.message);
    }
  }, []);

  // ── CONTROLLER: UDP discovery ─────────────────────────────────────────────
  useEffect(() => {
    if (step !== 'controller' || ctrlTab !== 'discover') return;
    if (!UdpSocket) return;

    let sock;
    try {
      sock = UdpSocket.createSocket({ type: 'udp4', reusePort: true });
      sock.bind(UDP_PORT, () => {
        try { sock.setBroadcast(true); } catch {}
        sock.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.t !== 'vreye_host') return;
            setDiscovered(prev => {
              const exists = prev.find(h => h.ip === msg.ip && h.port === msg.port);
              const entry  = { ip: msg.ip, port: msg.port, code: msg.code, name: msg.name, ts: Date.now() };
              if (exists) return prev.map(h => h.ip === msg.ip ? entry : h);
              return [...prev, entry];
            });
          } catch {}
        });
      });
    } catch (e) { console.warn('[Discovery] UDP unavailable:', e.message); }

    // Prune stale hosts
    const pruner = setInterval(() => {
      setDiscovered(prev => prev.filter(h => Date.now() - h.ts < DISCOVERY_TIMEOUT * 5));
    }, 3000);

    return () => {
      try { sock?.close(); } catch {}
      clearInterval(pruner);
    };
  }, [step, ctrlTab]);

  // ── CONTROLLER: connect to a host ─────────────────────────────────────────
  const connectToHost = useCallback((ip, port) => {
    setPeerStatus(p => ({ ...p, connecting: true, error: null }));
    localPeerService.connectToHost(ip, parseInt(port, 10) || TCP_PORT);
  }, []);

  const connectManual = useCallback(() => {
    const ip = manualIp.trim();
    if (!ip) { Alert.alert('Enter IP', 'Please enter the host device IP address.'); return; }
    connectToHost(ip, manualPort);
  }, [manualIp, manualPort, connectToHost]);

  // ── CONTROLLER: QR scan result ────────────────────────────────────────────
  const onQRRead = useCallback(({ data }) => {
    if (scanning) return;
    try {
      const parsed = JSON.parse(data);
      if (parsed.t !== 'vreye') throw new Error('Not a VREye QR');
      setScanning(true);
      setScanError('');
      connectToHost(parsed.ip, parsed.port);
    } catch {
      setScanError('Invalid QR code. Please scan the code shown on the VR device.');
    }
  }, [scanning, connectToHost]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => () => {
    if (beaconRef.current) clearInterval(beaconRef.current);
    try { udpRef.current?.close(); } catch {}
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: Role selection
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === 'role') {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={r.root} edges={['top','bottom','left','right']}>
          <StatusBar barStyle="light-content" backgroundColor="#050510" />
          <RoleGrid onSelectHost={startHost} onSelectController={() => setStep('controller')} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: HOST panel
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === 'host') {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={r.root} edges={['top','bottom','left','right']}>
          <StatusBar barStyle="light-content" />
          <ScrollView contentContainerStyle={r.scroll} showsVerticalScrollIndicator={false}>

            <BackBtn onPress={() => { localPeerService.destroy(); setStep('role'); setPeerStatus(p => ({...p, connecting: false})); setServerReady(false); }} />

            <View style={r.headerRow}>
              <View style={[r.rolePill, r.rolePillHost]}>
                <Text style={r.rolePillText}>🥽  VR HOST</Text>
              </View>
              <ConnectionDot status={peerStatus} />
            </View>

            <Text style={r.pageTitle}>Waiting for{'\n'}Controller</Text>
            <Text style={r.pageSub}>Share any of these with the controller operator</Text>

            {/* ── QR Code ── */}
            <View style={r.qrCard}>
              {QRCode && localIp ? (
                <QRCode
                  value={qrPayload(localIp, TCP_PORT, pairingCode)}
                  size={160}
                  color="#e8e8f8"
                  backgroundColor="transparent"
                />
              ) : (
                <View style={r.qrPlaceholder}>
                  <Text style={r.qrPlaceholderText}>
                    {QRCode ? 'Loading…' : 'Install react-native-qrcode-svg for QR'}
                  </Text>
                </View>
              )}
              <Text style={r.qrHint}>Scan with controller device</Text>
            </View>

            {/* ── Divider ── */}
            <View style={r.orRow}><View style={r.orLine}/><Text style={r.orText}>or share</Text><View style={r.orLine}/></View>

            {/* ── Pairing code ── */}
            <View style={r.codeCard}>
              <Text style={r.codeLabel}>PAIRING CODE</Text>
              <Text style={r.codeValue}>{pairingCode}</Text>
              <TouchableOpacity style={r.refreshBtn} onPress={() => setPairingCode(randomCode())} activeOpacity={0.7}>
                <Text style={r.refreshText}>↺  New code</Text>
              </TouchableOpacity>
            </View>

            {/* ── IP ── */}
            <View style={r.ipRow}>
              <Text style={r.ipLabel}>IP ADDRESS</Text>
              <Text style={r.ipValue}>{localIp || '…'}</Text>
              <Text style={r.ipPort}>:{TCP_PORT}</Text>
            </View>

            {/* ── Status ── */}
            <View style={r.statusCard}>
              {peerStatus.connected ? (
                <View style={r.statusRow}>
                  <View style={[r.dot, r.dotGreen]} />
                  <Text style={r.statusText}>Controller connected!</Text>
                  {peerStatus.rtt != null && <Text style={r.rttPill}>{peerStatus.rtt}ms</Text>}
                </View>
              ) : serverReady ? (
                <View style={r.statusRow}>
                  <PulsingDot color="#f9a825" />
                  <Text style={r.statusText}>Ready — waiting for controller to connect</Text>
                </View>
              ) : (
                <View style={r.statusRow}>
                  <ActivityIndicator size="small" color="#7c7cf0" style={{ marginRight: 8 }} />
                  <Text style={r.statusText}>Starting server…</Text>
                </View>
              )}
            </View>

            {navigating && <NavigatingOverlay />}
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: CONTROLLER panel
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaProvider>
      <SafeAreaView style={r.root} edges={['top','bottom','left','right']}>
        <StatusBar barStyle="light-content" />

        <View style={r.ctrlTop}>
          <BackBtn onPress={() => setStep('role')} />
          <View style={r.headerRow}>
            <View style={[r.rolePill, r.rolePillCtrl]}>
              <Text style={r.rolePillText}>🎮  CONTROLLER</Text>
            </View>
            <ConnectionDot status={peerStatus} />
          </View>
          <Text style={r.pageTitle}>Find VR Host</Text>

          {/* ── Tab bar ── */}
          <View style={r.tabBar}>
            {[
              { key: 'discover', icon: '📡', label: 'Discover' },
              { key: 'qr',       icon: '⬛', label: 'Scan QR'  },
              { key: 'manual',   icon: '⌨',  label: 'Manual'   },
            ].map(t => (
              <TouchableOpacity
                key={t.key}
                style={[r.tab, ctrlTab === t.key && r.tabActive]}
                onPress={() => { setCtrlTab(t.key); setScanError(''); setScanning(false); }}
                activeOpacity={0.7}
              >
                <Text style={r.tabIcon}>{t.icon}</Text>
                <Text style={[r.tabLabel, ctrlTab === t.key && r.tabLabelActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Tab content ── */}
        <ScrollView contentContainerStyle={r.ctrlScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* DISCOVER */}
          {ctrlTab === 'discover' && (
            <DiscoverTab
              discovered={discovered}
              connecting={peerStatus.connecting}
              onConnect={connectToHost}
              udpAvailable={!!UdpSocket}
            />
          )}

          {/* QR SCAN */}
          {ctrlTab === 'qr' && (
            <QRTab
              onRead={onQRRead}
              scanning={scanning}
              scanError={scanError}
              cameraAvailable={!!RNCamera}
              connecting={peerStatus.connecting}
            />
          )}

          {/* MANUAL */}
          {ctrlTab === 'manual' && (
            <ManualTab
              ip={manualIp}
              port={manualPort}
              onIpChange={setManualIp}
              onPortChange={setManualPort}
              onConnect={connectManual}
              connecting={peerStatus.connecting}
            />
          )}

          {/* ── Connection status ── */}
          {(peerStatus.connecting || peerStatus.error) && (
            <View style={[
              r.ctrlStatus,
              peerStatus.error ? r.ctrlStatusErr : r.ctrlStatusInfo,
            ]}>
              {peerStatus.connecting && !peerStatus.error && (
                <ActivityIndicator size="small" color="#7c7cf0" style={{ marginRight: 8 }} />
              )}
              <Text style={r.ctrlStatusText}>
                {peerStatus.error
                  ? `⚠ ${peerStatus.error}`
                  : peerStatus.reconnecting
                    ? `Reconnecting… (attempt ${peerStatus.reconnectAttempt})`
                    : 'Connecting…'}
              </Text>
            </View>
          )}

          {navigating && <NavigatingOverlay />}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-screens
// ─────────────────────────────────────────────────────────────────────────────

// ── Role Grid ─────────────────────────────────────────────────────────────────
function RoleGrid({ onSelectHost, onSelectController }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideVR  = useRef(new Animated.Value(30)).current;
  const slideCTRL= useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideVR,   { toValue: 0, duration: 440, delay: 80,  useNativeDriver: true }),
      Animated.timing(slideCTRL, { toValue: 0, duration: 440, delay: 180, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[r.roleRoot, { opacity: fadeAnim }]}>
      <View style={r.roleHeader}>
        <Text style={r.roleEyebrow}>Vision Screening System</Text>
        <Text style={r.roleTitle}>Select{'\n'}Your Role</Text>
        <Text style={r.roleSub}>Both devices must be on the same Wi-Fi network</Text>
      </View>

      <View style={r.roleCards}>
        <Animated.View style={{ transform: [{ translateY: slideVR }] }}>
          <TouchableOpacity style={[r.roleCard, r.roleCardHost]} onPress={onSelectHost} activeOpacity={0.88}>
            <View style={r.roleCardInner}>
              <Text style={r.roleCardEmoji}>🥽</Text>
              <View style={r.roleCardText}>
                <Text style={r.roleCardTitle}>VR Host</Text>
                <Text style={r.roleCardDesc}>Device inside{'\n'}the headset</Text>
              </View>
              <View style={r.roleCardBadge}>
                <Text style={r.roleCardBadgeText}>PATIENT SIDE</Text>
              </View>
              <Text style={r.roleCardArrow}>→</Text>
            </View>
            <View style={[r.roleCardAccent, r.roleCardAccentHost]} />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={{ transform: [{ translateY: slideCTRL }] }}>
          <TouchableOpacity style={[r.roleCard, r.roleCardCtrl]} onPress={onSelectController} activeOpacity={0.88}>
            <View style={r.roleCardInner}>
              <Text style={r.roleCardEmoji}>🎮</Text>
              <View style={r.roleCardText}>
                <Text style={r.roleCardTitle}>Controller</Text>
                <Text style={r.roleCardDesc}>Operator handles{'\n'}registration</Text>
              </View>
              <View style={[r.roleCardBadge, r.roleCardBadgeCtrl]}>
                <Text style={r.roleCardBadgeText}>OPERATOR SIDE</Text>
              </View>
              <Text style={r.roleCardArrow}>→</Text>
            </View>
            <View style={[r.roleCardAccent, r.roleCardAccentCtrl]} />
          </TouchableOpacity>
        </Animated.View>
      </View>

      <View style={r.roleFooter}>
        <View style={r.roleStep}><Text style={r.roleStepNum}>1</Text><Text style={r.roleStepText}>Both open this screen and select their role</Text></View>
        <View style={r.roleStep}><Text style={r.roleStepNum}>2</Text><Text style={r.roleStepText}>Controller connects to the host via QR, code, or discovery</Text></View>
        <View style={r.roleStep}><Text style={r.roleStepNum}>3</Text><Text style={r.roleStepText}>Registration and test control from the controller device</Text></View>
      </View>
    </Animated.View>
  );
}

// ── Discover Tab ──────────────────────────────────────────────────────────────
const DiscoverTab = memo(({ discovered, connecting, onConnect, udpAvailable }) => (
  <View style={r.tabContent}>
    {!udpAvailable && (
      <View style={r.infoBox}>
        <Text style={r.infoText}>
          📦 Install <Text style={r.infoEm}>react-native-udp</Text> to enable auto-discovery.{'\n'}
          Use QR scan or manual entry instead.
        </Text>
      </View>
    )}

    {udpAvailable && (
      <View style={r.discoverHeader}>
        <PulsingDot color="#7c7cf0" />
        <Text style={r.discoverScanText}>Scanning for VR hosts on this network…</Text>
      </View>
    )}

    {discovered.length === 0 ? (
      <View style={r.emptyDiscover}>
        <Text style={r.emptyDiscoverEmoji}>📡</Text>
        <Text style={r.emptyDiscoverTitle}>No hosts found yet</Text>
        <Text style={r.emptyDiscoverSub}>
          {udpAvailable
            ? 'Make sure the VR host device is on the same Wi-Fi and has started.'
            : 'Use the QR or Manual tab to connect.'}
        </Text>
      </View>
    ) : (
      <View style={r.hostList}>
        <Text style={r.hostListLabel}>{discovered.length} host{discovered.length !== 1 ? 's' : ''} found</Text>
        {discovered.map(h => (
          <TouchableOpacity
            key={`${h.ip}:${h.port}`}
            style={r.hostCard}
            onPress={() => !connecting && onConnect(h.ip, h.port)}
            activeOpacity={0.75}
            disabled={connecting}
          >
            <View style={r.hostCardLeft}>
              <View style={[r.dot, r.dotGreen]} />
              <View>
                <Text style={r.hostCardName}>{h.name ?? `VREye`}</Text>
                <Text style={r.hostCardIp}>{h.ip}:{h.port}</Text>
              </View>
            </View>
            <View style={r.hostCardCode}>
              <Text style={r.hostCardCodeLabel}>CODE</Text>
              <Text style={r.hostCardCodeValue}>{h.code}</Text>
            </View>
            <Text style={r.hostCardArrow}>→</Text>
          </TouchableOpacity>
        ))}
      </View>
    )}
  </View>
));

// ── QR Tab ────────────────────────────────────────────────────────────────────
const QRTab = memo(({ onRead, scanning, scanError, cameraAvailable, connecting }) => {
  if (!cameraAvailable) {
    return (
      <View style={r.tabContent}>
        <View style={r.infoBox}>
          <Text style={r.infoText}>
            📦 Install <Text style={r.infoEm}>react-native-camera</Text> to enable QR scanning.{'\n'}
            Use Discovery or Manual instead.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={r.tabContent}>
      <Text style={r.qrScanInstr}>Point camera at the QR code shown on the VR host screen</Text>
      <View style={r.cameraContainer}>
        <RNCamera
          style={r.camera}
          type={RNCamera.Constants.Type.back}
          onBarCodeRead={scanning || connecting ? undefined : onRead}
          barCodeTypes={[RNCamera.Constants.BarCodeType.qr]}
          captureAudio={false}
        >
          <View style={r.cameraOverlay}>
            <View style={r.scanFrame}>
              <View style={[r.scanCorner, r.scanTL]} />
              <View style={[r.scanCorner, r.scanTR]} />
              <View style={[r.scanCorner, r.scanBL]} />
              <View style={[r.scanCorner, r.scanBR]} />
            </View>
          </View>
        </RNCamera>
      </View>
      {scanError ? <Text style={r.scanError}>{scanError}</Text> : null}
      {(scanning || connecting) && (
        <View style={r.scanningRow}>
          <ActivityIndicator color="#7c7cf0" size="small" />
          <Text style={r.scanningText}>Connecting…</Text>
        </View>
      )}
    </View>
  );
});

// ── Manual Tab ────────────────────────────────────────────────────────────────
const ManualTab = memo(({ ip, port, onIpChange, onPortChange, onConnect, connecting }) => (
  <View style={r.tabContent}>
    <Text style={r.manualInstr}>Enter the IP address and port shown on the VR host device</Text>

    <View style={r.manualField}>
      <Text style={r.manualLabel}>IP ADDRESS</Text>
      <TextInput
        style={r.manualInput}
        value={ip}
        onChangeText={onIpChange}
        placeholder="192.168.1.42"
        placeholderTextColor="#333"
        keyboardType="numeric"
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="next"
      />
    </View>

    <View style={r.manualField}>
      <Text style={r.manualLabel}>PORT</Text>
      <TextInput
        style={[r.manualInput, { width: 120 }]}
        value={port}
        onChangeText={onPortChange}
        placeholder="54321"
        placeholderTextColor="#333"
        keyboardType="numeric"
        returnKeyType="done"
        onSubmitEditing={onConnect}
      />
    </View>

    <TouchableOpacity
      style={[r.connectBtn, connecting && r.connectBtnOff]}
      onPress={onConnect}
      disabled={connecting}
      activeOpacity={0.85}
    >
      {connecting
        ? <ActivityIndicator color="#fff" />
        : <Text style={r.connectBtnText}>Connect  →</Text>}
    </TouchableOpacity>
  </View>
));

// ─────────────────────────────────────────────────────────────────────────────
// Micro-components
// ─────────────────────────────────────────────────────────────────────────────

function BackBtn({ onPress }) {
  return (
    <TouchableOpacity style={r.backBtn} onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Text style={r.backBtnText}>← Back</Text>
    </TouchableOpacity>
  );
}

function ConnectionDot({ status }) {
  const color = status.connected ? '#4caf50' : status.connecting ? '#f9a825' : '#444';
  return (
    <View style={r.connDot}>
      <View style={[r.dot, { backgroundColor: color }]} />
      <Text style={[r.connDotText, { color }]}>
        {status.connected
          ? `Connected${status.rtt != null ? `  ${status.rtt}ms` : ''}`
          : status.reconnecting ? `Reconnecting (${status.reconnectAttempt})`
          : status.connecting ? 'Connecting…' : 'Not connected'}
      </Text>
    </View>
  );
}

function PulsingDot({ color = '#4caf50' }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,   duration: 600, useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View style={[r.dot, { backgroundColor: color, opacity: pulse, marginRight: 8 }]} />;
}

function NavigatingOverlay() {
  return (
    <View style={r.navOverlay}>
      <ActivityIndicator color="#5b5bd6" size="large" />
      <Text style={r.navText}>Connected! Entering session…</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const r = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050510' },
  scroll: { paddingBottom: 40, paddingHorizontal: 20 },
  ctrlTop: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 0 },
  ctrlScroll: { padding: 20, paddingTop: 12, paddingBottom: 48 },

  // ── Role selection ────────────────────────────────────────────────────────
  roleRoot: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 20,
  },
  roleHeader: { marginBottom: 28, gap: 6 },
  roleEyebrow: {
    fontSize: 10, fontWeight: '700', letterSpacing: 3,
    color: '#5b5bd6', textTransform: 'uppercase',
  },
  roleTitle: {
    fontSize: 40, fontWeight: '200', color: '#eeeeff',
    letterSpacing: -1, lineHeight: 46,
  },
  roleSub: { color: '#445', fontSize: 13, marginTop: 4 },

  roleCards: { gap: 12, marginBottom: 28 },

  roleCard: {
    borderRadius: 18, overflow: 'hidden',
    borderWidth: 1,
    minHeight: 120,
  },
  roleCardHost: { backgroundColor: 'rgba(91,91,214,0.06)', borderColor: 'rgba(91,91,214,0.25)' },
  roleCardCtrl: { backgroundColor: 'rgba(0,188,140,0.06)', borderColor: 'rgba(0,188,140,0.22)' },

  roleCardInner: {
    flexDirection: 'row', alignItems: 'center',
    padding: 20, gap: 16, flex: 1,
  },
  roleCardEmoji: { fontSize: 32 },
  roleCardText: { flex: 1, gap: 3 },
  roleCardTitle: { color: '#dde', fontSize: 18, fontWeight: '600' },
  roleCardDesc: { color: '#667', fontSize: 12, lineHeight: 17 },
  roleCardBadge: {
    paddingVertical: 3, paddingHorizontal: 8,
    backgroundColor: 'rgba(91,91,214,0.15)',
    borderRadius: 4,
  },
  roleCardBadgeCtrl: { backgroundColor: 'rgba(0,188,140,0.15)' },
  roleCardBadgeText: { color: '#9090d0', fontSize: 9, fontWeight: '700', letterSpacing: 1.2 },
  roleCardArrow: { color: '#555', fontSize: 18 },
  roleCardAccent: { height: 2, width: '100%' },
  roleCardAccentHost: { backgroundColor: '#5b5bd6' },
  roleCardAccentCtrl: { backgroundColor: '#00bc8c' },

  roleFooter: { gap: 12 },
  roleStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  roleStepNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: '#222',
    textAlign: 'center', lineHeight: 22,
    color: '#556', fontSize: 11, fontWeight: '700',
    overflow: 'hidden',
  },
  roleStepText: { flex: 1, color: '#445', fontSize: 12, lineHeight: 18, paddingTop: 2 },

  // ── Shared header pieces ──────────────────────────────────────────────────
  backBtn: { paddingVertical: 6, alignSelf: 'flex-start' },
  backBtnText: { color: '#5b5bd6', fontSize: 13 },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },

  rolePill: {
    paddingVertical: 4, paddingHorizontal: 12, borderRadius: 100,
    borderWidth: 1,
  },
  rolePillHost: { backgroundColor: 'rgba(91,91,214,0.12)', borderColor: 'rgba(91,91,214,0.3)' },
  rolePillCtrl: { backgroundColor: 'rgba(0,188,140,0.1)',  borderColor: 'rgba(0,188,140,0.3)'  },
  rolePillText: { color: '#c0c0e0', fontSize: 11, fontWeight: '600' },

  pageTitle: { fontSize: 32, fontWeight: '200', color: '#eeeeff', letterSpacing: -0.5, marginTop: 12 },
  pageSub: { color: '#445', fontSize: 13, marginTop: 4, marginBottom: 20 },

  // ── Connection dot ────────────────────────────────────────────────────────
  connDot: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  connDotText: { fontSize: 11, fontWeight: '500' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotGreen: { backgroundColor: '#4caf50' },

  // ── Host: QR card ─────────────────────────────────────────────────────────
  qrCard: {
    alignSelf: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20,
    gap: 10,
    marginBottom: 16,
  },
  qrPlaceholder: {
    width: 160, height: 160,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    padding: 12,
  },
  qrPlaceholderText: { color: '#334', fontSize: 11, textAlign: 'center', lineHeight: 16 },
  qrHint: { color: '#445', fontSize: 11 },

  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  orLine: { flex: 1, height: 1, backgroundColor: '#111' },
  orText: { color: '#334', fontSize: 11, fontWeight: '600', letterSpacing: 1 },

  // ── Host: pairing code ────────────────────────────────────────────────────
  codeCard: {
    alignItems: 'center', gap: 6,
    padding: 20,
    backgroundColor: 'rgba(91,91,214,0.07)',
    borderWidth: 1, borderColor: 'rgba(91,91,214,0.15)',
    borderRadius: 16, marginBottom: 16,
  },
  codeLabel: { color: '#5b5bd6', fontSize: 9, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  codeValue: {
    fontSize: 44, fontWeight: '700', color: '#d0d0ff',
    letterSpacing: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  refreshBtn: { paddingVertical: 5, paddingHorizontal: 14, borderRadius: 100, borderWidth: 1, borderColor: '#2a2a50' },
  refreshText: { color: '#5b5bd6', fontSize: 11 },

  // ── Host: IP row ──────────────────────────────────────────────────────────
  ipRow: {
    flexDirection: 'row', alignItems: 'baseline', gap: 4,
    paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1, borderColor: '#111',
    borderRadius: 12, marginBottom: 16,
  },
  ipLabel: { color: '#334', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginRight: 6 },
  ipValue: {
    flex: 1, color: '#8888cc', fontSize: 16, fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    letterSpacing: 0.5,
  },
  ipPort: { color: '#5b5bd6', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },

  // ── Status card ───────────────────────────────────────────────────────────
  statusCard: {
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1, borderColor: '#111',
    borderRadius: 12,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { flex: 1, color: '#667', fontSize: 13 },
  rttPill: {
    paddingVertical: 2, paddingHorizontal: 8,
    backgroundColor: 'rgba(76,175,80,0.12)',
    borderRadius: 100,
    color: '#4caf50', fontSize: 11, fontWeight: '600',
  },

  // ── Controller: tab bar ───────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row', gap: 6,
    paddingVertical: 6,
    marginBottom: 4,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1, borderColor: '#111',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  tabActive: {
    borderColor: '#2a2a60',
    backgroundColor: 'rgba(91,91,214,0.1)',
  },
  tabIcon: { fontSize: 13 },
  tabLabel: { color: '#445', fontSize: 11, fontWeight: '600' },
  tabLabelActive: { color: '#9090d0' },

  // ── Tab content ───────────────────────────────────────────────────────────
  tabContent: { gap: 14, paddingTop: 4 },

  // ── Discover ──────────────────────────────────────────────────────────────
  discoverHeader: { flexDirection: 'row', alignItems: 'center', paddingTop: 4 },
  discoverScanText: { color: '#445', fontSize: 12 },

  emptyDiscover: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyDiscoverEmoji: { fontSize: 42 },
  emptyDiscoverTitle: { color: '#667', fontSize: 15, fontWeight: '500' },
  emptyDiscoverSub: { color: '#334', fontSize: 12, textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },

  hostList: { gap: 10 },
  hostListLabel: { color: '#445', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  hostCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14,
    backgroundColor: 'rgba(0,188,140,0.05)',
    borderWidth: 1, borderColor: 'rgba(0,188,140,0.2)',
    borderRadius: 14,
  },
  hostCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  hostCardName: { color: '#ccddcc', fontSize: 14, fontWeight: '600' },
  hostCardIp: { color: '#445', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },
  hostCardCode: { alignItems: 'center', gap: 1 },
  hostCardCodeLabel: { color: '#334', fontSize: 8, fontWeight: '700', letterSpacing: 1.2 },
  hostCardCodeValue: { color: '#00bc8c', fontSize: 14, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', letterSpacing: 2 },
  hostCardArrow: { color: '#00bc8c', fontSize: 16 },

  // ── QR scan ───────────────────────────────────────────────────────────────
  qrScanInstr: { color: '#445', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  cameraContainer: {
    height: 260, borderRadius: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: '#1a1a30',
  },
  camera: { flex: 1 },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  scanFrame: { width: 180, height: 180, position: 'relative' },
  scanCorner: { position: 'absolute', width: 22, height: 22, borderColor: '#5b5bd6' },
  scanTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 4 },
  scanTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 4 },
  scanBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 4 },
  scanBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 4 },
  scanError: { color: '#e53935', fontSize: 12, textAlign: 'center' },
  scanningRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  scanningText: { color: '#7c7cf0', fontSize: 12 },

  // ── Manual ────────────────────────────────────────────────────────────────
  manualInstr: { color: '#445', fontSize: 12, lineHeight: 18 },
  manualField: { gap: 7 },
  manualLabel: { color: '#334', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  manualInput: {
    backgroundColor: '#080814',
    borderWidth: 1, borderColor: '#1a1a30',
    borderRadius: 12, color: '#c0c0e0', fontSize: 18,
    paddingVertical: 12, paddingHorizontal: 16,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    letterSpacing: 1,
  },
  connectBtn: {
    backgroundColor: '#5b5bd6', paddingVertical: 14, borderRadius: 100,
    alignItems: 'center', marginTop: 6,
    shadowColor: '#5b5bd6', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
  connectBtnOff: { opacity: 0.45, shadowOpacity: 0 },
  connectBtnText: { color: '#fff', fontSize: 14, fontWeight: '600', letterSpacing: 0.5 },

  // ── Info box ──────────────────────────────────────────────────────────────
  infoBox: {
    backgroundColor: 'rgba(91,91,214,0.06)',
    borderWidth: 1, borderColor: 'rgba(91,91,214,0.15)',
    borderRadius: 12, padding: 14,
  },
  infoText: { color: '#667', fontSize: 12, lineHeight: 18 },
  infoEm: { color: '#9090d0', fontWeight: '600' },

  // ── Controller status bar ─────────────────────────────────────────────────
  ctrlStatus: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 8,
  },
  ctrlStatusInfo: { backgroundColor: 'rgba(91,91,214,0.06)', borderColor: 'rgba(91,91,214,0.2)' },
  ctrlStatusErr:  { backgroundColor: 'rgba(229,57,53,0.06)', borderColor: 'rgba(229,57,53,0.2)' },
  ctrlStatusText: { flex: 1, color: '#889', fontSize: 12 },

  // ── Navigating overlay ────────────────────────────────────────────────────
  navOverlay: {
    alignItems: 'center', justifyContent: 'center',
    gap: 12, paddingVertical: 28,
  },
  navText: { color: '#7c7cf0', fontSize: 14, fontWeight: '500' },
});
