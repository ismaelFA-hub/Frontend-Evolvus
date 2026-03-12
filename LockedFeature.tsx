import React, { useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  StyleProp,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";

const C = Colors.dark;

type PlanType = "free" | "pro" | "premium" | "enterprise" | "admin";

const PLAN_ORDER: PlanType[] = ["free", "pro", "premium", "enterprise", "admin"];

export function planGte(userPlan: PlanType, required: PlanType): boolean {
  if (userPlan === "admin") return true;
  return PLAN_ORDER.indexOf(userPlan) >= PLAN_ORDER.indexOf(required);
}

const PLAN_LABEL: Record<PlanType, string> = {
  free: "Free",
  pro: "Pro",
  premium: "Premium",
  enterprise: "Enterprise",
  admin: "Admin",
};

const PLAN_COLOR: Record<PlanType, string> = {
  free: "#6B7280",
  pro: "#3B82F6",
  premium: "#A855F7",
  enterprise: "#F59E0B",
  admin: "#00D4E8",
};

interface LockedFeatureProps {
  userPlan?: PlanType;
  requiredPlan: PlanType;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  label?: string;
}

export default function LockedFeature({
  requiredPlan,
  children,
  style,
  label,
}: LockedFeatureProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const { planType } = usePlanTheme();
  const effectivePlan = planType as PlanType;

  if (planGte(effectivePlan, requiredPlan)) {
    return <View style={style}>{children}</View>;
  }

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(() => router.push(`/plan-upgrade?required=${requiredPlan}`));
  }

  const planColor = PLAN_COLOR[requiredPlan];
  const planName = PLAN_LABEL[requiredPlan];

  return (
    <Pressable onPress={handlePress} style={style}>
      <Animated.View style={[s.container, { transform: [{ scale }] }]}>
        <View style={s.blurred} pointerEvents="none">
          {children}
        </View>
        <View style={s.overlay}>
          <View style={[s.badge, { backgroundColor: planColor + "22", borderColor: planColor + "66" }]}>
            <Ionicons name="lock-closed" size={14} color={planColor} />
            <Text style={[s.badgeText, { color: planColor }]}>
              {label ?? `Disponível no plano ${planName}`}
            </Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  container: {
    position: "relative",
  },
  blurred: {
    opacity: 0.3,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,14,23,0.45)",
    borderRadius: 14,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
});
