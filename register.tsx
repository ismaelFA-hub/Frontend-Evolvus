import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Platform, ActivityIndicator, KeyboardAvoidingView, ScrollView, Modal } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth, PlanType } from "@/lib/auth-context";
import { useI18n, LANGUAGES } from "@/lib/i18n-context";
import { PLAN_FEATURES } from "@/lib/market-data";
import QuantumLogo from "@/components/QuantumLogo";
import PlanDetailSheet from "@/components/PlanDetailSheet";

const C = Colors.dark;

function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 4, overflow: 'hidden' }}>
      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap' }}>
        <View style={{ width: size / 2, height: size / 2, backgroundColor: '#EA4335' }} />
        <View style={{ width: size / 2, height: size / 2, backgroundColor: '#4285F4' }} />
        <View style={{ width: size / 2, height: size / 2, backgroundColor: '#34A853' }} />
        <View style={{ width: size / 2, height: size / 2, backgroundColor: '#FBBC05' }} />
      </View>
      <Text style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, textAlign: 'center', lineHeight: size, fontSize: size * 0.68, fontFamily: 'Inter_700Bold', color: '#fff' }}>G</Text>
    </View>
  );
}

const PLAN_QUANTUM: Record<PlanType, {
  intensity: "low" | "medium" | "high" | "ultra";
  nucleusColor: string;
  orbitColor: string;
  electronColor: string;
}> = {
  free: { intensity: "low", nucleusColor: "#6B7A99", orbitColor: "#4A5568", electronColor: "#718096" },
  pro: { intensity: "medium", nucleusColor: "#00D4AA", orbitColor: "#00B894", electronColor: "#00D4AA" },
  premium: { intensity: "high", nucleusColor: "#7B61FF", orbitColor: "#9B59B6", electronColor: "#A78BFA" },
  enterprise: { intensity: "ultra", nucleusColor: "#FFB74D", orbitColor: "#F59E0B", electronColor: "#FBBF24" },
};

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("free");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailPlan, setDetailPlan] = useState<PlanType | null>(null);
  const [showLangPicker, setShowLangPicker] = useState(false);

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  async function handleGoogleSignUp() {
    import("react-native").then(({ Alert }) => {
      Alert.alert(
        "Google Sign In",
        "Para ativar o cadastro com Google, configure as credenciais OAuth no painel de administração.\n\nCrie sua conta com email e senha por enquanto.",
        [{ text: "OK", style: "default" }]
      );
    });
  }

  async function handleRegister() {
    if (!email.trim() || !username.trim() || !password.trim()) {
      setError(t('fillAllFields') || "Please fill in all fields");
      return;
    }
    if (password !== confirmPassword) {
      setError(t('passwordsMismatch') || "Passwords don't match");
      return;
    }
    if (password.length < 6) {
      setError(t('passwordMinLength') || "Password must be at least 6 characters");
      return;
    }
    setError("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const success = await register(email.trim(), username.trim(), password, selectedPlan);
    setLoading(false);
    if (success) {
      router.replace("/(auth)/verify-email-prompt");
    } else {
      setError(t('emailAlreadyRegistered') || "Email already registered. Try logging in.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  const plans: PlanType[] = ['free', 'pro', 'premium', 'enterprise'];
  const currentLang = LANGUAGES.find(l => l.code === language);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.background }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + webTopInset + 20, paddingBottom: insets.bottom + webBottomInset + 20 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={C.text} />
          </Pressable>
          <Pressable
            onPress={() => { setShowLangPicker(true); Haptics.selectionAsync(); }}
            style={styles.langButton}
            testID="language-selector"
          >
            <Ionicons name="globe-outline" size={20} color="#00D4E8" />
            <Text style={styles.langButtonText}>{currentLang?.code.toUpperCase()}</Text>
            <Ionicons name="chevron-down" size={14} color={C.textTertiary} />
          </Pressable>
        </View>

        <Text style={styles.title}>{t('createAccount')}</Text>
        <Text style={styles.subtitle}>{t('autonomousTrading')}</Text>

        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={C.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.inputContainer}>
          <Ionicons name="person-outline" size={20} color={C.textTertiary} style={styles.inputIcon} />
          <TextInput style={styles.input} placeholder={t('username')} placeholderTextColor={C.textTertiary} value={username} onChangeText={setUsername} autoCapitalize="none" />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="mail-outline" size={20} color={C.textTertiary} style={styles.inputIcon} />
          <TextInput style={styles.input} placeholder={t('email')} placeholderTextColor={C.textTertiary} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color={C.textTertiary} style={styles.inputIcon} />
          <TextInput style={styles.input} placeholder={t('password')} placeholderTextColor={C.textTertiary} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
          <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
            <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={C.textTertiary} />
          </Pressable>
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="shield-checkmark-outline" size={20} color={C.textTertiary} style={styles.inputIcon} />
          <TextInput style={styles.input} placeholder={t('confirmPassword')} placeholderTextColor={C.textTertiary} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showPassword} />
        </View>

        <Text style={styles.planLabel}>{t('selectYourPlan')}</Text>
        <View style={styles.plansGrid}>
          {plans.map((plan) => {
            const info = PLAN_FEATURES[plan];
            const quantum = PLAN_QUANTUM[plan];
            const isSelected = selectedPlan === plan;
            const translatedFeatures = info.featureKeys.map((key: string) => t(key as any));
            return (
              <Pressable
                key={plan}
                style={[styles.planCard, isSelected && { borderColor: info.color, backgroundColor: `${info.color}08` }]}
                onPress={() => { setSelectedPlan(plan); Haptics.selectionAsync(); }}
              >
                <View style={styles.planCardContent}>
                  <QuantumLogo
                    size={56}
                    intensity={quantum.intensity}
                    nucleusColor={quantum.nucleusColor}
                    orbitColor={quantum.orbitColor}
                    electronColor={quantum.electronColor}
                  />
                  <Text style={[styles.planName, isSelected && { color: info.color }]}>{t(plan as any)}</Text>
                  <Text style={styles.planPrice}>{info.price}</Text>
                  {translatedFeatures.slice(0, 2).map((feat: string, i: number) => (
                    <View key={i} style={styles.miniFeatureRow}>
                      <Ionicons name="checkmark" size={10} color={info.color} />
                      <Text style={styles.miniFeatureText} numberOfLines={1}>{feat}</Text>
                    </View>
                  ))}
                </View>
                <Pressable
                  style={[styles.detailsBtn, { borderColor: `${info.color}30` }]}
                  onPress={() => { setDetailPlan(plan); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  hitSlop={8}
                >
                  <Text style={[styles.detailsBtnText, { color: info.color }]}>{t('viewDetails')}</Text>
                  <Ionicons name="chevron-forward" size={12} color={info.color} />
                </Pressable>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={({ pressed }) => [styles.registerButton, { opacity: pressed ? 0.85 : 1 }]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.registerButtonText}>{t('createAccount')}</Text>
          )}
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable
          style={({ pressed }) => [styles.googleButton, { opacity: pressed ? 0.85 : 1 }]}
          onPress={handleGoogleSignUp}
          accessibilityRole="button"
        >
          <GoogleIcon size={22} />
          <Text style={styles.googleButtonText}>Cadastrar com Google</Text>
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('alreadyHaveAccount')}</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.footerLink}>{t('signIn')}</Text>
          </Pressable>
        </View>
      </ScrollView>

      {detailPlan && (
        <PlanDetailSheet
          plan={detailPlan}
          onClose={() => setDetailPlan(null)}
          onSelect={(p) => { setSelectedPlan(p); setDetailPlan(null); }}
        />
      )}

      <Modal visible={showLangPicker} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowLangPicker(false)}>
          <View style={styles.langModal}>
            <View style={styles.langModalHeader}>
              <Text style={styles.langModalTitle}>{t('language')}</Text>
              <Pressable onPress={() => setShowLangPicker(false)}>
                <Ionicons name="close" size={22} color={C.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {LANGUAGES.map((lang) => (
                <Pressable
                  key={lang.code}
                  style={[styles.langOption, language === lang.code && styles.langOptionActive]}
                  onPress={() => {
                    setLanguage(lang.code);
                    setShowLangPicker(false);
                    Haptics.selectionAsync();
                  }}
                >
                  <Text style={[styles.langOptionText, language === lang.code && styles.langOptionTextActive]}>
                    {lang.nativeName}
                  </Text>
                  <Text style={styles.langOptionCode}>{lang.code.toUpperCase()}</Text>
                  {language === lang.code && <Ionicons name="checkmark-circle" size={20} color="#00D4E8" />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    gap: 14,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
  },
  langButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  langButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#00D4E8",
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: C.text,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: C.textSecondary,
    marginBottom: 8,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.dangerDim,
    padding: 12,
    borderRadius: 12,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: C.danger,
    flex: 1,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  inputIcon: {
    paddingLeft: 16,
  },
  input: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: C.text,
    padding: 16,
    paddingLeft: 12,
  },
  eyeButton: {
    padding: 16,
  },
  planLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: C.text,
    marginTop: 8,
  },
  plansGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  planCard: {
    width: "48%",
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 14,
    gap: 8,
  },
  planCardContent: {
    alignItems: "center",
    gap: 6,
  },
  planName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: C.text,
  },
  planPrice: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: C.textSecondary,
  },
  miniFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 4,
  },
  miniFeatureText: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: C.textTertiary,
    flex: 1,
  },
  detailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  detailsBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
  registerButton: {
    backgroundColor: C.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  registerButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#0A0E17",
  },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textTertiary },
  googleButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: C.surface, borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderColor: C.border },
  googleButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  footerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.textSecondary,
  },
  footerLink: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: C.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  langModal: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxWidth: 340,
    borderWidth: 1,
    borderColor: C.border,
  },
  langModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  langModalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: C.text,
  },
  langOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 10,
    marginBottom: 2,
  },
  langOptionActive: {
    backgroundColor: "rgba(0,212,232,0.08)",
  },
  langOptionText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: C.text,
    flex: 1,
  },
  langOptionTextActive: {
    color: "#00D4E8",
  },
  langOptionCode: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: C.textTertiary,
    width: 28,
  },
});
