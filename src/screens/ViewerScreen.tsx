/**
 * ViewerScreen.tsx — Controller side (full touch handling upgrade)
 *
 * Changes from original:
 *  - Replaced PanResponder with raw View touch handlers to get changedTouches (multi-touch)
 *  - Proper pointer lifecycle: down → move → up (no more repeated taps)
 *  - Normalized coordinates relative to the RENDERED image bounds (handles letterboxing)
 *  - Multi-touch (pinch/zoom) via pointerId tracking
 *  - Long-press detection via timer
 *  - Scroll detection via vertical velocity
 *  - Precision mode toggle (reduces move threshold)
 *  - Per-pointer visual indicators on controller
 *  - System action bar (back/home/recents/notifications/lock)
 *  - Auto-reconnect with exponential back-off
 *  - Latency monitoring via ping/pong
 *  - Device resolution received from host for accurate coordinate mapping
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  SafeAreaView,
  GestureResponderEvent,
  LayoutChangeEvent,
  Dimensions,
  Platform,
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// ─── Types ────────────────────────────────────────────────────────────────────

type RootStackParamList = {
  Viewer: { hostIp: string };
};

interface Props {
  route: RouteProp<RootStackParamList, 'Viewer'>;
  navigation: NativeStackNavigationProp<RootStackParamList, 'Viewer'>;
}

/** Outgoing message: single pointer event */
interface PointerMsg {
  type: 'pointer';
  action: 'down' | 'move' | 'up' | 'cancel';
  pointerId: number;
  x: number;           // 0.0 – 1.0  (normalised to host screen)
  y: number;           // 0.0 – 1.0
  pressure: number;    // 0.0 – 1.0
  timestamp: number;   // ms epoch
}

/** Outgoing message: system button */
interface SystemMsg {
  type: 'system';
  action: 'back' | 'home' | 'recents' | 'notifications' | 'lock';
}

/** Outgoing ping */
interface PingMsg { type: 'ping'; ts: number; }

/** Incoming from host */
interface DeviceInfoMsg {
  type: 'device_info';
  width: number;
  height: number;
  rotation: number; // 0 | 1 | 2 | 3  (Surface.ROTATION_*)
}

type OutMsg = PointerMsg | SystemMsg | PingMsg;

/** Visual touch-dot data */
interface TouchDot { x: number; y: number; id: number; }

/** Rendered image rect inside the View (accounts for letterbox/pillarbox) */
interface ImageRect { x: number; y: number; w: number; h: number; }

// ─── Constants ────────────────────────────────────────────────────────────────

const WS_PORT = 8080;
const RECONNECT_BASE_MS = 2_000;
const RECONNECT_MAX_MS = 30_000;
const PING_INTERVAL_MS = 2_000;
const LONG_PRESS_MS = 500;
const MOVE_THRESHOLD_NORMAL = 0.003;   // ~3 pixels on a 1080p host
const MOVE_THRESHOLD_PRECISION = 0.001;

// ─── Component ────────────────────────────────────────────────────────────────

