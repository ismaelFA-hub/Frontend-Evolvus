import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Platform, ActivityIndicator, KeyboardAvoidingView, ScrollView, Modal } from "react-native";
import { Image } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";
import { useI18n, LANGUAGES } from "@/lib/i18n-context";
import { ONBOARDING_KEY } from "@/app/onboarding";

const C = Colors.dark;

const LANG_FLAGS: Record<string, string> = {
  en: '🇺🇸', pt: '🇧🇷', es: '🇪🇸', fr: '🇫🇷', de: '🇩🇪',
  zh: '🇨🇳', ja: '🇯🇵', ko: '🇰🇷', ru: '🇷🇺', ar: '🇸🇦', it: '🇮🇹',
};

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

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [logoTapCount, setLogoTapCount] = useState(0);
  const [showMasterKey, setShowMasterKey] = useState(false);
  const [masterKey, setMasterKey] = useState("");

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  const currentLang = LANGUAGES.find(l => l.code === language);

  async function handleGoogleSignIn() {
    Haptics.selectionAsync();
    import("react-native").then(({ Alert }) => {
      Alert.alert(
        "Google Sign In",
        "Para ativar o login com Google, configure as credenciais OAuth no painel de administração.\n\nEntre com seu email e senha por enquanto.",
        [{ text: "OK", style: "default" }]
      );
    });
  }

  function handleLogoTap() {
    const next = logoTapCount + 1;
    setLogoTapCount(next);
    if (next >= 7 && !showMasterKey) {
      setShowMasterKey(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError(t('fillAllFields') || "Preencha todos os campos");
      return;
    }
    setError("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const success = await login(email.trim(), password, showMasterKey && masterKey.trim() ? masterKey.trim() : undefined);
    setLoading(false);
    if (success) {
      const onboardingDone = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (!onboardingDone) {
        router.replace("/onboarding");
      } else {
        router.replace("/(tabs)");
      }
    } else {
      setError(t('invalidCredentials') || "Credenciais inválidas. Tente novamente.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + webTopInset + 8, paddingBottom: insets.bottom + webBottomInset + 24 }]}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            style={styles.langButton}
            onPress={() => { setShowLangPicker(true); Haptics.selectionAsync(); }}
            testID="language-selector"
          >
            <Text style={styles.langFlag}>{LANG_FLAGS[language] || '🌐'}</Text>
            <Text style={styles.langButtonText}>{currentLang?.nativeName || language.toUpperCase()}</Text>
            <Ionicons name="chevron-down" size={14} color={C.textTertiary} />
          </Pressable>

          <View style={styles.logoSection}>
            <Pressable onPress={handleLogoTap} hitSlop={20}>
              <Image
                source={require("../../assets/images/logo-3d.gif")}
                style={{ width: 203, height: 203 }}
                contentFit="contain"
                cachePolicy="none"
                testID="login-logo"
              />
            </Pressable>
            <Text style={styles.logoTitle}>Evolvus Core</Text>
            <Text style={styles.logoSubtitle}>Quantum</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('signIn')}</Text>
            <Text style={styles.cardSubtitle}>Bem-vindo de volta</Text>

            {!!error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={C.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('email')}</Text>
              <TextInput
                style={styles.input}
                placeholder="seu@email.com"
                placeholderTextColor={C.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={t('email')}
                testID="login-email-input"
              />
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>{t('password')}</Text>
                <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
                  <Text style={styles.forgotLink}>Esqueceu a senha?</Text>
                </Pressable>
              </View>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, { flex: 1, borderWidth: 0, padding: 0 }]}
                  placeholder="••••••••"
                  placeholderTextColor={C.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  testID="login-password-input"
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={C.textTertiary} />
                </Pressable>
              </View>
            </View>

            {showMasterKey && (
              <View style={styles.fieldGroup}>
                <View style={[styles.fieldLabelRow, { alignItems: 'center' }]}>
                  <Ionicons name="key-outline" size={13} color="#00D4E8" />
                  <Text style={[styles.fieldLabel, { color: "#00D4E8", marginLeft: 4 }]}>Chave de Acesso</Text>
                </View>
                <TextInput
                  style={[styles.input, { borderColor: '#00D4E840' }]}
                  placeholder="••••••••••••"
                  placeholderTextColor={C.textTertiary}
                  value={masterKey}
                  onChangeText={setMasterKey}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            )}

            <Pressable
              style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.88 : 1 }]}
              onPress={handleLogin}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={t('signIn')}
              testID="login-submit-btn"
            >
              {loading
                ? <ActivityIndicator color="#0A0E17" />
                : <Text style={styles.primaryBtnText}>{t('signIn')}</Text>}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              style={({ pressed }) => [styles.googleBtn, { opacity: pressed ? 0.88 : 1 }]}
              onPress={handleGoogleSignIn}
              testID="google-signin-btn"
            >
              <GoogleIcon size={22} />
              <Text style={styles.googleBtnText}>Entrar com Google</Text>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('dontHaveAccount')}</Text>
            <Pressable onPress={() => router.push("/(auth)/register")}>
              <Text style={styles.footerLink}>{t('createAccount')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showLangPicker} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowLangPicker(false)}>
          <View style={styles.langModal}>
            <View style={styles.langModalHeader}>
              <Text style={styles.langModalTitle}>{t('language') || 'Idioma'}</Text>
              <Pressable onPress={() => setShowLangPicker(false)}>
                <Ionicons name="close" size={22} color={C.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {LANGUAGES.map((lang) => (
                <Pressable
                  key={lang.code}
                  style={[styles.langOption, language === lang.code && styles.langOptionActive]}
                  onPress={() => { setLanguage(lang.code); setShowLangPicker(false); Haptics.selectionAsync(); }}
                >
                  <Text style={styles.langOptionText}>{LANG_FLAGS[lang.code] || '🌐'} {lang.nativeName}</Text>
                  {language === lang.code && <Ionicons name="checkmark" size={18} color={C.success} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
  },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    backgroundColor: C.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 8,
  },
  langFlag: { fontSize: 16 },
  langButtonText: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.text },
  logoSection: {
    alignItems: "center",
    gap: 6,
    marginBottom: 28,
  },
  logoTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: C.text,
    letterSpacing: 1,
    marginTop: 4,
  },
  logoSubtitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#00D4E8",
    letterSpacing: 4,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: C.border,
    gap: 18,
  },
  cardTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: C.text,
  },
  cardSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.textSecondary,
    marginTop: -10,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.dangerDim,
    padding: 12,
    borderRadius: 10,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: C.danger,
    flex: 1,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: C.textSecondary,
  },
  forgotLink: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#00D4E8",
  },
  input: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: C.text,
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
  },
  eyeBtn: {
    paddingVertical: 14,
    paddingLeft: 10,
  },
  primaryBtn: {
    backgroundColor: "#00D4E8",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 2,
  },
  primaryBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#0A0E17",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  dividerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: C.textTertiary,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: C.surface,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  googleBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: C.text,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 28,
  },
  footerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.textSecondary,
  },
  footerLink: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#00D4E8",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  langModal: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 20,
    width: '85%',
    borderWidth: 1,
    borderColor: C.border,
  },
  langModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  langModalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: C.text,
  },
  langOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  langOptionActive: { backgroundColor: C.card },
  langOptionText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: C.text,
  },
});
