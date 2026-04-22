import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Image,
} from 'react-native';

function CompleteScreen({ onClose }) {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onClose} activeOpacity={0.8} style={styles.closeBtn}>
        <Image
          source={require('../../../assets/red-cross.png')}
          style={styles.crossImage}
        />
      </TouchableOpacity>

      <View style={styles.icon}>
        <Text style={styles.iconText}>✓</Text>
      </View>

      <Text style={styles.title}>Test complete</Text>
      <Text style={styles.subtitle}>Please remove the headset</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  closeBtn: {
    position: 'absolute',
    top: 24,
    right: 24,
    zIndex: 20,
    padding: 8,
  },

  icon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4caf50',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(76,175,80,1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: Platform.OS === 'android' ? 12 : 0,
  },

  iconText: {
    fontSize: 28,
    color: '#ffffff',
    fontWeight: '700',
    lineHeight: 34,
  },

  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },

  subtitle: {
    color: '#cccccc',
    fontSize: 13,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  crossImage: {
    width: 20,
    height: 20,
  },
});

export default memo(CompleteScreen);