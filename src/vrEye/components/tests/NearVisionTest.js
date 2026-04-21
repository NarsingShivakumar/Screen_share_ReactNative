/**
 * NearVisionTest.js  v8.1
 *
 * Changes:
 * - White card fills full panel height/width
 * - Only optotype text animates
 * - Letter-only updates do not re-animate the background/card
 * - Animation runs only when sizeLevel changes
 */

import React, { memo, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import BlurredTestBackground from '../BlurredTestBackground';

// getNearFontSize(i) { return [39, 29, 23, 16, 13, 8][i] ?? 8; }
const NEAR_FONT_SIZES = [39, 29, 23, 16, 13, 8];
const getNearFontSize = (sizeLevel) =>
  NEAR_FONT_SIZES[sizeLevel] ?? NEAR_FONT_SIZES[NEAR_FONT_SIZES.length - 1];

const SPRING_CONFIG = { tension: 180, friction: 9, useNativeDriver: true };
const FADE_DURATION = 150;

function NearVisionTest({ nearOptotype, panelWidth, panelHeight, parallax }) {
  console.log("nearOptotype", nearOptotype)
  const dim = Dimensions.get('window');
  const screenW = Math.max(dim.width, dim.height);
  const screenH = Math.min(dim.width, dim.height);

  const PW = panelWidth ?? screenW / 2;
  const PH = panelHeight ?? screenH;

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const prevLevel = useRef(null);
  const runningAnim = useRef(null);

  const hasOptotype = !!(nearOptotype && nearOptotype.letter);
  const normalizedOptotype = useMemo(() => {
    if (nearOptotype?.acuityLabel === "6/10") {
      return {
        letter: 'E',
        sizeLevel: 0,
        acuityLabel: 'N24',
      };
    }
    return nearOptotype;
  }, [nearOptotype]);
  const sizeLevel = nearOptotype?.sizeLevel ?? 2;
  const letter = nearOptotype?.letter ?? '';
  const acuityLabel = normalizedOptotype?.acuityLabel ?? ''; const fontSize = getNearFontSize(sizeLevel);
  const fgOffset = useMemo(() => parallax?.fg ?? { x: 0, y: 0 }, [parallax]);


  useEffect(() => {
    if (!hasOptotype) {
      if (runningAnim.current) {
        runningAnim.current.stop();
        runningAnim.current = null;
      }

      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }).start();

      prevLevel.current = null;
      return;
    }

    const currentLevel = sizeLevel;
    const prev = prevLevel.current;

    // First visible render: show without animation
    if (prev == null) {
      prevLevel.current = currentLevel;
      scaleAnim.setValue(1);
      opacityAnim.setValue(1);
      return;
    }

    // Only animate when sizeLevel changes
    if (currentLevel === prev) {
      return;
    }

    if (runningAnim.current) {
      runningAnim.current.stop();
      runningAnim.current = null;
    }

    const zoomIn = currentLevel < prev; // lower index = bigger letter
    prevLevel.current = currentLevel;

    opacityAnim.setValue(0);
    scaleAnim.setValue(zoomIn ? 0.5 : 1.6);

    runningAnim.current = Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        ...SPRING_CONFIG,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: FADE_DURATION,
        useNativeDriver: true,
      }),
    ]);

    runningAnim.current.start(({ finished }) => {
      if (finished) runningAnim.current = null;
    });
  }, [hasOptotype, sizeLevel, opacityAnim, scaleAnim]);

  if (!hasOptotype) {
    return (
      <View style={[styles.panel, { width: PW, height: PH }]}>
        <BlurredTestBackground panelWidth={PW} panelHeight={PH} />
        <View style={styles.fixCrossWrap}>
          <View style={styles.fixH} />
          <View style={styles.fixV} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.panel, { width: PW, height: PH }]}>
      {/* Keep background disabled if not needed */}
      {/* <BlurredTestBackground panelWidth={PW} panelHeight={PH} /> */}

      <View style={styles.cardWrap}>
        <View
          style={[
            styles.nearCard,
            {
              width: PW,
              height: PH,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} allowFontScaling={false}>
              NEAR VISION
            </Text>

            <Text style={styles.cardDist} allowFontScaling={false}>
              33 cm
            </Text>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.nearLine}>
            <Text style={styles.nearLabel} allowFontScaling={false}>
              {acuityLabel}
            </Text>

            <Animated.View
              style={{
                opacity: opacityAnim,
                transform: [
                  { scale: scaleAnim },
                  { translateX: fgOffset.x },
                  { translateY: fgOffset.y },
                ],
              }}
            >
              <Text
                style={[
                  styles.nearText,
                  {
                    fontSize,
                    lineHeight: fontSize * 1.2,
                    letterSpacing: Math.max(fontSize * 0.08, 1),
                  },
                ]}
                allowFontScaling={false}
                numberOfLines={1}
                adjustsFontSizeToFit={false}
              >
                {letter}
              </Text>
            </Animated.View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },

  cardWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },

  nearCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#ffffff',
    borderRadius: 0,
    overflow: 'hidden',
    flexDirection: 'column',
    zIndex: 2,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 6,
    flexShrink: 0,
  },

  cardTitle: {
    fontSize: 7,
    fontFamily: 'Helvetica Neue',
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#aaaaaa',
  },

  cardDist: {
    fontSize: 7,
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    color: '#cccccc',
  },

  cardDivider: {
    height: 1,
    backgroundColor: '#dddddd',
    flexShrink: 0,
  },

  nearLine: {
    flex: 1,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    overflow: 'hidden',
  },

  nearLabel: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    fontSize: 6,
    fontFamily: 'Helvetica Neue',
    fontWeight: '700',
    letterSpacing: 0.2,
    color: '#cccccc',
    lineHeight: 8,
  },

  nearText: {
    color: '#111111',
    fontFamily: 'CourierPrime-Regular',
    fontWeight: '900',
    textAlign: 'center',
    textTransform: 'uppercase',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },

  fixCrossWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  fixH: {
    position: 'absolute',
    width: 24,
    height: 1,
    backgroundColor: '#1a1a1a',
  },

  fixV: {
    position: 'absolute',
    width: 1,
    height: 24,
    backgroundColor: '#1a1a1a',
  },
});

export default memo(NearVisionTest, (prev, next) => {
  const prevOpt = prev.nearOptotype;
  const nextOpt = next.nearOptotype;

  return (
    prev.panelWidth === next.panelWidth &&
    prev.panelHeight === next.panelHeight &&
    (prev.parallax?.fg?.x ?? 0) === (next.parallax?.fg?.x ?? 0) &&
    (prev.parallax?.fg?.y ?? 0) === (next.parallax?.fg?.y ?? 0) &&
    (prevOpt?.letter ?? '') === (nextOpt?.letter ?? '') &&
    (prevOpt?.sizeLevel ?? 2) === (nextOpt?.sizeLevel ?? 2) &&
    (prevOpt?.acuityLabel ?? '') === (nextOpt?.acuityLabel ?? '')
  );
});