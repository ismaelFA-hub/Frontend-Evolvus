/**
 * Evolvus Core Quantum — Developer Command Center
 *
 * Painel privado do desenvolvedor — NÃO acessível a investidores.
 * Protegido por PIN. Accent: #FF6B35 (dev orange). Sem planTheme.
 *
 * Seções:
 *   1. Sistema: GET /api/health  (auto-refresh 10s)
 *   2. Módulos do Ecossistema: status + toggle ON/OFF por serviço
 *   3. Contagem de Rotas: estático
 *   4. Log de Auditoria: GET /api/security/audit-log
 *   5. Ações de Emergência: reset/limpar/reiniciar
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, Alert, Switch, TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";
import { useI18n } from "@/lib/i18n-context";

const C = Colors.dark;
const DEV_COLOR = "#FF6B35";
/** Change this constant to update the developer PIN. Keep it private. */
const DEV_PIN = "0000";
const APP_VERSION = "2.1.0";
const SHAKE_RESET_MS = 600;

// ─── Types ────────────────────────────────────────────────────────────

interface HealthData {
  status: string;
  uptime?: number;
  memory?: { heapUsed?: number; heapTotal?: number; rss?: number };
}

interface AuditEntry {
  id: string;
  action: string;
  userId?: string;
  ip?: string;
  success?: boolean;
  timestamp: string;
}

type ServiceStatus = "loading" | "online" | "offline";

interface ServiceDef {
  id: string;
  name: string;
  statusUrl: string;
  startUrl?: string;
  stopUrl?: string;
  /** Returns true if the response body indicates the service is online */
  isOnline: (body: unknown) => boolean;
}

// ─── Service Definitions ──────────────────────────────────────────────

function hasStatus(b: unknown): b is { status: string } {
  return typeof b === "object" && b !== null && "status" in b && typeof (b as Record<string, unknown>).status === "string";
}

