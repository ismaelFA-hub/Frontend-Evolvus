import { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import {
  getExchangeConnections,
  getApiCallLogs,
  getGeopoliticalRisk,
  type ExchangeConnection,
  type ApiCallLog,
  type GeopoliticalRisk,
} from "@/lib/quantum-engine";

const C = Colors.dark;

/** Brand colors for the 15 supported exchanges */
const EXCHANGE_BRAND: Record<string, string> = {
  "binance":    "#F0B90B",
  "bybit":      "#F7931A",
  "okx":        "#3773F5",
  "coinbase":   "#0052FF",
  "coinbasepro":"#0052FF",
  "kraken":     "#5741D9",
  "kucoin":     "#23AF91",
  "gate.io":    "#E72266",
  "gateio":     "#E72266",
  "mexc":       "#00B4D8",
  "bitget":     "#1DA2B4",
  "htx":        "#347AF0",
  "huobi":      "#347AF0",
  "crypto.com": "#002D74",
  "cryptocom":  "#002D74",
  "bingx":      "#0B6BFF",
  "bitfinex":   "#16B157",
  "phemex":     "#FF6B35",
  "gemini":     "#00DCFA",
};

function getExchangeBrand(name: string): string {
  return EXCHANGE_BRAND[name.toLowerCase().replace(/[\s.]/g, "")] ??
         EXCHANGE_BRAND[name.toLowerCase()] ??
         "#6B7280";
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={sh.wrapper}>
      <Text style={sh.title}>{title}</Text>
      {subtitle ? <Text style={sh.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}
const sh = StyleSheet.create({
  wrapper:  { marginBottom: 12 },
  title:    { fontFamily: "Inter_700Bold", fontSize: 16, color: C.text },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginTop: 2 },
});

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "connected" || status === "healthy"
      ? C.success
      : status === "syncing" || status === "degraded"
      ? C.warning
      : C.danger;
  const bg =
    status === "connected" || status === "healthy"
      ? C.successDim
      : status === "syncing" || status === "degraded"
      ? C.warningDim
      : C.dangerDim;
  const label =
    status === "connected"  ? "Conectado"     :
    status === "syncing"    ? "Sincronizando" :
    status === "degraded"   ? "Degradado"     :
    status === "healthy"    ? "Saudável"      : "Erro";
  return (
    <View style={[stb.badge, { backgroundColor: bg }]}>
      <View style={[stb.dot, { backgroundColor: color }]} />
      <Text style={[stb.label, { color }]}>{label}</Text>
    </View>
  );
}
const stb = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  dot:   { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
});