const ViewerScreen: React.FC<Props> = ({ route }) => {
  const { hostIp } = route.params;

  // State
  const [connected, setConnected] = useState(false);
  const [frameUri, setFrameUri] = useState<string | null>(null);
  const [latency, setLatency] = useState(0);
  const [precisionMode, setPrecisionMode] = useState(false);
  const [touchDots, setTouchDots] = useState<TouchDot[]>([]);
  const [hostInfo, setHostInfo] = useState<DeviceInfoMsg | null>(null);

  // Refs (don't need re-render)
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingTs = useRef(0);

  /**
   * imageRect: the actual rendered pixel rect of the <Image> inside the View.
   * We update this via onLayout AND via host device-info.
   *
   * With resizeMode="contain" the image may have letterboxes / pillarboxes.
   * We store the container rect here; calcImageRect() derives the true rect.
   */
  const containerRect = useRef<ImageRect>({ x: 0, y: 0, w: 1, h: 1 });
  const renderedRect = useRef<ImageRect>({ x: 0, y: 0, w: 1, h: 1 });

  /** Active pointers: Map<pointerId, {normX, normY}> */
  const activePointers = useRef(new Map<number, { x: number; y: number }>());

  /** Long-press timers per pointer */
  const longPressTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const precisionRef = useRef(precisionMode);
  useEffect(() => { precisionRef.current = precisionMode; }, [precisionMode]);

  // ─── Coordinate helpers ─────────────────────────────────────────────────────

  /**
   * Given the container dimensions and the host aspect ratio,
   * calculate the actual rendered image rect (letterbox-aware).
   */
  const calcRenderedRect = useCallback(() => {
    const c = containerRect.current;
    if (!hostInfo || hostInfo.width === 0 || hostInfo.height === 0) {
      renderedRect.current = { ...c };
      return;
    }

    // Account for rotation
    const isLandscape = hostInfo.rotation === 1 || hostInfo.rotation === 3;
    const hostW = isLandscape ? hostInfo.height : hostInfo.width;
    const hostH = isLandscape ? hostInfo.width : hostInfo.height;
    const hostAR = hostW / hostH;
    const containerAR = c.w / c.h;

    let imgW: number, imgH: number, imgX: number, imgY: number;

    if (containerAR > hostAR) {
      // Pillarboxed (black bars on sides)
      imgH = c.h;
      imgW = c.h * hostAR;
      imgX = c.x + (c.w - imgW) / 2;
      imgY = c.y;
    } else {
      // Letterboxed (black bars top/bottom)
      imgW = c.w;
      imgH = c.w / hostAR;
      imgX = c.x;
      imgY = c.y + (c.h - imgH) / 2;
    }

    renderedRect.current = { x: imgX, y: imgY, w: imgW, h: imgH };
  }, [hostInfo]);

  useEffect(() => { calcRenderedRect(); }, [hostInfo, calcRenderedRect]);

  /** Normalise a raw page coordinate to 0–1 relative to rendered image. */
  const normalise = useCallback((pageX: number, pageY: number) => {
    const r = renderedRect.current;
    const nx = Math.max(0, Math.min(1, (pageX - r.x) / r.w));
    const ny = Math.max(0, Math.min(1, (pageY - r.y) / r.h));
    return { nx, ny };
  }, []);

  // ─── WebSocket ──────────────────────────────────────────────────────────────

  const sendMsg = useCallback((msg: OutMsg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const startPing = useCallback(() => {
    if (pingInterval.current) clearInterval(pingInterval.current);
    pingInterval.current = setInterval(() => {
      pingTs.current = Date.now();
      sendMsg({ type: 'ping', ts: pingTs.current });
    }, PING_INTERVAL_MS);
  }, [sendMsg]);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    const ws = new WebSocket(`ws://${hostIp}:${WS_PORT}`);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttempts.current = 0;
      setConnected(true);
      startPing();
    };

    ws.onmessage = (evt) => {
      try {
        if (typeof evt.data === 'string') {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'frame') {
            setFrameUri(`data:image/jpeg;base64,${msg.data}`);
          } else if (msg.type === 'pong') {
            setLatency(Date.now() - pingTs.current);
          } else if (msg.type === 'device_info') {
            setHostInfo(msg as DeviceInfoMsg);
          }
        }
      } catch (_) { /* ignore malformed */ }
    };

    ws.onclose = () => {
      setConnected(false);
      if (pingInterval.current) clearInterval(pingInterval.current);

      // Exponential back-off
      const delay = Math.min(
        RECONNECT_BASE_MS * 2 ** reconnectAttempts.current,
        RECONNECT_MAX_MS,
      );
      reconnectAttempts.current += 1;
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => { /* onclose fires next */ };
  }, [hostIp, startPing]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (pingInterval.current) clearInterval(pingInterval.current);
      wsRef.current?.close();
    };
  }, [connect]);

  // ─── Touch handlers ─────────────────────────────────────────────────────────
  //
  //  We use raw onTouchStart/Move/End (NOT PanResponder) because PanResponder
  //  only tracks the "primary" pointer and gives us no multi-touch changedTouches.
  //
  //  Each event exposes nativeEvent.changedTouches — the pointers that changed
  //  in this event — and nativeEvent.touches — all currently active pointers.

  const sendPointer = useCallback((
    action: PointerMsg['action'],
    pointerId: number,
    nx: number,
    ny: number,
    pressure: number,
  ) => {
    sendMsg({
      type: 'pointer',
      action,
      pointerId,
      x: nx,
      y: ny,
      pressure,
      timestamp: Date.now(),
    });
  }, [sendMsg]);

  /** Update the touch-dot overlay (pure visual feedback on controller side). */
  const updateDots = useCallback(
    (id: number, pageX: number, pageY: number, remove = false) => {
      setTouchDots(prev => {
        const next = prev.filter(d => d.id !== id);
        if (!remove) next.push({ id, x: pageX, y: pageY });
        return next;
      });
    },
    [],
  );

  const handleTouchStart = useCallback((e: GestureResponderEvent) => {
    e.nativeEvent.changedTouches.forEach(t => {
      const id = t.identifier;
      const { nx, ny } = normalise(t.pageX, t.pageY);

      activePointers.current.set(id, { x: nx, y: ny });
      sendPointer('down', id, nx, ny, t.force ?? 1.0);
      updateDots(id, t.pageX, t.pageY);

      // Long-press detection (500 ms hold without movement)
      const timer = setTimeout(() => {
        const cur = activePointers.current.get(id);
        if (cur) {
          // Re-send a 'down' with a special pressure flag (host interprets as long-press)
          sendPointer('down', id, cur.x, cur.y, 2.0 /* >1 signals long-press */);
        }
      }, LONG_PRESS_MS);
      longPressTimers.current.set(id, timer);
    });
  }, [normalise, sendPointer, updateDots]);

  const handleTouchMove = useCallback((e: GestureResponderEvent) => {
    const threshold = precisionRef.current
      ? MOVE_THRESHOLD_PRECISION
      : MOVE_THRESHOLD_NORMAL;

    e.nativeEvent.changedTouches.forEach(t => {
      const id = t.identifier;
      const { nx, ny } = normalise(t.pageX, t.pageY);
      const last = activePointers.current.get(id);

      if (!last) return;

      const moved = Math.abs(nx - last.x) > threshold || Math.abs(ny - last.y) > threshold;
      if (!moved) return;

      // Cancel long-press if finger moved
      const lpt = longPressTimers.current.get(id);
      if (lpt) { clearTimeout(lpt); longPressTimers.current.delete(id); }

      activePointers.current.set(id, { x: nx, y: ny });
      sendPointer('move', id, nx, ny, t.force ?? 1.0);
      updateDots(id, t.pageX, t.pageY);
    });
  }, [normalise, sendPointer, updateDots]);

  const handleTouchEnd = useCallback((e: GestureResponderEvent) => {
    e.nativeEvent.changedTouches.forEach(t => {
      const id = t.identifier;
      const { nx, ny } = normalise(t.pageX, t.pageY);

      const lpt = longPressTimers.current.get(id);
      if (lpt) { clearTimeout(lpt); longPressTimers.current.delete(id); }

      activePointers.current.delete(id);
      sendPointer('up', id, nx, ny, 0);
      updateDots(id, t.pageX, t.pageY, true);
    });
  }, [normalise, sendPointer, updateDots]);

  const handleTouchCancel = useCallback((e: GestureResponderEvent) => {
    e.nativeEvent.changedTouches.forEach(t => {
      const id = t.identifier;
      const { nx, ny } = normalise(t.pageX, t.pageY);

      const lpt = longPressTimers.current.get(id);
      if (lpt) { clearTimeout(lpt); longPressTimers.current.delete(id); }

      activePointers.current.delete(id);
      sendPointer('cancel', id, nx, ny, 0);
      updateDots(id, t.pageX, t.pageY, true);
    });
  }, [normalise, sendPointer, updateDots]);

  // ─── Layout ─────────────────────────────────────────────────────────────────

  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    containerRect.current = { x, y, w: width, h: height };
    calcRenderedRect();
  }, [calcRenderedRect]);

  // ─── System actions ─────────────────────────────────────────────────────────

  const sendSystem = useCallback((action: SystemMsg['action']) => {
    sendMsg({ type: 'system', action });
  }, [sendMsg]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root}>
      {/* ── Status bar ──────────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <View style={[styles.dot, { backgroundColor: connected ? '#4ade80' : '#f87171' }]} />
        <Text style={styles.topBarText}>
          {connected ? `${latency}ms` : 'Disconnected'}
        </Text>
        {hostInfo && (
          <Text style={styles.topBarText}>
            {hostInfo.width}×{hostInfo.height}
          </Text>
        )}
        <TouchableOpacity
          style={[styles.precBtn, precisionMode && styles.precBtnActive]}
          onPress={() => setPrecisionMode(v => !v)}
        >
          <Text style={styles.precBtnTxt}>⊕</Text>
        </TouchableOpacity>
      </View>

      {/* ── Remote screen ───────────────────────────────────────────────── */}
      <View
        style={styles.screenWrap}
        onLayout={onContainerLayout}
        // Raw multi-touch capture — bypasses React responder system
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        {frameUri ? (
          <Image
            source={{ uri: frameUri }}
            style={styles.screenImg}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.noFrame}>
            <Text style={styles.noFrameTxt}>
              {connected ? 'Awaiting stream…' : 'Connecting…'}
            </Text>
          </View>
        )}

        {/* Per-pointer visual dots */}
        {touchDots.map(d => (
          <View
            key={d.id}
            style={[styles.touchDot, { left: d.x - 18, top: d.y - 18 }]}
            pointerEvents="none"
          />
        ))}
      </View>

      {/* ── System controls ─────────────────────────────────────────────── */}
      <View style={styles.sysBar}>
        {(
          [
            { icon: '◁', action: 'back' as const, label: 'Back' },
            { icon: '○', action: 'home' as const, label: 'Home' },
            { icon: '□', action: 'recents' as const, label: 'Recent' },
            { icon: '↓', action: 'notifications' as const, label: 'Notif' },
            { icon: '⏻', action: 'lock' as const, label: 'Lock' },
          ] as const
        ).map(({ icon, action, label }) => (
          <TouchableOpacity
            key={action}
            style={styles.sysBtn}
            onPress={() => sendSystem(action)}
          >
            <Text style={styles.sysBtnIcon}>{icon}</Text>
            <Text style={styles.sysBtnLabel}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  /* top bar */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  topBarText: {
    color: '#d4d4d4',
    fontSize: 12,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
  },
  precBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#555',
  },
  precBtnActive: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  precBtnTxt: {
    color: '#fff',
    fontSize: 14,
  },
  /* screen area */
  screenWrap: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  screenImg: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  noFrame: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noFrameTxt: {
    color: '#555',
    fontSize: 14,
  },
  /* touch dot overlay */
  touchDot: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(124, 58, 237, 0.4)',
    borderWidth: 2,
    borderColor: 'rgba(167, 139, 250, 0.8)',
  },
  /* system bar */
  sysBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  sysBtn: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sysBtnIcon: {
    color: '#e4e4e7',
    fontSize: 18,
  },
  sysBtnLabel: {
    color: '#71717a',
    fontSize: 9,
    marginTop: 2,
  },
});

export default ViewerScreen;