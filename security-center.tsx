import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/query-client";
import { useI18n } from "@/lib/i18n-context";

const C = Colors.dark;

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface Session {
  id: string;
  deviceLabel: string;
  ip: string;
  createdAt: string;
  lastUsedAt: string;
}

interface AuditEntry {
  id: string;
  action: string;
  ip: string;
  success: boolean;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface ApiKeyInfo {
  id: string;
  exchange: string;
  label: string;
  permissions: string[];
  createdAt: string;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function actionIcon(action: string): { name: keyof typeof Ionicons.glyphMap; color: string } {
  if (action.includes("fail") || action === "suspicious_activity") return { name: "warning", color: C.danger };
  if (action === "logout" || action === "session_revoked") return { name: "log-out", color: C.warning };
  if (action.startsWith("totp")) return { name: "shield-checkmark", color: C.primary };
  if (action.includes("api_key")) return { name: "key", color: C.warning };
  if (action === "register") return { name: "person-add", color: C.success };
  return { name: "checkmark-circle", color: C.success };
}

// ────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────

function SectionHeader({ title, icon }: { title: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={s.sectionHeader}>
      <Ionicons name={icon} size={18} color={C.primary} />
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

function TotpSection() {
  const { user } = useAuth();
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [qrUri, setQrUri] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<"idle" | "setup" | "disable">("idle");
  const totpOn = totpEnabled || ((user as typeof user & { totpEnabled?: boolean })?.totpEnabled ?? false);

  useEffect(() => {
    const on = (user as typeof user & { totpEnabled?: boolean })?.totpEnabled ?? false;
    setTotpEnabled(on);
  }, [user]);

  const startSetup = async () => {
    Haptics.selectionAsync();
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/security/totp/setup");
      const data = await res.json() as { secret: string; uri: string };
      setSecret(data.secret);
      setQrUri(data.uri);
      setPhase("setup");
      setShowSetup(true);
    } catch {
      Alert.alert("Error", "Failed to start 2FA setup. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const confirmEnable = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      await apiRequest("POST", "/api/security/totp/enable", { totpCode: code });
      setTotpEnabled(true);
      setShowSetup(false);
      setCode("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("✅ 2FA Enabled", "Two-factor authentication is now active on your account.");
    } catch {
      Alert.alert("Invalid Code", "The 6-digit code was incorrect. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const startDisable = () => {
    Haptics.selectionAsync();
    setPhase("disable");
    setShowSetup(true);
  };

  const confirmDisable = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      await apiRequest("POST", "/api/security/totp/disable", { totpCode: code });
      setTotpEnabled(false);
      setShowSetup(false);
      setCode("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("2FA Disabled", "Two-factor authentication has been removed.");
    } catch {
      Alert.alert("Invalid Code", "The 6-digit code was incorrect.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.card}>
      <SectionHeader title="Two-Factor Authentication (2FA)" icon="shield-checkmark" />
      <Text style={s.cardDesc}>
        {totpOn
          ? "✅ 2FA is active. Your account is protected with TOTP."
          : "Add an extra layer of protection. Use Google Authenticator, Authy, or any TOTP app."}
      </Text>
      <Pressable
        style={[s.btn, totpOn ? s.btnDanger : s.btnPrimary]}
        onPress={totpOn ? startDisable : startSetup}
      >
        {loading ? (
          <ActivityIndicator color="#000" size="small" />
        ) : (
          <>
            <Ionicons name={totpOn ? "shield-outline" : "shield-checkmark"} size={16} color={totpOn ? C.danger : "#000"} />
            <Text style={[s.btnText, totpOn && { color: C.danger }]}>
              {totpOn ? "Disable 2FA" : "Enable 2FA"}
            </Text>
          </>
        )}
      </Pressable>

      <Modal visible={showSetup} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>
              {phase === "setup" ? "🛡️ Set Up 2FA" : "🔓 Disable 2FA"}
            </Text>
            {phase === "setup" && (
              <>
                <Text style={s.modalDesc}>
                  Open your authenticator app (Google Authenticator, Authy, etc.) and add the account manually using the secret below, or copy the full URI.
                </Text>
                <View style={s.qrPlaceholder}>
                  <View style={s.qrIconRow}>
                    <Ionicons name="shield-checkmark" size={36} color={C.primary} />
                    <Text style={s.qrAppHint}>Evolvus Core Quantum · 2FA</Text>
                  </View>
                  <Text style={s.qrSecretLabel}>Secret key (enter manually):</Text>
                  <Text style={s.qrSecret} selectable>{secret}</Text>
                  <Pressable
                    style={s.copyBtn}
                    onPress={() => {
                      if (Platform.OS === "web") {
                        navigator.clipboard?.writeText(qrUri).then(() => {
                          Alert.alert("Copied!", "OTP URI copied to clipboard. Paste into your authenticator app.");
                        }).catch(() => {
                          Alert.alert("Copy", qrUri);
                        });
                      } else {
                        Alert.alert("OTP URI", qrUri);
                      }
                      Haptics.selectionAsync();
                    }}
                  >
                    <Ionicons name="copy-outline" size={14} color={C.primary} />
                    <Text style={s.copyBtnText}>Copy full OTP URI</Text>
                  </Pressable>
                </View>
              </>
            )}
            {phase === "disable" && (
              <Text style={s.modalDesc}>
                Enter the current 6-digit code from your authenticator app to disable 2FA.
              </Text>
            )}
            <TextInput
              style={s.codeInput}
              value={code}
              onChangeText={setCode}
              placeholder="000000"
              placeholderTextColor={C.textSecondary}
              keyboardType="number-pad"
              maxLength={6}
              textAlign="center"
            />
            <View style={s.modalRow}>
              <Pressable style={[s.btn, s.btnGhost, { flex: 1, marginRight: 8 }]} onPress={() => { setShowSetup(false); setCode(""); }}>
                <Text style={[s.btnText, { color: C.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[s.btn, phase === "setup" ? s.btnPrimary : s.btnDanger, { flex: 1 }, code.length !== 6 && s.btnDisabled]}
                onPress={phase === "setup" ? confirmEnable : confirmDisable}
                disabled={code.length !== 6 || loading}
              >
                {loading ? <ActivityIndicator color="#000" size="small" /> : (
                  <Text style={[s.btnText, phase === "disable" && { color: C.danger }]}>
                    {phase === "setup" ? "Confirm" : "Disable"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SessionsSection() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/security/sessions");
      const data = await res.json() as { sessions: Session[] };
      setSessions(data.sessions);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const revoke = async (id: string) => {
    Haptics.selectionAsync();
    try {
      await apiRequest("DELETE", `/api/security/sessions/${id}`);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Failed to revoke session.");
    }
  };

  const revokeAll = () => {
    Alert.alert("Revoke All Sessions", "This will sign you out of all devices. Continue?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Revoke All", style: "destructive", onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          try {
            await apiRequest("DELETE", "/api/security/sessions");
            setSessions([]);
          } catch { Alert.alert("Error", "Failed to revoke sessions."); }
        },
      },
    ]);
  };

  return (
    <View style={s.card}>
      <View style={s.cardHeaderRow}>
        <SectionHeader title="Active Sessions" icon="phone-portrait" />
        <Pressable onPress={revokeAll}>
          <Text style={s.linkDanger}>Revoke All</Text>
        </Pressable>
      </View>
      {loading ? <ActivityIndicator color={C.primary} /> : (
        sessions.length === 0
          ? <Text style={s.emptyText}>No active sessions found.</Text>
          : sessions.map((s2) => (
            <View key={s2.id} style={s.sessionRow}>
              <Ionicons name="phone-portrait-outline" size={22} color={C.textSecondary} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.sessionDevice}>{s2.deviceLabel}</Text>
                <Text style={s.sessionMeta}>{s2.ip} · {fmtDate(s2.lastUsedAt)}</Text>
              </View>
              <Pressable onPress={() => revoke(s2.id)} style={s.revokeBtn}>
                <Ionicons name="close-circle" size={20} color={C.danger} />
              </Pressable>
            </View>
          ))
      )}
    </View>
  );
}

function AuditSection() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest("GET", "/api/security/audit-log?limit=20")
      .then((r) => r.json() as Promise<{ logs: AuditEntry[] }>)
      .then((d) => setLogs(d.logs))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={s.card}>
      <SectionHeader title="Security Audit Log" icon="document-text" />
      <Text style={s.cardDesc}>Recent security events on your account.</Text>
      {loading ? <ActivityIndicator color={C.primary} /> : (
        logs.length === 0
          ? <Text style={s.emptyText}>No security events recorded yet.</Text>
          : logs.map((entry) => {
            const ico = actionIcon(entry.action);
            return (
              <View key={entry.id} style={s.auditRow}>
                <View style={[s.auditDot, { backgroundColor: ico.color + "33" }]}>
                  <Ionicons name={ico.name} size={14} color={ico.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.auditAction}>{entry.action.replace(/_/g, " ")}</Text>
                  <Text style={s.auditMeta}>{entry.ip} · {fmtDate(entry.timestamp)}</Text>
                </View>
                <View style={[s.statusPill, { backgroundColor: entry.success ? C.success + "33" : C.danger + "33" }]}>
                  <Text style={[s.statusText, { color: entry.success ? C.success : C.danger }]}>
                    {entry.success ? "OK" : "FAIL"}
                  </Text>
                </View>
              </View>
            );
          })
      )}
    </View>
  );
}

// ────────────────────────────────────────────────────────────
// Main Screen
// ────────────────────────────────────────────────────────────

export default function SecurityCenterScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => { Haptics.selectionAsync(); router.back(); }} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <View>
          <Text style={s.headerTitle}>{t('securityCenter')}</Text>
          <Text style={s.headerSub}>Military-grade protection</Text>
        </View>
        <View style={s.shieldBadge}>
          <Ionicons name="shield" size={20} color={C.primary} />
        </View>
      </View>

      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>

        {/* Security Score */}
        <View style={s.scoreCard}>
          <View>
            <Text style={s.scoreLabel}>Security Score</Text>
            <Text style={s.scoreValue}>AES-256-GCM · HS256 JWT · scrypt</Text>
          </View>
          <View style={s.scoreBadge}>
            <Ionicons name="shield-checkmark" size={28} color={C.primary} />
            <Text style={s.scoreNumber}>A+</Text>
          </View>
        </View>

        {/* 2FA */}
        <TotpSection />

        {/* Active Sessions */}
        <SessionsSection />

        {/* Audit Log */}
        <AuditSection />

        {/* Info footer */}
        <View style={s.footerInfo}>
          <Ionicons name="information-circle-outline" size={14} color={C.textSecondary} />
          <Text style={s.footerText}>
            Exchange API keys are encrypted with AES-256-GCM before storage. Passwords use scrypt (NIST recommended).
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: C.text },
  headerSub: { fontSize: 12, color: C.textSecondary, marginTop: 1 },
  shieldBadge: { marginLeft: "auto", backgroundColor: C.primary + "22", padding: 8, borderRadius: 12 },
  scroll: { padding: 20, gap: 16 },

  scoreCard: { backgroundColor: C.surface, borderRadius: 16, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: C.primary + "44", marginBottom: 4 },
  scoreLabel: { fontSize: 14, fontWeight: "600", color: C.text },
  scoreValue: { fontSize: 11, color: C.textSecondary, marginTop: 4 },
  scoreBadge: { alignItems: "center" },
  scoreNumber: { fontSize: 18, fontWeight: "800", color: C.primary },

  card: { backgroundColor: C.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: C.border },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: C.text },
  cardDesc: { fontSize: 13, color: C.textSecondary, lineHeight: 19, marginBottom: 14 },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  linkDanger: { fontSize: 13, color: C.danger, fontWeight: "600" },

  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  btnPrimary: { backgroundColor: C.primary },
  btnDanger: { backgroundColor: C.danger + "22", borderWidth: 1, borderColor: C.danger },
  btnGhost: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 14, fontWeight: "600", color: "#000" },

  sessionRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border },
  sessionDevice: { fontSize: 13, fontWeight: "600", color: C.text },
  sessionMeta: { fontSize: 11, color: C.textSecondary, marginTop: 2 },
  revokeBtn: { padding: 4 },
  emptyText: { fontSize: 13, color: C.textSecondary, textAlign: "center", paddingVertical: 12 },

  auditRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border },
  auditDot: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  auditAction: { fontSize: 13, fontWeight: "600", color: C.text, textTransform: "capitalize" },
  auditMeta: { fontSize: 11, color: C.textSecondary, marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: "700" },

  modalOverlay: { flex: 1, backgroundColor: "#00000099", justifyContent: "flex-end" },
  modalCard: { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, gap: 16 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: C.text, textAlign: "center" },
  modalDesc: { fontSize: 14, color: C.textSecondary, textAlign: "center", lineHeight: 20 },
  modalRow: { flexDirection: "row", gap: 8 },
  qrPlaceholder: { alignItems: "center", backgroundColor: C.background, borderRadius: 16, padding: 20, gap: 10 },
  qrIconRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  qrAppHint: { fontSize: 14, fontWeight: "700", color: C.text },
  qrSecretLabel: { fontSize: 12, color: C.textSecondary, marginTop: 4 },
  qrSecret: { fontSize: 15, fontWeight: "700", color: C.primary, letterSpacing: 3, fontFamily: "monospace", textAlign: "center" },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: C.primary + "50", backgroundColor: C.primary + "11" },
  copyBtnText: { fontSize: 13, fontWeight: "600", color: C.primary },
  codeInput: { backgroundColor: C.background, borderRadius: 12, borderWidth: 1, borderColor: C.border, color: C.text, fontSize: 32, fontWeight: "800", letterSpacing: 8, paddingVertical: 14, textAlign: "center" },

  footerInfo: { flexDirection: "row", gap: 8, alignItems: "flex-start", paddingHorizontal: 4 },
  footerText: { fontSize: 12, color: C.textSecondary, flex: 1, lineHeight: 17 },
});