function LatencyBar({ latency }: { latency: number }) {
  const max   = 500;
  const pct   = Math.min((latency / max) * 100, 100);
  const color = latency < 100 ? C.success : latency < 250 ? C.warning : C.danger;
  return (
    <View style={lb.wrapper}>
      <View style={lb.track}>
        <View style={[lb.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[lb.value, { color }]}>{latency}ms</Text>
    </View>
  );
}
const lb = StyleSheet.create({
  wrapper: { flexDirection: "row", alignItems: "center", gap: 8 },
  track:   { flex: 1, height: 4, backgroundColor: C.border, borderRadius: 2, overflow: "hidden" },
  fill:    { height: "100%", borderRadius: 2 },
  value:   { fontFamily: "Inter_600SemiBold", fontSize: 11, width: 48, textAlign: "right" },
});

function UptimeRing({ uptime }: { uptime: number }) {
  const color = uptime >= 99 ? C.success : uptime >= 95 ? C.warning : C.danger;
  return (
    <View style={ur.wrapper}>
      <Text style={[ur.value, { color }]}>{uptime.toFixed(1)}%</Text>
      <Text style={ur.label}>uptime</Text>
    </View>
  );
}
const ur = StyleSheet.create({
  wrapper: { alignItems: "center" },
  value:   { fontFamily: "Inter_700Bold", fontSize: 14 },
  label:   { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textTertiary, marginTop: 1 },
});

function ExchangeCard({
  exchange,
  primary,
  onPress,
  expanded,
}: {
  exchange: ExchangeConnection;
  primary: string;
  onPress: () => void;
  expanded: boolean;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: expanded ? 1 : 0,
      duration: 250,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [expanded]);

  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });

  const permColors: Record<string, string> = {
    read:     C.success,
    trade:    "#7B61FF",
    withdraw: C.danger,
  };

  const rateLimitEntries = useMemo(() => {
    if (exchange.rateLimitUsed == null && exchange.rateLimitMax == null) return [];
    return [
      ["used", exchange.rateLimitUsed],
      ["max", exchange.rateLimitMax],
    ].filter(([, v]) => v !== undefined);
  }, [exchange.rateLimitUsed, exchange.rateLimitMax]);

  const permissions = useMemo(() => {
    if (!Array.isArray(exchange.permissions)) return [];
    return exchange.permissions;
  }, [exchange.permissions]);

  return (
    <View style={[ec.card, expanded && { borderColor: `${primary}40` }]}>
      <Pressable
        onPress={() => { Haptics.selectionAsync(); onPress(); }}
        style={ec.header}
      >
        <View style={ec.left}>
          <View style={[ec.iconWrap, { backgroundColor: `${primary}15` }]}>
            <Ionicons name="swap-horizontal" size={18} color={primary} />
          </View>
          <View style={ec.info}>
            <Text style={ec.name}>{exchange.exchange ?? "—"}</Text>
            <Text style={ec.env}>mainnet</Text>
          </View>
        </View>
        <View style={ec.right}>
          <StatusBadge status={exchange.status ?? "error"} />
          <Animated.View style={{ transform: [{ rotate }], marginLeft: 8 }}>
            <Ionicons name="chevron-down" size={16} color={C.textSecondary} />
          </Animated.View>
        </View>
      </Pressable>

      {expanded && (
        <View style={ec.body}>
          <View style={ec.metricsRow}>
            <View style={ec.metricBlock}>
              <Text style={ec.metricLabel}>Latência</Text>
              <LatencyBar latency={exchange.latencyMs ?? 0} />
            </View>
            <UptimeRing uptime={exchange.uptime ?? 0} />
          </View>

          {rateLimitEntries.length > 0 && (
            <>
              <View style={ec.divider} />
              <Text style={ec.sectionLabel}>Rate Limits</Text>
              <View style={ec.rateLimitsRow}>
                {rateLimitEntries.map(([key, val]) => (
                  <View key={String(key)} style={[ec.rateChip, { backgroundColor: `${primary}15` }]}>
                    <Text style={[ec.rateKey, { color: primary }]}>{String(key)}</Text>
                    <Text style={ec.rateVal}>{String(val)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {permissions.length > 0 && (
            <>
              <View style={ec.divider} />
              <Text style={ec.sectionLabel}>Permissões</Text>
              <View style={ec.permsRow}>
                {permissions.map((perm) => (
                  <View
                    key={perm}
                    style={[
                      ec.permBadge,
                      { backgroundColor: `${permColors[perm] ?? C.textSecondary}20` },
                    ]}
                  >
                    <Text style={[ec.permText, { color: permColors[perm] ?? C.textSecondary }]}>
                      {perm}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={ec.divider} />
          <View style={ec.syncRow}>
            <Ionicons name="time-outline" size={13} color={C.textTertiary} />
            <Text style={ec.syncText}>
              Última sincronização: {exchange.lastSuccessfulCall ?? "—"}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
const ec = StyleSheet.create({
  card:         { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 10, overflow: "hidden" },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  left:         { flexDirection: "row", alignItems: "center", gap: 10 },
  iconWrap:     { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  info:         { gap: 2 },
  name:         { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  env:          { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, textTransform: "capitalize" },
  right:        { flexDirection: "row", alignItems: "center" },
  body:         { paddingHorizontal: 14, paddingBottom: 14 },
  metricsRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  metricBlock:  { flex: 1, gap: 6 },
  metricLabel:  { fontFamily: "Inter_500Medium", fontSize: 11, color: C.textSecondary },
  divider:      { height: 1, backgroundColor: C.border, marginVertical: 10 },
  sectionLabel: { fontFamily: "Inter_500Medium", fontSize: 11, color: C.textSecondary, marginBottom: 8 },
  rateLimitsRow:{ flexDirection: "row", flexWrap: "wrap", gap: 6 },
  rateChip:     { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  rateKey:      { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  rateVal:      { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textSecondary },
  permsRow:     { flexDirection: "row", gap: 6 },
  permBadge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  permText:     { fontFamily: "Inter_600SemiBold", fontSize: 11, textTransform: "capitalize" },
  syncRow:      { flexDirection: "row", alignItems: "center", gap: 5 },
  syncText:     { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
});

function LogItem({ log, primary }: { log: ApiCallLog; primary: string }) {
  const statusCode  = log.statusCode ?? 0;
  const isSuccess   = statusCode > 0 && statusCode < 400;
  const color = isSuccess ? C.success : C.danger;
  const bg    = isSuccess ? C.successDim : C.dangerDim;
  const code  = statusCode > 0 ? String(statusCode) : "ERR";

  return (
    <View style={li.row}>
      <View style={[li.statusDot, { backgroundColor: color }]} />
      <View style={li.info}>
        <Text style={li.endpoint} numberOfLines={1}>
          {log.endpoint ?? log.method ?? "API Call"}
        </Text>
        <Text style={li.meta}>
          {log.exchange ?? "—"} · {log.timestamp ?? "—"}
        </Text>
      </View>
      <View style={li.right}>
        <View style={[li.codeBadge, { backgroundColor: bg }]}>
          <Text style={[li.code, { color }]}>{code}</Text>
        </View>
        {log.responseTimeMs != null && (
          <Text style={li.latency}>{log.responseTimeMs}ms</Text>
        )}
      </View>
    </View>
  );
}
const li = StyleSheet.create({
  row:       { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, gap: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  info:      { flex: 1 },
  endpoint:  { fontFamily: "Inter_500Medium", fontSize: 12, color: C.text },
  meta:      { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, marginTop: 2 },
  right:     { alignItems: "flex-end", gap: 3 },
  codeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  code:      { fontFamily: "Inter_700Bold", fontSize: 11 },
  latency:   { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textTertiary },
});

function GeoRiskCard({ item }: { item: GeopoliticalRisk }) {
  const riskLevel   = item.riskLevel ?? "low";
  const description = item.advisoryPt ?? item.advisory ?? null;
  const levelColor  =
    riskLevel === "low" || riskLevel === "very_low" ? C.success :
    riskLevel === "medium" ? C.warning : C.danger;
  const levelLabel  =
    riskLevel === "very_low" ? "Muito Baixo" :
    riskLevel === "low"      ? "Baixo"  :
    riskLevel === "medium"   ? "Médio"  :
    riskLevel === "high"     ? "Alto"   : "Muito Alto";

  return (
    <View style={gr.card}>
      <View style={gr.top}>
        <View style={gr.left}>
          <Text style={gr.exchange}>{item.exchange ?? "Global"}</Text>
          <Text style={gr.region}>Global</Text>
        </View>
        <View style={[gr.levelBadge, { backgroundColor: `${levelColor}20` }]}>
          <Text style={[gr.levelText, { color: levelColor }]}>{levelLabel}</Text>
        </View>
      </View>
      {description && (
        <Text style={gr.desc} numberOfLines={2}>{description}</Text>
      )}
    </View>
  );
}
const gr = StyleSheet.create({
  card:       { backgroundColor: C.surface, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  top:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  left:       { gap: 2 },
  exchange:   { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text },
  region:     { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  levelBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  levelText:  { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  desc:       { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, lineHeight: 17 },
});

function MetricCard({
  label,
  value,
  icon,
  color,
  bg,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
}) {
  return (
    <View style={[mc.card, { borderColor: `${color}30` }]}>
      <View style={[mc.iconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={mc.value}>{value}</Text>
      <Text style={mc.label}>{label}</Text>
    </View>
  );
}
const mc = StyleSheet.create({
  card:     { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 14, alignItems: "center", gap: 6, borderWidth: 1 },
  iconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  value:    { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text },
  label:    { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary, textAlign: "center" },
});

const TABS = [
  { key: "exchanges", label: "Exchanges", icon: "swap-horizontal"  as const },
  { key: "logs",      label: "Logs",      icon: "list"             as const },
  { key: "geo",       label: "Geo Risk",  icon: "globe-outline"    as const },
] as const;
type TabKey = typeof TABS[number]["key"];

export default function ApiHealthScreen() {
  const insets      = useSafeAreaInsets();
  const { planTheme } = usePlanTheme();
  const { t }       = useI18n();
  const { user }    = useAuth();
  const primary     = planTheme.primary;
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const [activeTab, setActiveTab] = useState<TabKey>("exchanges");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const exchanges = useMemo(() => getExchangeConnections(), []);
  const logs      = useMemo(() => getApiCallLogs(), []);
  const geoRisks  = useMemo(() => getGeopoliticalRisk(), []);

  const totalExchanges = exchanges.length;
  const connectedCount = exchanges.filter(
    (e) => e.status === "connected"
  ).length;
  const avgLatency = exchanges.length > 0
    ? Math.round(exchanges.reduce((sum, e) => sum + (e.latencyMs ?? 0), 0) / exchanges.length)
    : 0;
  const avgUptime = exchanges.length > 0
    ? exchanges.reduce((sum, e) => sum + (e.uptime ?? 0), 0) / exchanges.length
    : 0;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, []);

  const handleTabChange = (key: TabKey) => {
    Haptics.selectionAsync();
    setActiveTab(key);
  };

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      setLastRefresh(new Date());
    }, 1200);
  };

  const handleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const errorLogs = logs.filter(
    (l) => l.statusCode != null && l.statusCode >= 400
  );

  return (
    <View style={[s.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>API Health</Text>
          <Text style={s.headerSub}>
            Atualizado às{" "}
            {lastRefresh.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
        <Pressable
          onPress={handleRefresh}
          style={[s.refreshBtn, { backgroundColor: `${primary}15`, borderColor: `${primary}30` }]}
        >
          <Ionicons name={refreshing ? "sync" : "refresh"} size={18} color={primary} />
        </Pressable>
      </View>

      <Animated.View style={[s.metricsRow, { opacity: fadeAnim }]}>
        <MetricCard
          label="Conectadas"
          value={`${connectedCount}/${totalExchanges}`}
          icon="checkmark-circle"
          color={C.success}
          bg={C.successDim}
        />
        <MetricCard
          label="Latência Média"
          value={`${avgLatency}ms`}
          icon="speedometer-outline"
          color={avgLatency < 150 ? C.success : avgLatency < 300 ? C.warning : C.danger}
          bg={avgLatency < 150 ? C.successDim : avgLatency < 300 ? C.warningDim : C.dangerDim}
        />
        <MetricCard
          label="Uptime Médio"
          value={`${avgUptime.toFixed(1)}%`}
          icon="pulse-outline"
          color={avgUptime >= 99 ? C.success : avgUptime >= 95 ? C.warning : C.danger}
          bg={avgUptime >= 99 ? C.successDim : avgUptime >= 95 ? C.warningDim : C.dangerDim}
        />
      </Animated.View>

      {errorLogs.length > 0 && (
        <View style={[s.alertStrip, { backgroundColor: C.dangerDim, borderColor: `${C.danger}40` }]}>
          <Ionicons name="warning" size={14} color={C.danger} />
          <Text style={s.alertText}>
            {errorLogs.length} erro{errorLogs.length > 1 ? "s" : ""} detectado{errorLogs.length > 1 ? "s" : ""} nos logs de API
          </Text>
        </View>
      )}

      <View style={[s.tabBar, { borderColor: C.border }]}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => handleTabChange(tab.key)}
              style={[s.tab, active && { borderBottomColor: primary }]}
            >
              <Ionicons
                name={tab.icon}
                size={15}
                color={active ? primary : C.textSecondary}
              />
              <Text style={[s.tabLabel, { color: active ? primary : C.textSecondary }]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "exchanges" && (
          <View>
            <SectionHeader
              title="Conexões de Exchange"
              subtitle="Toque para expandir detalhes"
            />
            {exchanges.map((ex, idx) => {
              const id = `${ex.exchange ?? idx}-${idx}`;
              const brand = getExchangeBrand(ex.exchange ?? "");
              return (
                <ExchangeCard
                  key={id}
                  exchange={ex}
                  primary={brand}
                  expanded={expandedId === id}
                  onPress={() => handleExpand(id)}
                />
              );
            })}
          </View>
        )}

        {activeTab === "logs" && (
          <View>
            <SectionHeader
              title="Logs de Chamadas API"
              subtitle={`${logs.length} registros recentes`}
            />
            <View style={s.logsCard}>
              {logs.map((log, idx) => (
                <LogItem key={idx} log={log} primary={primary} />
              ))}
            </View>

            <View style={s.logStatsRow}>
              <View style={[s.logStat, { backgroundColor: C.successDim, borderColor: `${C.success}30` }]}>
                <Text style={[s.logStatVal, { color: C.success }]}>
                  {logs.filter(
                    (l) => l.statusCode != null && l.statusCode < 400 && l.statusCode > 0
                  ).length}
                </Text>
                <Text style={s.logStatLabel}>Sucesso</Text>
              </View>
              <View style={[s.logStat, { backgroundColor: C.dangerDim, borderColor: `${C.danger}30` }]}>
                <Text style={[s.logStatVal, { color: C.danger }]}>{errorLogs.length}</Text>
                <Text style={s.logStatLabel}>Erros</Text>
              </View>
              <View style={[s.logStat, { backgroundColor: `${primary}15`, borderColor: `${primary}30` }]}>
                <Text style={[s.logStatVal, { color: primary }]}>
                  {logs.length > 0
                    ? Math.round(
                        logs.reduce((sum, l) => sum + (l.responseTimeMs ?? 0), 0) / logs.length
                      )
                    : 0}ms
                </Text>
                <Text style={s.logStatLabel}>Latência Média</Text>
              </View>
            </View>
          </View>
        )}

        {activeTab === "geo" && (
          <View>
            <SectionHeader
              title="Risco Geopolítico"
              subtitle="Monitoramento de risco por região e exchange"
            />
            {geoRisks.map((item, idx) => (
              <GeoRiskCard key={idx} item={item} />
            ))}
            <View style={[s.geoSummary, { borderColor: `${primary}30`, backgroundColor: `${primary}08` }]}>
              <Ionicons name="information-circle-outline" size={16} color={primary} />
              <Text style={[s.geoSummaryText, { color: C.textSecondary }]}>
                Risco geopolítico pode afetar liquidez e disponibilidade das exchanges em
                determinadas regiões. Mantenha exchanges de backup configuradas.
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.background },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, paddingTop: 8 },
  headerTitle:  { fontFamily: "Inter_700Bold", fontSize: 22, color: C.text },
  headerSub:    { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary, marginTop: 2 },
  refreshBtn:   { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  metricsRow:   { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  alertStrip:   { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  alertText:    { fontFamily: "Inter_500Medium", fontSize: 12, color: C.danger, flex: 1 },
  tabBar:       { flexDirection: "row", borderBottomWidth: 1, marginHorizontal: 16, marginBottom: 16 },
  tab:          { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabLabel:     { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  scroll:       { flex: 1 },
  scrollContent:{ paddingHorizontal: 16, paddingBottom: 20 },
  logsCard:     { backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: C.border, marginBottom: 12 },
  logStatsRow:  { flexDirection: "row", gap: 8 },
  logStat:      { flex: 1, borderRadius: 12, padding: 12, alignItems: "center", gap: 4, borderWidth: 1 },
  logStatVal:   { fontFamily: "Inter_700Bold", fontSize: 20 },
  logStatLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary },
  geoSummary:   { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 4 },
  geoSummaryText:{ fontFamily: "Inter_400Regular", fontSize: 12, flex: 1, lineHeight: 18 },
});
