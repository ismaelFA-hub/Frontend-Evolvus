import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, TextInput,
  ActivityIndicator, RefreshControl, Image, Linking, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/query-client";
import { ALL_EXCHANGES, getExchangeFavicon } from "@/lib/exchanges";
import { AFFILIATE_LINKS } from "@/lib/affiliate-links";

const C = Colors.dark;
const INITIAL_VISIBLE = 5;

interface ApiKey {
  id: string;
  exchange: string;
  label: string;
  permissions: string[];
  createdAt: string;
}

export default function ExchangeCenterScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [connectSearch, setConnectSearch] = useState("");
  const [connectExpanded, setConnectExpanded] = useState(false);

  const [createSearch, setCreateSearch] = useState("");
  const [createExpanded, setCreateExpanded] = useState(false);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const loadKeys = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/security/api-keys");
      const data = await res.json();
      setApiKeys(data.apiKeys || []);
    } catch {
      setApiKeys([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const connectedExchangeIds = new Set(apiKeys.map((k) => k.exchange.toLowerCase()));
  const connectedCount = connectedExchangeIds.size;

  const getKeyForExchange = (exchangeId: string) =>
    apiKeys.find((k) => k.exchange.toLowerCase() === exchangeId.toLowerCase());

  const handleDelete = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await apiRequest("DELETE", `/api/security/api-keys/${id}`);
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
    } catch {}
  };

  const openAffiliateLink = (exchangeId: string) => {
    const url = AFFILIATE_LINKS[exchangeId] || `https://${ALL_EXCHANGES.find(e => e.id === exchangeId)?.domain}`;
    Linking.openURL(url).catch(() => {});
  };

  const connectFiltered = ALL_EXCHANGES.filter((e) =>
    e.label.toLowerCase().includes(connectSearch.toLowerCase()) ||
    e.id.toLowerCase().includes(connectSearch.toLowerCase())
  );
  const connectShowAll = connectExpanded || connectSearch.length > 0;
  const connectVisible = connectShowAll ? connectFiltered : connectFiltered.slice(0, INITIAL_VISIBLE);
  const connectHidden = ALL_EXCHANGES.length - INITIAL_VISIBLE;

  const CREATE_ORDER = [...ALL_EXCHANGES.slice(5), ...ALL_EXCHANGES.slice(0, 5)];
  const createFiltered = CREATE_ORDER.filter((e) =>
    e.label.toLowerCase().includes(createSearch.toLowerCase()) ||
    e.id.toLowerCase().includes(createSearch.toLowerCase())
  );
  const createShowAll = createExpanded || createSearch.length > 0;
  const createVisible = createShowAll ? createFiltered : createFiltered.slice(0, INITIAL_VISIBLE);
  const createHidden = ALL_EXCHANGES.length - INITIAL_VISIBLE;

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Text style={s.title}>🔌 Central de Exchanges</Text>
        <View style={s.statusBadge}>
          <View style={[s.statusDot, { backgroundColor: connectedCount > 0 ? C.success : C.textTertiary }]} />
          <Text style={s.statusText}>
            {connectedCount} de {ALL_EXCHANGES.length} conectadas
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadKeys(); }} tintColor={C.primary} />}
      >
        {connectedCount === 0 && (
          <View style={s.welcomeCard}>
            <Text style={s.welcomeTitle}>🎉 Bem-vindo à Central de Exchanges!</Text>
            <Text style={s.welcomeText}>
              Para começar a operar, conecte suas contas via API Key.{"\n\n"}
              Se você <Text style={s.welcomeBold}>JÁ TEM conta</Text> em alguma exchange:{"\n"}
              {"   "}➡️ Vá para "CONECTAR" e adicione suas chaves.{"\n\n"}
              Se você <Text style={s.welcomeBold}>AINDA NÃO TEM conta</Text>:{"\n"}
              {"   "}➡️ Vá para "CRIAR CONTA" e abra sua conta.{"\n"}
              {"   "}(Ao criar por nossos links, você ganha bônus!)
            </Text>
          </View>
        )}

        {/* ── CONECTAR ─────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>🔗 CONECTAR</Text>
          <Text style={s.sectionSub}>
            Selecione a exchange que você já tem conta e conecte com as chaves de API
          </Text>

          <View style={s.searchRow}>
            <Ionicons name="search" size={16} color={C.textTertiary} />
            <TextInput
              style={s.searchInput}
              placeholder="Buscar exchange..."
              placeholderTextColor={C.textTertiary}
              value={connectSearch}
              onChangeText={(v) => { setConnectSearch(v); setConnectExpanded(false); }}
            />
            {connectSearch.length > 0 && (
              <Pressable onPress={() => setConnectSearch("")}>
                <Ionicons name="close-circle" size={16} color={C.textTertiary} />
              </Pressable>
            )}
          </View>

          {connectVisible.map((ex) => {
            const key = getKeyForExchange(ex.id);
            const isConnected = !!key;
            return (
              <View key={ex.id} style={s.exchangeRow}>
                <Image
                  source={{ uri: getExchangeFavicon(ex.domain, 32) }}
                  style={s.exchangeLogo}
                />
                <View style={s.exchangeInfo}>
                  <Text style={s.exchangeName}>{ex.label}</Text>
                  <View style={s.statusRow}>
                    <View style={[s.dot, { backgroundColor: isConnected ? C.success : C.textTertiary }]} />
                    <Text style={[s.exchangeStatus, { color: isConnected ? C.success : C.textTertiary }]}>
                      {isConnected ? "Conectada" : "Não conectada"}
                    </Text>
                  </View>
                </View>
                {isConnected ? (
                  <View style={s.actionRow}>
                    <Pressable
                      style={s.manageBtn}
                      onPress={() => {
                        Haptics.selectionAsync();
                        router.push({ pathname: "/connect-exchange", params: { exchangeId: ex.id, existingKeyId: key.id } } as any);
                      }}
                    >
                      <Text style={s.manageBtnText}>Gerenciar</Text>
                    </Pressable>
                    <Pressable
                      style={s.deleteBtn}
                      onPress={() => handleDelete(key.id)}
                    >
                      <Ionicons name="trash-outline" size={16} color={C.danger} />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    style={s.connectBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push({ pathname: "/connect-exchange", params: { exchangeId: ex.id } } as any);
                    }}
                  >
                    <Text style={s.connectBtnText}>Conectar</Text>
                  </Pressable>
                )}
              </View>
            );
          })}

          {!connectShowAll && connectHidden > 0 && (
            <Pressable
              style={s.showMoreBtn}
              onPress={() => { Haptics.selectionAsync(); setConnectExpanded(true); }}
            >
              <Ionicons name="chevron-down" size={16} color={C.primary} />
              <Text style={s.showMoreText}>Ver mais {connectHidden} exchanges</Text>
            </Pressable>
          )}
          {connectExpanded && connectSearch.length === 0 && (
            <Pressable
              style={s.showMoreBtn}
              onPress={() => { Haptics.selectionAsync(); setConnectExpanded(false); }}
            >
              <Ionicons name="chevron-up" size={16} color={C.textSecondary} />
              <Text style={[s.showMoreText, { color: C.textSecondary }]}>Mostrar menos</Text>
            </Pressable>
          )}
        </View>

        {/* ── CRIAR CONTA ──────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>🆕 CRIAR CONTA</Text>
          <Text style={s.sectionSub}>
            Ainda não tem conta? Crie agora e comece a operar!{"\n"}
            Ao criar por nossos links você ganha bônus exclusivos.
          </Text>

          <View style={s.searchRow}>
            <Ionicons name="search" size={16} color={C.textTertiary} />
            <TextInput
              style={s.searchInput}
              placeholder="Buscar exchange..."
              placeholderTextColor={C.textTertiary}
              value={createSearch}
              onChangeText={(v) => { setCreateSearch(v); setCreateExpanded(false); }}
            />
            {createSearch.length > 0 && (
              <Pressable onPress={() => setCreateSearch("")}>
                <Ionicons name="close-circle" size={16} color={C.textTertiary} />
              </Pressable>
            )}
          </View>

          {createVisible.map((ex) => (
            <View key={ex.id} style={s.exchangeRow}>
              <Image
                source={{ uri: getExchangeFavicon(ex.domain, 32) }}
                style={s.exchangeLogo}
              />
              <View style={s.exchangeInfo}>
                <Text style={s.exchangeName}>{ex.label}</Text>
                <Text style={s.exchangeDomain}>{ex.domain}</Text>
              </View>
              <Pressable
                style={s.createBtn}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openAffiliateLink(ex.id); }}
              >
                <Text style={s.createBtnText}>Cadastrar</Text>
              </Pressable>
            </View>
          ))}

          {!createShowAll && createHidden > 0 && (
            <Pressable
              style={s.showMoreBtn}
              onPress={() => { Haptics.selectionAsync(); setCreateExpanded(true); }}
            >
              <Ionicons name="chevron-down" size={16} color={C.primary} />
              <Text style={s.showMoreText}>Ver mais {createHidden} exchanges</Text>
            </Pressable>
          )}
          {createExpanded && createSearch.length === 0 && (
            <Pressable
              style={s.showMoreBtn}
              onPress={() => { Haptics.selectionAsync(); setCreateExpanded(false); }}
            >
              <Ionicons name="chevron-up" size={16} color={C.textSecondary} />
              <Text style={[s.showMoreText, { color: C.textSecondary }]}>Mostrar menos</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <View style={[s.sorButtonContainer, { paddingBottom: insets.bottom + 90 }]}>
        <Pressable
          style={[s.sorButton, connectedCount === 0 && s.sorButtonDisabled]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            router.push("/smart-order" as any);
          }}
        >
          <Ionicons name="git-network-outline" size={18} color="#fff" />
          <Text style={s.sorButtonText}>▶ TESTAR ROTEADOR INTELIGENTE (SOR)</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { paddingHorizontal: 20, paddingBottom: 12, gap: 6 },
  title: { fontFamily: "Inter_700Bold", fontSize: 22, color: C.text },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary },
  scroll: { paddingHorizontal: 20, gap: 24, paddingTop: 8 },
  welcomeCard: {
    backgroundColor: "#1A2035", borderRadius: 16, padding: 18,
    borderLeftWidth: 3, borderLeftColor: C.primary,
  },
  welcomeTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.text, marginBottom: 10 },
  welcomeText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, lineHeight: 20 },
  welcomeBold: { fontFamily: "Inter_700Bold", color: C.text },
  section: { gap: 12 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 13, color: C.primary, letterSpacing: 1.2 },
  sectionSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, lineHeight: 18 },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: C.border,
  },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14, color: C.text },
  exchangeRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.card, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },
  exchangeLogo: { width: 32, height: 32, borderRadius: 8 },
  exchangeInfo: { flex: 1, gap: 3 },
  exchangeName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  exchangeStatus: { fontFamily: "Inter_400Regular", fontSize: 12 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  manageBtn: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.primary,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  manageBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.primary },
  deleteBtn: { padding: 6 },
  connectBtn: {
    backgroundColor: C.primary, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  connectBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#fff" },
  exchangeDomain: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  createBtn: {
    backgroundColor: "#00A775", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  createBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#fff" },
  showMoreBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 12, borderRadius: 10,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  showMoreText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.primary },
  logosGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  logoItem: { alignItems: "center", width: 64, gap: 4 },
  logoImg: { width: 48, height: 48, borderRadius: 12 },
  logoLabel: { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textSecondary, textAlign: "center" },
  sorButtonContainer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: C.background, borderTopWidth: 1, borderTopColor: C.border,
  },
  sorButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#7B61FF", borderRadius: 14, paddingVertical: 16,
  },
  sorButtonDisabled: { opacity: 0.5 },
  sorButtonText: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#fff" },
});
