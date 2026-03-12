/**
 * ExchangePanel — exibe posições abertas por exchange com todos os campos relevantes:
 * tempo aberto, margem usada, ROE, valor nocional, drawdown, liquidation price, funding acumulado.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;

export interface OpenPosition {
  id: string;
  exchange: string;
  symbol: string;
  side: "long" | "short" | "buy" | "sell";
  entryPrice: number;
  size: number;
  currentPrice?: number;
  pnl?: number;
  pnlPercent?: number;
  takeProfit?: number;
  stopLoss?: number;
  leverage?: number;
  liquidationPrice?: number;
  openedAt?: string | number;
  margin?: number;
  fundingFee?: number;
  notionalValue?: number;
  maxPrice?: number;
  minPrice?: number;
}

interface ApiKey {
  id: string;
  exchange: string;
  label?: string;
}

interface Props {
  symbol: string;
  onPlotPosition?: (pos: OpenPosition) => void;
  activePositions?: OpenPosition[];
  suggestedLeverage?: number | null;
  leverageRisk?: "low" | "medium" | "high" | null;
}

// ── Time since open ───────────────────────────────────────────────────────────

function formatTimeOpen(openedAt?: string | number): string {
  if (!openedAt) return "—";
  const opened = typeof openedAt === "string" ? new Date(openedAt).getTime() : openedAt;
  if (isNaN(opened)) return "—";
  const diff = Date.now() - opened;
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}min`;
  return `${mins}min`;
}

// ── ROE = PnL / Margin * 100 ─────────────────────────────────────────────────

function calcROE(pnl?: number, margin?: number): string {
  if (pnl == null || !margin || margin === 0) return "—";
  return `${((pnl / margin) * 100).toFixed(2)}%`;
}

// ── Drawdown ─────────────────────────────────────────────────────────────────

function calcDrawdown(pos: OpenPosition): string {
  const current = pos.currentPrice;
  const isLong = pos.side === "long" || pos.side === "buy";
  if (!current) return "—";
  if (isLong) {
    const peak = pos.maxPrice ?? Math.max(pos.entryPrice, current);
    if (peak <= 0) return "—";
    const dd = ((peak - current) / peak) * 100;
    return dd <= 0 ? "0.00%" : `-${dd.toFixed(2)}%`;
  } else {
    const trough = pos.minPrice ?? Math.min(pos.entryPrice, current);
    if (trough <= 0) return "—";
    const dd = ((current - trough) / trough) * 100;
    return dd <= 0 ? "0.00%" : `-${dd.toFixed(2)}%`;
  }
}

// ── Detail chip ───────────────────────────────────────────────────────────────

function DetailChip({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={[styles.chipValue, color ? { color } : undefined]}>{value}</Text>
    </View>
  );
}

export function ExchangePanel({
  symbol,
  onPlotPosition,
  activePositions = [],
  suggestedLeverage,
  leverageRisk,
}: Props) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [positions, setPositions] = useState<OpenPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null);
  const [plottedIds, setPlottedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [keysRes, posRes] = await Promise.all([
          apiRequest("GET", "/api/keys").then((r: any) => r.json()),
          apiRequest("GET", `/api/orders/open`).then((r: any) => r.json()),
        ]);

        if (!active) return;

        const keys: ApiKey[] = keysRes?.keys ?? keysRes ?? [];
        setApiKeys(keys);

        const orders = posRes?.orders ?? posRes ?? [];
        const mapped: OpenPosition[] = orders.map((o: any) => {
          const leverage = o.leverage ? parseFloat(o.leverage) : 1;
          const size = parseFloat(o.size ?? o.qty ?? o.quantity ?? 0);
          const entryPrice = parseFloat(o.entryPrice ?? o.price ?? 0);
          const notionalValue = size;
          const margin = o.margin ? parseFloat(o.margin) : (leverage > 0 ? notionalValue / leverage : notionalValue);

          return {
            id: o.id ?? o.clientOrderId ?? Math.random().toString(),
            exchange: o.exchange ?? "Unknown",
            symbol: o.symbol ?? symbol,
            side: o.side ?? o.direction ?? "buy",
            entryPrice,
            size,
            currentPrice: o.currentPrice ? parseFloat(o.currentPrice) : undefined,
            pnl: o.pnl ? parseFloat(o.pnl) : undefined,
            pnlPercent: o.pnlPercent ? parseFloat(o.pnlPercent) : undefined,
            takeProfit: o.takeProfit ? parseFloat(o.takeProfit) : undefined,
            stopLoss: o.stopLoss ? parseFloat(o.stopLoss) : undefined,
            leverage,
            liquidationPrice: o.liquidationPrice ? parseFloat(o.liquidationPrice) : undefined,
            openedAt: o.openedAt ?? o.createdAt ?? o.timestamp,
            margin,
            fundingFee: o.fundingFee ? parseFloat(o.fundingFee) : undefined,
            notionalValue,
            maxPrice: o.maxPrice ? parseFloat(o.maxPrice) : undefined,
            minPrice: o.minPrice ? parseFloat(o.minPrice) : undefined,
          };
        });

        setPositions(mapped);
        if (keys.length > 0 && !selectedExchange) {
          setSelectedExchange(keys[0].exchange);
        }
      } catch {
        // Fail silently
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 30_000);
    return () => { active = false; clearInterval(interval); };
  }, [symbol]);

  const exchanges = useMemo(
    () => [...new Set([...apiKeys.map(k => k.exchange), ...positions.map(p => p.exchange)])],
    [apiKeys, positions]
  );

  const filteredPositions = useMemo(() =>
    positions.filter(p =>
      (!selectedExchange || p.exchange === selectedExchange) &&
      p.symbol.toUpperCase().replace(/USDT$/, "").includes(symbol.replace(/USDT$/, ""))
    ),
    [positions, selectedExchange, symbol]
  );

  const handlePlot = useCallback((pos: OpenPosition) => {
    setPlottedIds(prev => {
      const next = new Set(prev);
      if (next.has(pos.id)) next.delete(pos.id);
      else next.add(pos.id);
      return next;
    });
    onPlotPosition?.(pos);
  }, [onPlotPosition]);

  const leverageColor =
    leverageRisk === "low" ? "#22c55e" :
    leverageRisk === "medium" ? "#f59e0b" :
    leverageRisk === "high" ? "#ef4444" : "#6b7280";

  return (
    <View style={styles.container}>
      {/* Header with suggested leverage */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Posições Abertas</Text>
        {suggestedLeverage != null && (
          <View style={[styles.levBadge, { borderColor: `${leverageColor}60` }]}>
            <Ionicons name="shield-outline" size={11} color={leverageColor} />
            <Text style={[styles.levBadgeText, { color: leverageColor }]}>
              Lev. sugerida: {suggestedLeverage}×
            </Text>
          </View>
        )}
      </View>

      {/* Exchange tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.exchangeTabs}>
        {exchanges.length === 0 && !loading && (
          <Text style={styles.noExchanges}>Nenhuma exchange conectada</Text>
        )}
        {exchanges.map(ex => {
          const count = positions.filter(p => p.exchange === ex).length;
          return (
            <TouchableOpacity
              key={ex}
              style={[styles.exTab, selectedExchange === ex && styles.exTabActive]}
              onPress={() => setSelectedExchange(ex)}
            >
              <Text style={[styles.exTabText, selectedExchange === ex && styles.exTabTextActive]}>
                {ex.charAt(0).toUpperCase() + ex.slice(1)}
              </Text>
              <View style={[styles.posCount, { backgroundColor: selectedExchange === ex ? "#f59e0b" : "#374151" }]}>
                <Text style={[styles.posCountText, { color: selectedExchange === ex ? "#000" : "#9ca3af" }]}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Positions list */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.primary} size="small" />
        </View>
      ) : filteredPositions.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Sem posições abertas para {symbol}</Text>
          <Text style={styles.emptySubtext}>nas exchanges conectadas</Text>
        </View>
      ) : (
        <ScrollView style={styles.posList} showsVerticalScrollIndicator={false}>
          {filteredPositions.map(pos => {
            const isLong = pos.side === "long" || pos.side === "buy";
            const sideColor = isLong ? "#22c55e" : "#ef4444";
            const plotted = plottedIds.has(pos.id);
            const hasPnL = pos.pnl !== undefined;
            const expanded = expandedId === pos.id;

            const margin = pos.margin ?? (pos.leverage && pos.leverage > 0 ? pos.size / pos.leverage : pos.size);
            const roe = calcROE(pos.pnl, margin);
            const timeOpen = formatTimeOpen(pos.openedAt);
            const drawdown = calcDrawdown(pos);
            const pnlPositive = (pos.pnl ?? 0) >= 0;

            return (
              <TouchableOpacity
                key={pos.id}
                style={styles.posCard}
                onPress={() => setExpandedId(expanded ? null : pos.id)}
                activeOpacity={0.85}
              >
                <View style={[styles.sideBar, { backgroundColor: sideColor }]} />
                <View style={styles.posMain}>

                  {/* Header row */}
                  <View style={styles.posHeader}>
                    <Text style={styles.posSymbol}>{pos.symbol}</Text>
                    <Text style={[styles.posSide, { color: sideColor }]}>
                      {isLong ? "▲ LONG" : "▼ SHORT"}
                      {pos.leverage && pos.leverage > 1 ? (
                        <Text style={[styles.leverageTag, { color: sideColor }]}> {pos.leverage}×</Text>
                      ) : null}
                    </Text>
                    <View style={styles.timeOpenBadge}>
                      <Ionicons name="time-outline" size={9} color="#6b7280" />
                      <Text style={styles.timeOpenText}>{timeOpen}</Text>
                    </View>
                    <Text style={styles.posExchange}>{pos.exchange}</Text>
                  </View>

                  {/* Primary metrics row */}
                  <View style={styles.metricsRow}>
                    <DetailChip label="Entry" value={`$${pos.entryPrice.toLocaleString("en-US", { maximumFractionDigits: 4 })}`} />
                    <DetailChip label="Nocional" value={`$${(pos.notionalValue ?? pos.size).toFixed(2)}`} />
                    <DetailChip label="Margem" value={`$${margin.toFixed(2)}`} />
                    {hasPnL && (
                      <DetailChip
                        label="PnL"
                        value={`${pos.pnl! >= 0 ? "+" : ""}${pos.pnl!.toFixed(2)}`}
                        color={pnlPositive ? "#22c55e" : "#ef4444"}
                      />
                    )}
                    {hasPnL && pos.pnlPercent !== undefined && (
                      <DetailChip
                        label="PnL %"
                        value={`${pos.pnlPercent >= 0 ? "+" : ""}${pos.pnlPercent.toFixed(2)}%`}
                        color={pos.pnlPercent >= 0 ? "#22c55e" : "#ef4444"}
                      />
                    )}
                    <DetailChip label="ROE" value={roe} color={roe !== "—" ? (roe.startsWith("-") ? "#ef4444" : "#22c55e") : undefined} />
                  </View>

                  {/* Expanded section */}
                  {expanded && (
                    <View style={styles.expandedSection}>
                      <View style={styles.metricsRow}>
                        {pos.takeProfit && (
                          <DetailChip label="TP" value={`$${pos.takeProfit.toLocaleString()}`} color="#22c55e" />
                        )}
                        {pos.stopLoss && (
                          <DetailChip label="SL" value={`$${pos.stopLoss.toLocaleString()}`} color="#ef4444" />
                        )}
                        {pos.liquidationPrice && (
                          <DetailChip label="Liquidação" value={`$${pos.liquidationPrice.toLocaleString("en-US", { maximumFractionDigits: 2 })}`} color="#f97316" />
                        )}
                        <DetailChip label="Drawdown" value={drawdown} color={drawdown !== "0.00%" && drawdown !== "—" ? "#ef4444" : "#22c55e"} />
                        {pos.fundingFee !== undefined && (
                          <DetailChip
                            label="Funding Acum."
                            value={`${pos.fundingFee >= 0 ? "+" : ""}${pos.fundingFee.toFixed(4)}`}
                            color={pos.fundingFee >= 0 ? "#22c55e" : "#ef4444"}
                          />
                        )}
                        {pos.currentPrice && (
                          <DetailChip label="Preço atual" value={`$${pos.currentPrice.toLocaleString("en-US", { maximumFractionDigits: 4 })}`} />
                        )}
                      </View>
                    </View>
                  )}

                  {/* Expand indicator */}
                  <View style={styles.expandHint}>
                    <Ionicons
                      name={expanded ? "chevron-up-outline" : "chevron-down-outline"}
                      size={12}
                      color="#374151"
                    />
                  </View>
                </View>

                {/* Plot button */}
                <TouchableOpacity
                  style={[styles.plotBtn, plotted && styles.plotBtnActive]}
                  onPress={() => handlePlot(pos)}
                >
                  <Ionicons
                    name={plotted ? "eye" : "eye-outline"}
                    size={14}
                    color={plotted ? "#f59e0b" : "#6b7280"}
                  />
                  <Text style={[styles.plotText, plotted && styles.plotTextActive]}>
                    {plotted ? "On" : "Plot"}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#111827",
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
    maxHeight: 340,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerTitle: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  levBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#0d1117",
  },
  levBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  exchangeTabs: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  noExchanges: {
    color: "#4b5563",
    fontSize: 12,
    paddingVertical: 4,
  },
  exTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
  },
  exTabActive: {
    borderColor: "#f59e0b",
    backgroundColor: "#f59e0b14",
  },
  exTabText: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "500",
  },
  exTabTextActive: {
    color: "#f59e0b",
    fontWeight: "700",
  },
  posCount: {
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  posCountText: {
    fontSize: 9,
    fontWeight: "800",
  },
  center: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  emptyText: {
    color: "#4b5563",
    fontSize: 13,
  },
  emptySubtext: {
    color: "#374151",
    fontSize: 11,
  },
  posList: {
    flex: 1,
  },
  posCard: {
    flexDirection: "row",
    marginHorizontal: 10,
    marginVertical: 4,
    backgroundColor: "#1a2332",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  sideBar: {
    width: 3,
  },
  posMain: {
    flex: 1,
    padding: 9,
    gap: 7,
  },
  posHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  posSymbol: {
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "700",
  },
  posSide: {
    fontSize: 11,
    fontWeight: "700",
  },
  leverageTag: {
    fontSize: 11,
    fontWeight: "900",
  },
  timeOpenBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "#111827",
    borderRadius: 6,
  },
  timeOpenText: {
    color: "#6b7280",
    fontSize: 9,
    fontWeight: "600",
  },
  posExchange: {
    marginLeft: "auto" as any,
    color: "#374151",
    fontSize: 9,
    fontWeight: "600",
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 4,
    backgroundColor: "#111827",
    borderRadius: 6,
    gap: 1,
    minWidth: 52,
  },
  chipLabel: {
    color: "#374151",
    fontSize: 8,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  chipValue: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "700",
  },
  expandedSection: {
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
    paddingTop: 7,
  },
  expandHint: {
    alignItems: "center",
    marginTop: -2,
  },
  plotBtn: {
    alignSelf: "center",
    padding: 10,
    alignItems: "center",
    gap: 3,
  },
  plotBtnActive: {},
  plotText: {
    color: "#6b7280",
    fontSize: 9,
  },
  plotTextActive: {
    color: "#f59e0b",
    fontWeight: "700",
  },
});
