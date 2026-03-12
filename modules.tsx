/**
 * Evolvus Core Quantum — Add-on Modules Screen (Sprint LXIV)
 *
 * Displays the catalog of individual modules (add-ons) users can subscribe
 * to independently of their plan. Uses the backend endpoint:
 *   GET  /api/modules               — list all available modules
 *   POST /api/modules/subscribe     — subscribe to a module
 *   POST /api/modules/arsenal/activate — activate Arsenal strategies
 */

import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;

interface ModuleInfo {
  id: string;
  name: string;
  description: string;
  priceBRL: number;
  features: string[];
  icon: string;
  category: "ai" | "strategy" | "analytics";
  enterpriseOnly: boolean;
}

interface ModuleCatalog {
  modules: ModuleInfo[];
}

const MODULE_COLORS: Record<string, string> = {
  bim:           "#7B61FF",
  xai:           "#00D4AA",
  regime:        "#F7931A",
  creative_ai:   "#E879F9",
  market_intel:  "#3B82F6",
  arsenal:       "#10B981",
  gemeo_digital: "#F59E0B",
  anomaly:       "#EF4444",
};

export default function ModulesScreen() {
  const insets = useSafeAreaInsets();
  const { planTheme } = usePlanTheme();
  const { user } = useAuth();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await apiRequest("GET", "/api/modules");
        const data = await res.json() as ModuleCatalog;
        if (!cancelled) setModules(data.modules ?? []);
      } catch {
        if (!cancelled) setError("Falha ao carregar módulos. Tente novamente.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleSubscribe = useCallback(async (moduleId: string, moduleName: string) => {
    if (!user) {
      Alert.alert("Login necessário", "Faça login para assinar módulos.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubscribing(moduleId);
    try {
      const res = await apiRequest("POST", "/api/modules/subscribe", { moduleId });
      const data = await res.json() as { message?: string; error?: string };
      if (!res.ok) {
        Alert.alert("Erro", data.error ?? data.message ?? "Falha ao assinar módulo.");
      } else {
        Alert.alert(
          "✅ Módulo Ativado!",
          `${moduleName} foi assinado com sucesso. O acesso está disponível imediatamente via API.`,
          [{ text: "OK" }],
        );
        // If Arsenal was subscribed, offer to activate strategies internally
        if (moduleId === "arsenal") {
          Alert.alert(
            "Arsenal de Estratégias",
            "Deseja ativar as estratégias internamente no sistema agora?",
            [
              { text: "Não", style: "cancel" },
              {
                text: "Sim, ativar",
                onPress: async () => {
                  await apiRequest("POST", "/api/modules/arsenal/activate", {});
                },
              },
            ],
          );
        }
      }
    } catch {
      Alert.alert("Erro", "Não foi possível processar a assinatura.");
    } finally {
      setSubscribing(null);
    }
  }, [user]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); router.back(); }}
          style={styles.backBtn}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.title}>Módulos Avulsos</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Info banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={18} color={planTheme.primary} />
        <Text style={styles.infoBannerText}>
          Adicione funcionalidades individuais ao seu plano. A soma de todos os módulos (R$1.526/mês) torna o plano Premium (R$497) muito mais vantajoso.
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={planTheme.primary} />
          <Text style={styles.loadingText}>Carregando módulos...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle" size={48} color={C.error} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            style={[styles.retryBtn, { borderColor: planTheme.primary }]}
            onPress={() => { setError(null); setLoading(true); }}
          >
            <Text style={[styles.retryBtnText, { color: planTheme.primary }]}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={styles.sectionTitle}>🧩 Ferramentas Individuais</Text>
          <Text style={styles.sectionSubtitle}>
            Ideal para desenvolvedores e traders que querem integrar funcionalidades específicas via API.
          </Text>

          {modules.map((mod) => {
            const color = MODULE_COLORS[mod.id] ?? planTheme.primary;
            const isSubscribing = subscribing === mod.id;
            const isEnterpriseOnly = mod.enterpriseOnly;

            return (
              <View
                key={mod.id}
                style={[styles.moduleCard, { borderColor: isEnterpriseOnly ? "#F59E0B" : C.border }]}
                accessibilityRole="article"
                accessibilityLabel={`Módulo ${mod.name}`}
              >
                {isEnterpriseOnly && (
                  <View style={[styles.exclusiveBadge, { backgroundColor: "#F59E0B20" }]}>
                    <Text style={[styles.exclusiveBadgeText, { color: "#F59E0B" }]}>
                      ⭐ EXCLUSIVO ENTERPRISE — não disponível avulso
                    </Text>
                  </View>
                )}

                <View style={styles.moduleHeader}>
                  <View style={[styles.moduleIconWrap, { backgroundColor: `${color}20` }]}>
                    <Ionicons name={(mod.icon ?? "cube") as "cube"} size={24} color={color} />
                  </View>
                  <View style={styles.moduleTitleWrap}>
                    <Text style={[styles.moduleName, { color }]}>{mod.name}</Text>
                    <Text style={styles.modulePrice}>
                      {isEnterpriseOnly ? "Incluído no Enterprise" : `R$ ${mod.priceBRL}/mês`}
                    </Text>
                  </View>
                </View>

                <Text style={styles.moduleDescription}>{mod.description}</Text>

                {/* Features list */}
                {Array.isArray(mod.features) && mod.features.length > 0 && (
                  <View style={styles.featuresList}>
                    {mod.features.map((feat, i) => (
                      <View key={i} style={styles.featureRow}>
                        <Ionicons name="checkmark" size={14} color={color} />
                        <Text style={styles.featureText}>{feat}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* CTA */}
                {!isEnterpriseOnly && (
                  <Pressable
                    style={[styles.subscribeBtn, { backgroundColor: color }]}
                    onPress={() => handleSubscribe(mod.id, mod.name)}
                    disabled={isSubscribing}
                    accessibilityRole="button"
                    accessibilityLabel={`Assinar ${mod.name}`}
                  >
                    {isSubscribing ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <Text style={styles.subscribeBtnText}>
                        Assinar · R$ {mod.priceBRL}/mês
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>
            );
          })}

          {/* Upgrade suggestion */}
          <View style={styles.upgradeSuggestion}>
            <Ionicons name="bulb" size={20} color="#F7931A" />
            <View style={{ flex: 1 }}>
              <Text style={styles.upgradeSuggestionTitle}>
                💡 Múltiplos módulos? O plano é mais vantajoso!
              </Text>
              <Text style={styles.upgradeSuggestionText}>
                Com 3 ou mais módulos, o Plano Premium (R$497/mês) oferece mais recursos por menos. Considere fazer upgrade.
              </Text>
              <Pressable
                style={styles.upgradeSuggestionBtn}
                onPress={() => router.push("/payment")}
                accessibilityRole="button"
              >
                <Text style={styles.upgradeSuggestionBtnText}>Ver Planos →</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 18, fontWeight: "700", color: C.text },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  infoBannerText: { flex: 1, fontSize: 12, color: C.textSecondary, lineHeight: 18 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: C.textSecondary },
  errorText: { marginTop: 12, fontSize: 14, color: C.error, textAlign: "center" },
  retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  retryBtnText: { fontSize: 14, fontWeight: "600" },
  scrollContent: { padding: 16, gap: 16 },
  sectionTitle: { fontSize: 20, fontWeight: "800", color: C.text, marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: C.textSecondary, marginBottom: 8, lineHeight: 18 },
  moduleCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  exclusiveBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  exclusiveBadgeText: { fontSize: 11, fontWeight: "700" },
  moduleHeader: { flexDirection: "row", gap: 12, alignItems: "center" },
  moduleIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  moduleTitleWrap: { flex: 1 },
  moduleName: { fontSize: 16, fontWeight: "700", marginBottom: 2 },
  modulePrice: { fontSize: 13, color: C.textSecondary },
  moduleDescription: { fontSize: 13, color: C.textSecondary, lineHeight: 18 },
  featuresList: { gap: 6 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { fontSize: 12, color: C.textSecondary, flex: 1 },
  subscribeBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  subscribeBtnText: { fontSize: 14, fontWeight: "700", color: "#000" },
  upgradeSuggestion: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#F7931A15",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F7931A30",
    marginTop: 8,
  },
  upgradeSuggestionTitle: { fontSize: 14, fontWeight: "700", color: C.text, marginBottom: 4 },
  upgradeSuggestionText: { fontSize: 12, color: C.textSecondary, lineHeight: 18, marginBottom: 8 },
  upgradeSuggestionBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "#F7931A",
    borderRadius: 8,
  },
  upgradeSuggestionBtnText: { fontSize: 13, fontWeight: "700", color: "#000" },
});
