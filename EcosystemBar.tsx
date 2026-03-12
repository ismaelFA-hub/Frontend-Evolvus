/**
 * EcosystemBar — Barra de acesso rápido ao ecossistema de bots e serviços.
 * Aparece abaixo do ModeSelector na tela de ativo.
 * Cada botão abre um modal de configuração pré-preenchido com o símbolo atual.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;

interface EcosystemButton {
  id: string;
  label: string;
  icon: string;
  color: string;
  category: "bot" | "arbitrage" | "social" | "simulation";
  premium?: boolean;
  subItems?: { id: string; label: string }[];
}

const ECOSYSTEM_BUTTONS: EcosystemButton[] = [
  { id: "grid", label: "Grid", icon: "grid-outline", color: "#06b6d4", category: "bot" },
  { id: "dca", label: "DCA", icon: "layers-outline", color: "#06b6d4", category: "bot" },
  { id: "martingale", label: "Martingale", icon: "trending-down-outline", color: "#06b6d4", category: "bot" },
  { id: "grid_evo", label: "Grid Evo", icon: "leaf-outline", color: "#8b5cf6", category: "bot", premium: true },
  { id: "dca_smart", label: "DCA+", icon: "flash-outline", color: "#8b5cf6", category: "bot", premium: true },
  {
    id: "arbitrage", label: "Arbitragem", icon: "swap-horizontal-outline", color: "#f59e0b", category: "arbitrage",
    subItems: [
      { id: "arb_cross", label: "Cross-Exchange" },
      { id: "arb_triangular", label: "Triangular" },
      { id: "arb_funding", label: "Funding Rate" },
    ],
  },
  { id: "paper", label: "Paper Trade", icon: "document-text-outline", color: "#22c55e", category: "simulation" },
  { id: "copy", label: "Copy Trade", icon: "people-outline", color: "#22c55e", category: "social" },
];

interface BotModalProps {
  botId: string;
  symbol: string;
  price: number;
  onClose: () => void;
}

function BotConfigModal({ botId, symbol, price, onClose }: BotModalProps) {
  const [gridLower, setGridLower] = useState(String((price * 0.95).toFixed(2)));
  const [gridUpper, setGridUpper] = useState(String((price * 1.05).toFixed(2)));
  const [gridCount, setGridCount] = useState("10");
  const [dcaDrop, setDcaDrop] = useState("3");
  const [dcaOrders, setDcaOrders] = useState("5");
  const [investment, setInvestment] = useState("100");
  const [loading, setLoading] = useState(false);

  const botConfig: Record<string, { title: string; icon: string; color: string }> = {
    grid: { title: "Grid Bot", icon: "grid-outline", color: "#06b6d4" },
    dca: { title: "DCA Bot", icon: "layers-outline", color: "#06b6d4" },
    martingale: { title: "Martingale Bot", icon: "trending-down-outline", color: "#06b6d4" },
    grid_evo: { title: "Grid Evolutivo", icon: "leaf-outline", color: "#8b5cf6" },
    dca_smart: { title: "DCA Inteligente", icon: "flash-outline", color: "#8b5cf6" },
    paper: { title: "Paper Trade", icon: "document-text-outline", color: "#22c55e" },
    copy: { title: "Copy Trade", icon: "people-outline", color: "#22c55e" },
  };

  const cfg = botConfig[botId] ?? { title: botId, icon: "rocket-outline", color: "#f59e0b" };

  const handleStart = async () => {
    setLoading(true);
    try {
      await apiRequest("POST", "/api/bots/start", {
        type: botId,
        symbol,
        config: {
          investment: parseFloat(investment),
          gridLower: parseFloat(gridLower),
          gridUpper: parseFloat(gridUpper),
          gridCount: parseInt(gridCount),
          dcaDrop: parseFloat(dcaDrop),
          dcaOrders: parseInt(dcaOrders),
        },
      });
    } catch {}
    setLoading(false);
    onClose();
  };

  const isGrid = botId === "grid" || botId === "grid_evo";
  const isDca = botId === "dca" || botId === "dca_smart";

  return (
    <Modal visible transparent animationType="slide">
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={e => e.stopPropagation()}>
          <View style={s.handle} />

          <View style={s.sheetHeader}>
            <View style={[s.sheetIcon, { backgroundColor: `${cfg.color}22` }]}>
              <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.sheetTitle}>{cfg.title}</Text>
              <Text style={s.sheetSymbol}>{symbol} · Preço atual: ${price.toLocaleString("en-US", { maximumFractionDigits: 4 })}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View style={s.fields}>
            <View style={s.fieldRow}>
              <Text style={s.fieldLabel}>Investimento (USDT)</Text>
              <TextInput style={s.input} value={investment} onChangeText={setInvestment} keyboardType="numeric" placeholderTextColor="#4b5563" />
            </View>

            {isGrid && (
              <>
                <View style={s.fieldRow}>
                  <Text style={s.fieldLabel}>Limite Inferior ($)</Text>
                  <TextInput style={s.input} value={gridLower} onChangeText={setGridLower} keyboardType="numeric" placeholderTextColor="#4b5563" />
                </View>
                <View style={s.fieldRow}>
                  <Text style={s.fieldLabel}>Limite Superior ($)</Text>
                  <TextInput style={s.input} value={gridUpper} onChangeText={setGridUpper} keyboardType="numeric" placeholderTextColor="#4b5563" />
                </View>
                <View style={s.fieldRow}>
                  <Text style={s.fieldLabel}>Número de Grids</Text>
                  <TextInput style={s.input} value={gridCount} onChangeText={setGridCount} keyboardType="numeric" placeholderTextColor="#4b5563" />
                </View>
              </>
            )}

            {isDca && (
              <>
                <View style={s.fieldRow}>
                  <Text style={s.fieldLabel}>Queda por ordem (%)</Text>
                  <TextInput style={s.input} value={dcaDrop} onChangeText={setDcaDrop} keyboardType="numeric" placeholderTextColor="#4b5563" />
                </View>
                <View style={s.fieldRow}>
                  <Text style={s.fieldLabel}>Número de ordens</Text>
                  <TextInput style={s.input} value={dcaOrders} onChangeText={setDcaOrders} keyboardType="numeric" placeholderTextColor="#4b5563" />
                </View>
              </>
            )}
          </View>

          <TouchableOpacity
            style={[s.startBtn, { backgroundColor: cfg.color, opacity: loading ? 0.7 : 1 }]}
            onPress={handleStart}
            disabled={loading}
          >
            <Ionicons name="rocket-outline" size={16} color="#000" />
            <Text style={s.startBtnText}>{loading ? "Iniciando..." : "Iniciar Bot"}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ArbitrageModal({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const [subType, setSubType] = useState<"cross" | "triangular" | "funding">("cross");

  const types = [
    { id: "cross" as const, label: "Cross-Exchange", desc: "Spread entre 30 exchanges" },
    { id: "triangular" as const, label: "Triangular", desc: "Intra-exchange 3 pares" },
    { id: "funding" as const, label: "Funding Rate", desc: "Delta-neutral perpétuo" },
  ];

  return (
    <Modal visible transparent animationType="slide">
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={e => e.stopPropagation()}>
          <View style={s.handle} />
          <View style={s.sheetHeader}>
            <View style={[s.sheetIcon, { backgroundColor: "#f59e0b22" }]}>
              <Ionicons name="swap-horizontal-outline" size={20} color="#f59e0b" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.sheetTitle}>Arbitragem</Text>
              <Text style={s.sheetSymbol}>{symbol}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View style={s.arbTypes}>
            {types.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[s.arbTypeBtn, subType === t.id && s.arbTypeBtnActive]}
                onPress={() => setSubType(t.id)}
              >
                <Text style={[s.arbTypeLabel, subType === t.id && s.arbTypeLabelActive]}>{t.label}</Text>
                <Text style={s.arbTypeDesc}>{t.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={[s.startBtn, { backgroundColor: "#f59e0b" }]} onPress={onClose}>
            <Ionicons name="rocket-outline" size={16} color="#000" />
            <Text style={s.startBtnText}>Iniciar Arbitragem {types.find(t => t.id === subType)?.label}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface Props {
  symbol: string;
  currentPrice: number;
  userPlan?: string;
  mode?: "bar" | "sheet";
  sheetVisible?: boolean;
  onSheetClose?: () => void;
}

export function EcosystemBar({
  symbol,
  currentPrice,
  userPlan = "free",
  mode = "bar",
  sheetVisible = false,
  onSheetClose,
}: Props) {
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const isPremium = userPlan === "premium" || userPlan === "enterprise" || userPlan === "admin";

  const BotButtons = () => (
    <View style={s.sheetGrid}>
      {ECOSYSTEM_BUTTONS.map(btn => {
        const locked = btn.premium && !isPremium;
        const catColor = btn.color;
        return (
          <TouchableOpacity
            key={btn.id}
            style={[s.sheetGridBtn, { borderColor: `${catColor}30` }]}
            onPress={() => {
              onSheetClose?.();
              setActiveModal(btn.id);
            }}
          >
            <View style={[s.sheetGridIcon, { backgroundColor: `${catColor}18` }]}>
              <Ionicons name={btn.icon as any} size={18} color={locked ? "#4b5563" : catColor} />
            </View>
            <Text style={[s.sheetGridLabel, locked && s.ecosBtnLabelLocked]}>{btn.label}</Text>
            {locked && (
              <View style={s.lockBadge}>
                <Ionicons name="lock-closed" size={7} color="#6b7280" />
              </View>
            )}
            {btn.premium && !locked && (
              <View style={[s.proBadge, { backgroundColor: catColor }]}>
                <Text style={s.proBadgeText}>PRO</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (mode === "sheet") {
    return (
      <>
        <Modal visible={sheetVisible} transparent animationType="slide">
          <Pressable style={s.overlay} onPress={onSheetClose}>
            <Pressable style={[s.sheet, s.ecosSheet]} onPress={e => e.stopPropagation()}>
              <View style={s.handle} />
              <View style={s.ecosSheetHeader}>
                <View style={s.ecosSheetIconWrap}>
                  <Ionicons name="flash-outline" size={16} color="#f59e0b" />
                </View>
                <Text style={s.sheetTitle}>Ecossistema de Bots</Text>
                <TouchableOpacity onPress={onSheetClose} style={s.closeBtn}>
                  <Ionicons name="close" size={18} color="#6b7280" />
                </TouchableOpacity>
              </View>
              <BotButtons />
            </Pressable>
          </Pressable>
        </Modal>

        {activeModal && activeModal !== "arbitrage" && (
          <BotConfigModal
            botId={activeModal}
            symbol={symbol}
            price={currentPrice}
            onClose={() => setActiveModal(null)}
          />
        )}

        {activeModal === "arbitrage" && (
          <ArbitrageModal
            symbol={symbol}
            onClose={() => setActiveModal(null)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.bar}
        style={s.barWrapper}
      >
        {ECOSYSTEM_BUTTONS.map(btn => {
          const locked = btn.premium && !isPremium;
          const catColor = btn.color;

          return (
            <TouchableOpacity
              key={btn.id}
              style={[s.ecosBtn, { borderColor: `${catColor}40` }]}
              onPress={() => setActiveModal(btn.id)}
            >
              <View style={[s.ecosBtnIcon, { backgroundColor: `${catColor}18` }]}>
                <Ionicons name={btn.icon as any} size={14} color={locked ? "#4b5563" : catColor} />
              </View>
              <Text style={[s.ecosBtnLabel, locked && s.ecosBtnLabelLocked]}>{btn.label}</Text>
              {locked && (
                <View style={s.lockBadge}>
                  <Ionicons name="lock-closed" size={7} color="#6b7280" />
                </View>
              )}
              {btn.premium && !locked && (
                <View style={[s.proBadge, { backgroundColor: catColor }]}>
                  <Text style={s.proBadgeText}>PRO</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {activeModal && activeModal !== "arbitrage" && (
        <BotConfigModal
          botId={activeModal}
          symbol={symbol}
          price={currentPrice}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === "arbitrage" && (
        <ArbitrageModal
          symbol={symbol}
          onClose={() => setActiveModal(null)}
        />
      )}
    </>
  );
}

const s = StyleSheet.create({
  barWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    backgroundColor: "#0d1117",
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  ecosBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#111827",
    position: "relative",
  },
  ecosBtnIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  ecosBtnLabel: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: "600",
  },
  ecosBtnLabelLocked: {
    color: "#4b5563",
  },
  lockBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#1f2937",
    borderRadius: 8,
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#374151",
  },
  proBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  proBadgeText: {
    fontSize: 7,
    color: "#000",
    fontWeight: "900",
  },
  overlay: {
    flex: 1,
    backgroundColor: "#00000088",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#111827",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    gap: 16,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#374151",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sheetIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    color: "#e5e7eb",
    fontSize: 16,
    fontWeight: "700",
  },
  sheetSymbol: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 2,
  },
  fields: {
    gap: 12,
  },
  fieldRow: {
    gap: 6,
  },
  fieldLabel: {
    color: "#6b7280",
    fontSize: 12,
  },
  input: {
    backgroundColor: "#1f2937",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#e5e7eb",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#374151",
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  startBtnText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "700",
  },
  arbTypes: {
    gap: 8,
  },
  arbTypeBtn: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#374151",
    backgroundColor: "#1f2937",
  },
  arbTypeBtnActive: {
    borderColor: "#f59e0b",
    backgroundColor: "#f59e0b14",
  },
  arbTypeLabel: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "600",
  },
  arbTypeLabelActive: {
    color: "#f59e0b",
    fontWeight: "700",
  },
  arbTypeDesc: {
    color: "#4b5563",
    fontSize: 11,
    marginTop: 2,
  },
  ecosSheet: {
    paddingBottom: 40,
  },
  ecosSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  ecosSheetIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#f59e0b18",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: {
    marginLeft: "auto",
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#ffffff08",
  },
  sheetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  sheetGridBtn: {
    width: "22%",
    minWidth: 72,
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "#ffffff06",
    gap: 8,
    position: "relative",
  },
  sheetGridIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetGridLabel: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: "600",
    textAlign: "center",
  },
});
