import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { color, mono, sans, serif, space } from '../theme/tokens';
import { useStore } from '../state/provider';

// Keep native splash active until our animated splash component is mounted
void ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

interface SplashProps {
  children: React.ReactNode;
}

export function AnimatedSplash({ children }: SplashProps) {
  const { ready } = useStore();
  const [splashVisible, setSplashVisible] = useState(true);

  // Entrance animations
  const logoScale = useRef(new Animated.Value(0.92)).current;
  const logoOpacity = useRef(new Animated.Value(0.2)).current;
  const motionOpacity = useRef(new Animated.Value(0)).current;
  const motionTranslateY = useRef(new Animated.Value(14)).current;
  const lineWidth = useRef(new Animated.Value(0)).current;

  // Continuous ambient motion
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Exit animation
  const exitOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Hide native splash screen now that animated React tree is mounted
    void ExpoSplashScreen.hideAsync().catch(() => {});

    // 1. Entrance choreography
    Animated.parallel([
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(250),
        Animated.parallel([
          Animated.timing(motionOpacity, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(motionTranslateY, {
            toValue: 0,
            duration: 600,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(lineWidth, {
            toValue: 40,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }),
        ]),
      ]),
    ]).start(() => {
      // 2. Start continuous ambient breathing loop on the brand motion
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.04,
            duration: 1100,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1100,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    });
  }, [lineWidth, logoOpacity, logoScale, motionOpacity, motionTranslateY, pulseAnim]);

  // Handle dismissal once the store is ready and minimum display time elapsed
  useEffect(() => {
    if (!ready) return;

    const timer = setTimeout(() => {
      Animated.timing(exitOpacity, {
        toValue: 0,
        duration: 380,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setSplashVisible(false);
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [exitOpacity, ready]);

  return (
    <View style={styles.host}>
      {children}
      {splashVisible ? (
        <Animated.View
          pointerEvents={ready ? 'none' : 'auto'}
          style={[styles.splashOverlay, { opacity: exitOpacity }]}
        >
          <View style={styles.centerContent}>
            {/* Splash Icon Logo */}
            <Animated.View
              style={[
                styles.logoWrap,
                {
                  opacity: logoOpacity,
                  transform: [{ scale: logoScale }],
                },
              ]}
            >
              <Image
                source={require('../../assets/splash-icon.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </Animated.View>

            {/* Motion Below the Logo */}
            <Animated.View
              style={[
                styles.motionWrap,
                {
                  opacity: motionOpacity,
                  transform: [
                    { translateY: motionTranslateY },
                    { scale: pulseAnim },
                  ],
                },
              ]}
            >
              <Animated.View style={[styles.accentLine, { width: lineWidth }]} />
              <View style={styles.captionRow}>
                <Text style={styles.poweredBy}>POWERED BY</Text>
                <Text style={styles.brandName}>Ayewar</Text>
              </View>
            </Animated.View>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: color.paper,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    width: 136,
    height: 136,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 136,
    height: 136,
  },
  motionWrap: {
    marginTop: space.lg,
    alignItems: 'center',
  },
  accentLine: {
    height: 1.5,
    backgroundColor: color.rust,
    marginBottom: space.sm,
    borderRadius: 1,
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.xs + 2,
  },
  poweredBy: {
    fontFamily: mono,
    fontSize: 9.5,
    letterSpacing: 2,
    color: color.inkFaint,
  },
  brandName: {
    fontFamily: serif,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: color.rust,
  },
});
