import { useEffect } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
  interpolate,
} from "react-native-reanimated";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";

const C = Colors.dark;
const { width } = Dimensions.get("window");

export default function SplashIntroScreen() {
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.5);
  const titleOpacity = useSharedValue(0);
  const titleTranslate = useSharedValue(20);
  const subtitleOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const titleGlow = useSharedValue(0);
  const containerOpacity = useSharedValue(1);

  function navigateAway() {
    if (isAuthenticated) {
      router.replace("/(tabs)");
    } else {
      router.replace("/(auth)/login");
    }
  }

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.ease) });
    logoScale.value = withTiming(1, { duration: 1000, easing: Easing.out(Easing.back(1.2)) });

    titleOpacity.value = withDelay(600, withTiming(1, { duration: 800 }));
    titleTranslate.value = withDelay(600, withTiming(0, { duration: 800, easing: Easing.out(Easing.ease) }));

    subtitleOpacity.value = withDelay(1000, withTiming(1, { duration: 800 }));
    taglineOpacity.value = withDelay(1400, withTiming(1, { duration: 800 }));

    titleGlow.value = withDelay(1200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        ), -1, true
      )
    );

    const timer = setTimeout(() => {
      containerOpacity.value = withTiming(0, { duration: 600 }, (finished) => {
        if (finished) runOnJS(navigateAway)();
      });
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  const logoAnimStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslate.value }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const titleGlowStyle = useAnimatedStyle(() => ({
    textShadowRadius: interpolate(titleGlow.value, [0.3, 1], [2, 15]),
    opacity: interpolate(titleGlow.value, [0.3, 1], [0.7, 1]),
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <View style={styles.bgGlow1} />
      <View style={styles.bgGlow2} />

      <Animated.View style={[styles.logoWrapper, logoAnimStyle]}>
        <Image
          source={require("../assets/images/logo-v8-realistic-neural.png")}
          style={{ width: 220, height: 220 }}
          contentFit="contain"
          cachePolicy="memory-disk"
          // No transition: the parent Animated.View handles the entrance animation
          transition={0}
          priority="high"
          testID="splash-logo"
        />
      </Animated.View>

      <View style={styles.textContainer}>
        <Animated.View style={titleStyle}>
          <Animated.Text style={[styles.titleMain, titleGlowStyle]}>
            EVOLVUS CORE
          </Animated.Text>
        </Animated.View>

        <Animated.View style={subtitleStyle}>
          <Animated.Text style={[styles.titleQuantum, titleGlowStyle]}>
            QUANTUM
          </Animated.Text>
        </Animated.View>

        <Animated.Text style={[styles.tagline, taglineStyle]}>
          {t('autonomousTrading')}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050810",
    alignItems: "center",
    justifyContent: "center",
  },
  bgGlow1: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(255, 107, 53, 0.06)",
    top: "25%",
  },
  bgGlow2: {
    position: "absolute",
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: "rgba(0, 212, 232, 0.04)",
    top: "20%",
  },
  logoWrapper: {
    marginBottom: 40,
  },
  textContainer: {
    alignItems: "center",
    gap: 4,
  },
  titleMain: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    color: "#FF8C5A",
    letterSpacing: 6,
    textShadowColor: "#FF6B35",
    textShadowOffset: { width: 0, height: 0 },
  },
  titleQuantum: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#00D4E8",
    letterSpacing: 12,
    textShadowColor: "#00D4E8",
    textShadowOffset: { width: 0, height: 0 },
  },
  tagline: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.4)",
    letterSpacing: 2,
    marginTop: 12,
  },
});
