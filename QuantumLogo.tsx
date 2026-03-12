import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  interpolate,
} from "react-native-reanimated";

interface QuantumLogoProps {
  size?: number;
  intensity?: "low" | "medium" | "high" | "ultra";
  nucleusColor?: string;
  orbitColor?: string;
  electronColor?: string;
}

function Electron({ orbitAngle, size, delay, speed, electronColor, orbitRadius }: {
  orbitAngle: number;
  size: number;
  delay: number;
  speed: number;
  electronColor: string;
  orbitRadius: number;
}) {
  const progress = useSharedValue(0);
  const glow = useSharedValue(0.6);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: speed, easing: Easing.linear }), -1, false)
    );
    glow.value = withDelay(
      delay,
      withRepeat(withSequence(
        withTiming(1, { duration: speed / 3 }),
        withTiming(0.5, { duration: speed / 3 }),
        withTiming(0.8, { duration: speed / 3 }),
      ), -1, false)
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const angle = progress.value * Math.PI * 2;
    const cosOrbit = Math.cos(orbitAngle * Math.PI / 180);
    const sinOrbit = Math.sin(orbitAngle * Math.PI / 180);

    const x = Math.cos(angle) * orbitRadius;
    const y = Math.sin(angle) * orbitRadius * 0.38;

    const rotX = x * Math.cos(orbitAngle * Math.PI / 180) - y * Math.sin(orbitAngle * Math.PI / 180);
    const rotY = x * Math.sin(orbitAngle * Math.PI / 180) + y * Math.cos(orbitAngle * Math.PI / 180);

    return {
      transform: [
        { translateX: rotX },
        { translateY: rotY },
        { scale: interpolate(glow.value, [0.5, 1], [0.8, 1.2]) },
      ],
      opacity: glow.value,
    };
  });

  const electronSize = size * 0.08;

  return (
    <Animated.View style={[{
      position: "absolute",
      width: electronSize,
      height: electronSize,
      borderRadius: electronSize / 2,
      backgroundColor: electronColor,
      shadowColor: electronColor,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.9,
      shadowRadius: electronSize * 0.8,
      elevation: 8,
    }, animatedStyle]} />
  );
}

function OrbitRing({ angle, size, color, opacity }: { angle: number; size: number; color: string; opacity: number }) {
  return (
    <View style={[styles.orbitRing, {
      width: size * 0.85,
      height: size * 0.32,
      borderRadius: size * 0.42,
      borderWidth: 1.2,
      borderColor: color,
      opacity,
      transform: [{ rotate: `${angle}deg` }],
    }]} />
  );
}

export default function QuantumLogo({ size = 180, intensity = "medium", nucleusColor = "#FF6B35", orbitColor = "#00D4E8", electronColor = "#00D4E8" }: QuantumLogoProps) {
  const pulse = useSharedValue(1);
  const innerPulse = useSharedValue(0.8);

  const speeds: Record<string, number> = { low: 6000, medium: 4000, high: 2800, ultra: 1800 };
  const speed = speeds[intensity];

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.95, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ), -1, true
    );
    innerPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.6, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ), -1, true
    );
  }, []);

  const nucleusStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const innerGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(innerPulse.value, [0.6, 1], [0.4, 0.9]),
    transform: [{ scale: interpolate(innerPulse.value, [0.6, 1], [0.85, 1.1]) }],
  }));

  const nucleusSize = size * 0.22;
  const orbitRadius = size * 0.38;

  const electronAngles = [0, 60, 120];
  const electronDelays = [0, 400, 800];
  const electronCount = intensity === "ultra" ? 4 : intensity === "high" ? 3 : 2;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <OrbitRing angle={-30} size={size} color={orbitColor} opacity={0.3} />
      <OrbitRing angle={30} size={size} color={orbitColor} opacity={0.25} />
      <OrbitRing angle={90} size={size} color={orbitColor} opacity={0.2} />

      {electronAngles.slice(0, 3).map((angle, i) =>
        Array.from({ length: electronCount }).map((_, j) => (
          <Electron
            key={`e-${i}-${j}`}
            orbitAngle={angle === 0 ? -30 : angle === 60 ? 30 : 90}
            size={size}
            delay={electronDelays[i] + j * (speed / electronCount)}
            speed={speed}
            electronColor={electronColor}
            orbitRadius={orbitRadius}
          />
        ))
      )}

      <Animated.View style={[styles.nucleusOuter, {
        width: nucleusSize * 1.8,
        height: nucleusSize * 1.8,
        borderRadius: nucleusSize * 0.9,
        backgroundColor: `${nucleusColor}15`,
      }, innerGlowStyle]} />

      <Animated.View style={[styles.nucleus, {
        width: nucleusSize,
        height: nucleusSize,
        borderRadius: nucleusSize / 2,
        backgroundColor: nucleusColor,
        shadowColor: nucleusColor,
        shadowOpacity: 0.8,
        shadowRadius: nucleusSize * 0.6,
      }, nucleusStyle]}>
        <View style={[styles.nucleusInner, {
          width: nucleusSize * 0.55,
          height: nucleusSize * 0.55,
          borderRadius: nucleusSize * 0.275,
          backgroundColor: "#FFFFFF",
        }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  orbitRing: {
    position: "absolute",
  },
  nucleusOuter: {
    position: "absolute",
  },
  nucleus: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    elevation: 15,
  },
  nucleusInner: {
    opacity: 0.7,
  },
});
