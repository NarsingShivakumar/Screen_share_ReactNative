import React, { memo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

function LensCheckTarget({ panelWidth, panelHeight, side, active }) {
    if (!active) {
        return (
            <View style={[styles.panel, { width: panelWidth, height: panelHeight }]}>
                <View style={styles.occluder} />
            </View>
        );
    }

    return (
        <View style={[styles.panel, { width: panelWidth, height: panelHeight }]}>
            <View style={styles.targetWrap}>
                <Svg width={140} height={140} viewBox="0 0 200 200">
                    <Circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                    <Circle cx="100" cy="100" r="70" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
                    <Circle cx="100" cy="100" r="50" fill="none" stroke="rgba(255,255,255,0.40)" strokeWidth="1.5" />
                    <Circle cx="100" cy="100" r="30" fill="none" stroke="rgba(255,255,255,0.60)" strokeWidth="2" />
                    <Line x1="100" y1="10" x2="100" y2="190" stroke="rgba(255,255,255,0.30)" strokeWidth="0.8" />
                    <Line x1="10" y1="100" x2="190" y2="100" stroke="rgba(255,255,255,0.30)" strokeWidth="0.8" />
                    <Circle cx="100" cy="100" r="4" fill="#ffffff" />
                </Svg>

                <Text style={styles.title}>Lens Check</Text>
                <Text style={styles.sub}>
                    Adjust the headset until the circles look centered and sharp.
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    panel: {
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    targetWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    title: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.6,
    },
    sub: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 11,
        lineHeight: 16,
        textAlign: 'center',
        maxWidth: 220,
    },
    occluder: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
    },
});

export default memo(LensCheckTarget);