const SERVICE_GROUPS: { category: string; icon: string; services: ServiceDef[] }[] = [
  {
    category: "🔍 Market",
    icon: "search-outline",
    services: [
      {
        id: "market-scanner",
        name: "Market Scanner",
        statusUrl: "/api/market/scan/status",
        startUrl: "/api/market/scan/start",
        stopUrl: "/api/market/scan/stop",
        isOnline: (b) => hasStatus(b) && b.status !== "offline" && b.status !== "stopped",
      },
      {
        id: "paper-trading",
        name: "Paper Trading",
        statusUrl: "/api/paper/positions",
        isOnline: (b) => {
          if (Array.isArray(b)) return (b as unknown[]).length > 0;
          const body = b as Record<string, unknown>;
          return typeof body.status === "string" && body.status !== "offline";
        },
      },
    ],
  },
  {
    category: "🤖 Bots",
    icon: "hardware-chip-outline",
    services: [
      {
        id: "grid-bot",
        name: "Grid Bot",
        statusUrl: "/api/grid",
        isOnline: (b) => {
          if (Array.isArray(b)) return (b as unknown[]).length > 0;
          const body = b as Record<string, unknown>;
          return typeof body.status === "string" && body.status !== "offline";
        },
      },
      {
        id: "dca-bot",
        name: "DCA Bot",
        statusUrl: "/api/dca",
        isOnline: (b) => hasStatus(b) && b.status !== "offline",
      },
      {
        id: "martingale-bot",
        name: "Martingale Bot",
        statusUrl: "/api/martingale",
        isOnline: (b) => hasStatus(b) && b.status !== "offline",
      },
      {
        id: "arbitrage-bot",
        name: "Arbitrage Bot",
        statusUrl: "/api/arbitrage/scan/cross",
        isOnline: (b) => hasStatus(b) && b.status !== "offline",
      },
    ],
  },
  {
    category: "🧠 IA Clássica",
    icon: "analytics-outline",
    services: [
      {
        id: "ai-status",
        name: "AI Status",
        statusUrl: "/api/ai/status",
        isOnline: (b) => hasStatus(b) && b.status !== "offline",
      },
      {
        id: "anomaly-detector",
        name: "Anomaly Detector",
        statusUrl: "/api/anomaly/status",
        isOnline: (b) => hasStatus(b) && b.status !== "offline",
      },
      {
        id: "market-intelligence",
        name: "Market Intelligence",
        statusUrl: "/api/intelligence/status",
        isOnline: (b) => hasStatus(b) && b.status !== "offline",
      },
      {
        id: "assistant",
        name: "Assistant",
        statusUrl: "/api/assistant/status",
        isOnline: (b) => hasStatus(b) && b.status !== "offline",
      },
      {
        id: "content-generator",
        name: "Content Generator",
        statusUrl: "/api/content/status",
        isOnline: (b) => hasStatus(b) && b.status !== "offline",
      },
    ],
  },
  {
    category: "🚀 IA Disruptiva",
    icon: "flash-outline",
    services: [
      {
        id: "bim",
        name: "Bot Intelligence (BIM)",
        statusUrl: "/api/bot-intelligence/status",
        isOnline: (b) => hasStatus(b) && b.status !== "offline",
      },
      {
        id: "grid-evolutivo",
        name: "Grid Evolutivo",
        statusUrl: "/api/grid-evolutivo/status",
        isOnline: (b) => hasStatus(b) && b.status !== "offline",
      },
      {
        id: "dca-intelligent",
        name: "DCA Inteligente",
        statusUrl: "/api/dca-intelligent/status",
        isOnline: (b) => hasStatus(b) && b.status !== "offline",
      },
      {
        id: "martingale-prob",
        name: "Martingale Prob",
        statusUrl: "/api/martingale-prob/status",
        isOnline: (b) => hasStatus(b) && b.status !== "offline",
      },
      {
        id: "arbitrage-predictive",
        name: "Arbitragem Preditiva",
        statusUrl: "/api/arbitrage-predictive/status",
        isOnline: (b) => hasStatus(b) && b.status !== "offline",
      },
      {
        id: "bot-collaborative",
        name: "Bot Colaborativo",
        statusUrl: "/api/bot-collaborative/status",
        isOnline: (b) => hasStatus(b) && b.status !== "offline",
      },
    ],
  },
  {
    category: "🏦 Suporte",
    icon: "shield-outline",
    services: [
      {
        id: "copy-trading",
        name: "Copy Trading",
        statusUrl: "/api/copy/leaders",
        isOnline: (b) => {
          if (Array.isArray(b)) return (b as unknown[]).length > 0;
          const body = b as Record<string, unknown>;
          return typeof body.status === "string" && body.status !== "offline";
        },
      },
      {
        id: "suporte-chat",
        name: "Suporte Chat",
        statusUrl: "/api/support/status",
        isOnline: (b) => hasStatus(b) && b.status !== "offline",
      },
    ],
  },
];

const ROUTE_BREAKDOWN: { label: string; count: number }[] = [
  { label: "Market",    count: 8  },
  { label: "Bots",      count: 20 },
  { label: "IA",        count: 16 },
  { label: "Exchanges", count: 5  },
  { label: "Suporte",   count: 10 },
  { label: "Auth",      count: 8  },
  { label: "Admin",     count: 12 },
  { label: "Outros",    count: 51 },
];

// ─── Helpers ──────────────────────────────────────────────────────────

function fmtUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fmtMem(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

// ─── PIN Gate ─────────────────────────────────────────────────────────

function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const [error, setError] = useState(false);

  function press(digit: string) {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    setError(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (next.length === 4) {
      setTimeout(() => {
        if (next === DEV_PIN) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onUnlock();
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setError(true);
          setShake(true);
          setTimeout(() => { setPin(""); setShake(false); }, SHAKE_RESET_MS);
        }
      }, 150);
    }
  }

  function backspace() {
    setPin(p => p.slice(0, -1));
    setError(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  const KEYS = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

  return (
    <View style={pin_s.root}>
      <Ionicons name="lock-closed" size={48} color={DEV_COLOR} style={{ marginBottom: 12 }} />
      <Text style={pin_s.title}>⚡ DEV CONSOLE</Text>
      <Text style={pin_s.sub}>Digite o PIN para desbloquear</Text>

      {/* Dots */}
      <View style={[pin_s.dots, shake && { opacity: 0.5 }]}>
        {[0,1,2,3].map(i => (
          <View
            key={i}
            style={[
              pin_s.dot,
              i < pin.length && { backgroundColor: error ? C.danger : DEV_COLOR },
            ]}
          />
        ))}
      </View>
      {error && <Text style={pin_s.errorText}>PIN incorreto</Text>}

      {/* Keypad */}
      <View style={pin_s.pad}>
        {KEYS.map((k, i) => {
          if (k === "") return <View key={i} style={pin_s.keyEmpty} />;
          if (k === "⌫") return (
            <Pressable key={i} style={pin_s.keyEmpty} onPress={backspace}>
              <Ionicons name="backspace-outline" size={22} color={C.text} />
            </Pressable>
          );
          return (
            <Pressable key={i} style={pin_s.key} onPress={() => press(k)}>
              <Text style={pin_s.keyText}>{k}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const pin_s = StyleSheet.create({
  root:      { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.background, paddingHorizontal: 40 },
  title:     { fontFamily: "Inter_700Bold", fontSize: 22, color: DEV_COLOR, letterSpacing: 2, marginBottom: 4 },
  sub:       { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, marginBottom: 32 },
  dots:      { flexDirection: "row", gap: 16, marginBottom: 8 },
  dot:       { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: C.textSecondary, backgroundColor: "transparent" },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.danger, marginBottom: 8 },
  pad:       { flexDirection: "row", flexWrap: "wrap", width: 240, gap: 12, marginTop: 24 },
  key:       { width: 64, height: 56, borderRadius: 12, backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#2a2a2a" },
  keyEmpty:  { width: 64, height: 56, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  keyText:   { fontFamily: "Inter_700Bold", fontSize: 22, color: C.text },
});

// ─── Service Row ──────────────────────────────────────────────────────

function ServiceRow({ svc }: { svc: ServiceDef }) {
  const [status, setStatus] = useState<ServiceStatus>("loading");
  const [toggling, setToggling] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiRequest("GET", svc.statusUrl);
      const body = await res.json() as unknown;
      setStatus(svc.isOnline(body) ? "online" : "offline");
    } catch {
      setStatus("offline");
    }
  }, [svc]);

  useEffect(() => { void fetchStatus(); }, [fetchStatus]);

  async function handleToggle(value: boolean) {
    const url = value ? svc.startUrl : svc.stopUrl;
    if (!url) return;
    setToggling(true);
    try {
      await apiRequest("POST", url);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await fetchStatus();
    } catch (e) {
      Alert.alert("Erro", (e as Error).message ?? "Falha ao alternar o status do serviço.");
    } finally {
      setToggling(false);
    }
  }

  const isOnline = status === "online";
  const statusColor = isOnline ? C.success : status === "loading" ? C.textSecondary : C.danger;
  const hasToggle = !!(svc.startUrl || svc.stopUrl);

  return (
    <View style={svc_s.row}>
      <View style={[svc_s.dot, { backgroundColor: statusColor }]} />
      <Text style={svc_s.name} numberOfLines={1}>{svc.name}</Text>
      {status === "loading" ? (
        <ActivityIndicator size="small" color={DEV_COLOR} style={{ marginLeft: "auto" }} />
      ) : (
        <Text style={[svc_s.badge, { color: statusColor }]}>
          {isOnline ? "ONLINE" : "OFFLINE"}
        </Text>
      )}
      {hasToggle && (
        toggling
          ? <ActivityIndicator size="small" color={DEV_COLOR} style={{ marginLeft: 8 }} />
          : (
            <Switch
              value={isOnline}
              onValueChange={handleToggle}
              trackColor={{ true: DEV_COLOR + "99", false: "#333" }}
              thumbColor={isOnline ? DEV_COLOR : "#666"}
              style={{ marginLeft: 8, transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          )
      )}
    </View>
  );
}

const svc_s = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#1f1f1f" },
  dot:   { width: 7, height: 7, borderRadius: 4 },
  name:  { flex: 1, fontFamily: "Inter_400Regular", fontSize: 12, color: C.text },
  badge: { fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 0.5 },
});

// ─── Main Console ─────────────────────────────────────────────────────

function DevConsoleContent({ onLock }: { onLock: () => void }) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/health");
      const body = await res.json() as HealthData;
      setHealth(body);
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const fetchAudit = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/security/audit-log");
      const body = await res.json() as { entries?: AuditEntry[] };
      setAuditLog((body.entries ?? []).slice(0, 10));
    } catch {
      setAuditLog([]);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHealth();
    void fetchAudit();
    intervalRef.current = setInterval(() => { void fetchHealth(); }, 10_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchHealth, fetchAudit]);

  async function resetPaperTrading() {
    Alert.alert("⚠️ Confirmar Reset", "Zerar todas as posições de Paper Trading?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Resetar", style: "destructive",
        onPress: async () => {
          try {
            await apiRequest("POST", "/api/paper/reset");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("✅ Feito", "Paper Trading resetado.");
          } catch (e) {
            Alert.alert("Erro", (e as Error).message);
          }
        },
      },
    ]);
  }

  async function clearSessions() {
    Alert.alert("⚠️ Confirmar Limpeza", "Encerrar todas as sessões ativas?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Limpar", style: "destructive",
        onPress: async () => {
          try {
            await apiRequest("DELETE", "/api/security/sessions");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("✅ Feito", "Sessões encerradas.");
          } catch (e) {
            Alert.alert("Erro", (e as Error).message);
          }
        },
      },
    ]);
  }

  async function restartScanner() {
    try {
      await apiRequest("POST", "/api/market/scan/stop");
      await apiRequest("POST", "/api/market/scan/start");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("✅ Feito", "Scanner reiniciado.");
    } catch (e) {
      Alert.alert("Erro", (e as Error).message);
    }
  }

  const systemOK = health?.status === "ok" || health?.status === "online";
  const totalRoutes = ROUTE_BREAKDOWN.reduce((acc, r) => acc + r.count, 0);

  return (
    <View style={[dc_s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={dc_s.header}>
        <View style={dc_s.headerLeft}>
          <View style={dc_s.titleRow}>
            <Text style={dc_s.title}>{t('devConsole')}</Text>
            <View style={dc_s.versionBadge}>
              <Text style={dc_s.versionText}>v{APP_VERSION}</Text>
            </View>
          </View>
          <Text style={dc_s.sub}>Evolvus Core Quantum — Centro de Comando</Text>
        </View>
        <Pressable
          style={dc_s.lockBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onLock(); }}
        >
          <Ionicons name="lock-open-outline" size={20} color={DEV_COLOR} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={dc_s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── 1. Sistema ─────────────────────────────────────────── */}
        <Text style={dc_s.sectionTitle}>SISTEMA</Text>
        {healthLoading ? (
          <ActivityIndicator color={DEV_COLOR} style={{ marginVertical: 12 }} />
        ) : (
          <View style={dc_s.statsRow}>
            <View style={[dc_s.statCard, { borderColor: (systemOK ? C.success : C.danger) + "44" }]}>
              <Ionicons
                name={systemOK ? "checkmark-circle" : "alert-circle"}
                size={20}
                color={systemOK ? C.success : C.danger}
              />
              <Text style={[dc_s.statVal, { color: systemOK ? C.success : C.danger }]}>
                {health ? (systemOK ? "OK" : "ERRO") : "N/A"}
              </Text>
              <Text style={dc_s.statLbl}>Status</Text>
            </View>
            <View style={[dc_s.statCard, { borderColor: DEV_COLOR + "44" }]}>
              <Ionicons name="time-outline" size={20} color={DEV_COLOR} />
              <Text style={[dc_s.statVal, { color: DEV_COLOR }]}>
                {health?.uptime != null ? fmtUptime(health.uptime) : "--:--:--"}
              </Text>
              <Text style={dc_s.statLbl}>Uptime</Text>
            </View>
            <View style={[dc_s.statCard, { borderColor: C.textSecondary + "44" }]}>
              <Ionicons name="hardware-chip-outline" size={20} color={C.textSecondary} />
              <Text style={[dc_s.statVal, { color: C.textSecondary }]}>
                {health?.memory?.heapUsed != null ? fmtMem(health.memory.heapUsed) : "N/A"}
              </Text>
              <Text style={dc_s.statLbl}>Memória</Text>
            </View>
          </View>
        )}

        {/* ── 2. Módulos do Ecossistema ──────────────────────────── */}
        <Text style={dc_s.sectionTitle}>MÓDULOS DO ECOSSISTEMA</Text>
        {SERVICE_GROUPS.map((group) => (
          <View key={group.category} style={dc_s.card}>
            <View style={dc_s.groupHeader}>
              <Ionicons name={group.icon as never} size={14} color={DEV_COLOR} />
              <Text style={dc_s.groupTitle}>{group.category}</Text>
            </View>
            {group.services.map(svc => (
              <ServiceRow key={svc.id} svc={svc} />
            ))}
          </View>
        ))}

        {/* ── 3. Contagem de Rotas ───────────────────────────────── */}
        <Text style={dc_s.sectionTitle}>CONTAGEM DE ROTAS</Text>
        <View style={dc_s.card}>
          <View style={dc_s.routesHeader}>
            <Text style={dc_s.routesTotalVal}>{totalRoutes}+</Text>
            <Text style={dc_s.routesTotalLbl}>endpoints ativos</Text>
          </View>
          <View style={dc_s.routeGrid}>
            {ROUTE_BREAKDOWN.map(r => (
              <View key={r.label} style={dc_s.routeItem}>
                <Text style={[dc_s.routeCount, { color: DEV_COLOR }]}>{r.count}</Text>
                <Text style={dc_s.routeLabel}>{r.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── 4. Log de Auditoria ────────────────────────────────── */}
        <Text style={dc_s.sectionTitle}>LOG DE AUDITORIA (últimos 10)</Text>
        <View style={dc_s.card}>
          {auditLoading ? (
            <ActivityIndicator color={DEV_COLOR} />
          ) : auditLog.length === 0 ? (
            <Text style={dc_s.emptyText}>Nenhum evento registrado</Text>
          ) : (
            auditLog.map((entry, i) => (
              <View key={entry.id ?? i} style={dc_s.auditRow}>
                <Ionicons
                  name={entry.success !== false ? "checkmark-circle-outline" : "close-circle-outline"}
                  size={13}
                  color={entry.success !== false ? C.success : C.danger}
                />
                <View style={{ flex: 1 }}>
                  <Text style={dc_s.auditAction}>{entry.action.replace(/_/g, " ")}</Text>
                  <Text style={dc_s.auditMeta}>{entry.userId ?? "anon"}{entry.ip ? ` · ${entry.ip}` : ""}</Text>
                </View>
                <Text style={dc_s.auditTime}>
                  {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* ── 5. Ações de Emergência ─────────────────────────────── */}
        <Text style={[dc_s.sectionTitle, { color: C.danger }]}>⚠ AÇÕES DE EMERGÊNCIA</Text>
        <View style={dc_s.dangerRow}>
          <Pressable style={dc_s.dangerBtn} onPress={resetPaperTrading}>
            <Text style={dc_s.dangerBtnText}>🔄</Text>
            <Text style={dc_s.dangerBtnLabel}>Reset Paper{"\n"}Trading</Text>
          </Pressable>
          <Pressable style={dc_s.dangerBtn} onPress={clearSessions}>
            <Text style={dc_s.dangerBtnText}>🧹</Text>
            <Text style={dc_s.dangerBtnLabel}>Limpar{"\n"}Sessões</Text>
          </Pressable>
          <Pressable style={dc_s.dangerBtn} onPress={restartScanner}>
            <Text style={dc_s.dangerBtnText}>📊</Text>
            <Text style={dc_s.dangerBtnLabel}>Reiniciar{"\n"}Scanner</Text>
          </Pressable>
        </View>

        {/* Exit link */}
        <Pressable style={dc_s.exitBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back-outline" size={14} color={C.textSecondary} />
          <Text style={dc_s.exitText}>← Sair</Text>
        </Pressable>

      </ScrollView>
    </View>
  );
}

// ─── Root Screen ──────────────────────────────────────────────────────

export default function DevConsoleScreen() {
  const [unlocked, setUnlocked] = useState(false);

  if (!unlocked) {
    return <PinGate onUnlock={() => setUnlocked(true)} />;
  }
  return <DevConsoleContent onLock={() => setUnlocked(false)} />;
}

// ─── Styles ───────────────────────────────────────────────────────────

const dc_s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: C.background },
  header:        { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: DEV_COLOR + "30", backgroundColor: "#0d0d0d" },
  headerLeft:    { flex: 1 },
  titleRow:      { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 2 },
  title:         { fontFamily: "Inter_700Bold", fontSize: 18, color: DEV_COLOR, letterSpacing: 1.5 },
  versionBadge:  { backgroundColor: DEV_COLOR + "22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: DEV_COLOR + "55" },
  versionText:   { fontFamily: "Inter_600SemiBold", fontSize: 10, color: DEV_COLOR },
  sub:           { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary },
  lockBtn:       { padding: 8, borderRadius: 8, backgroundColor: DEV_COLOR + "15", borderWidth: 1, borderColor: DEV_COLOR + "40" },

  scroll:        { paddingHorizontal: 14, paddingBottom: 40, gap: 10 },
  sectionTitle:  { fontFamily: "Inter_700Bold", fontSize: 11, color: C.textSecondary, letterSpacing: 1.5, marginTop: 6 },

  statsRow:      { flexDirection: "row", gap: 8 },
  statCard:      { flex: 1, backgroundColor: "#111", borderWidth: 1, borderRadius: 12, padding: 12, alignItems: "center", gap: 4 },
  statVal:       { fontFamily: "Inter_700Bold", fontSize: 13 },
  statLbl:       { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textSecondary },

  card:          { backgroundColor: "#0f0f0f", borderWidth: 1, borderColor: "#1f1f1f", borderRadius: 12, padding: 12 },
  groupHeader:   { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  groupTitle:    { fontFamily: "Inter_700Bold", fontSize: 12, color: DEV_COLOR },

  routesHeader:  { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 12 },
  routesTotalVal:{ fontFamily: "Inter_700Bold", fontSize: 28, color: DEV_COLOR },
  routesTotalLbl:{ fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary },
  routeGrid:     { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  routeItem:     { width: "22%", backgroundColor: "#1a1a1a", borderRadius: 8, padding: 8, alignItems: "center" },
  routeCount:    { fontFamily: "Inter_700Bold", fontSize: 16 },
  routeLabel:    { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textSecondary, textAlign: "center", marginTop: 2 },

  auditRow:      { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  auditAction:   { fontFamily: "Inter_500Medium", fontSize: 12, color: C.text, textTransform: "capitalize" },
  auditMeta:     { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textTertiary },
  auditTime:     { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textTertiary },
  emptyText:     { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, textAlign: "center", paddingVertical: 8 },

  dangerRow:     { flexDirection: "row", gap: 8 },
  dangerBtn:     { flex: 1, backgroundColor: C.danger + "15", borderWidth: 1, borderColor: C.danger + "40", borderRadius: 12, paddingVertical: 14, alignItems: "center", gap: 4 },
  dangerBtnText: { fontSize: 22 },
  dangerBtnLabel:{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: C.danger, textAlign: "center", lineHeight: 14 },

  exitBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 12, marginTop: 8 },
  exitText:      { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary },
});
