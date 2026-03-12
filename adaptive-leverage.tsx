import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { apiRequest } from "@/lib/query-client";

interface LeverageResult {
  symbol: string;
  strategy: string;
  recommendedLeverage: number;
  factors: {
    volatility: number;
    funding: number;
    drawdown: number;
    regime: string;
  };
  explanation: string;
}

function LeverageMeter({ value, max = 25 }: { value: number; max?: number }) {
  const pct = (value / max) * 100;
  const color = value <= 5 ? "#00ff88" : value <= 10 ? "#ffd700" : value <= 20 ? "#ff8c00" : "#ff4444";
  return (
    <View style={styles.meterContainer}>
      <View style={[styles.meterBar, { width: `${pct}%`, backgroundColor: color }]} />
      <Text style={[styles.meterText, { color }]}>{value}x</Text>
    </View>
  );
}

export default function AdaptiveLeverage() {
  const [symbol, setSymbol] = useState("BTC");
  const [strategy, setStrategy] = useState("grid");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LeverageResult | null>(null);
  const [error, setError] = useState("");

  const handleCalculate = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest("GET", `/api/adaptive-leverage/${symbol}/${strategy}`);
      setResult(data as LeverageResult);
    } catch (e: any) {
      setError(e.message ?? "Erro ao calcular alavancagem");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Motor de Alavancagem Adaptativa</Text>
      <Text style={styles.subtitle}>Recomendação dinâmica baseada em volatilidade, funding e drawdown</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Ativo</Text>
        <View style={styles.pickerWrapper}>
          <Picker selectedValue={symbol} onValueChange={setSymbol} style={styles.picker} dropdownIconColor="#ffd700">
            <Picker.Item label="Bitcoin (BTC)" value="BTC" />
            <Picker.Item label="Ethereum (ETH)" value="ETH" />
            <Picker.Item label="Solana (SOL)" value="SOL" />
            <Picker.Item label="BNB" value="BNB" />
          </Picker>
        </View>

        <Text style={styles.label}>Estratégia</Text>
        <View style={styles.pickerWrapper}>
          <Picker selectedValue={strategy} onValueChange={setStrategy} style={styles.picker} dropdownIconColor="#ffd700">
            <Picker.Item label="Grid Trading" value="grid" />
            <Picker.Item label="DCA" value="dca" />
            <Picker.Item label="Martingale" value="martingale" />
            <Picker.Item label="Trend Following" value="trend" />
            <Picker.Item label="Scalping" value="scalping" />
          </Picker>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleCalculate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={styles.buttonText}>Calcular Alavancagem</Text>
          )}
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {result && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Alavancagem Recomendada</Text>
          <LeverageMeter value={result.recommendedLeverage} />

          <View style={styles.factorsGrid}>
            <FactorCard label="Volatilidade" value={`${(result.factors.volatility * 100).toFixed(1)}%`} />
            <FactorCard label="Funding" value={`${(result.factors.funding * 100).toFixed(2)}%`} />
            <FactorCard label="Drawdown" value={`${result.factors.drawdown.toFixed(1)}%`} />
          </View>

          <View style={styles.explanationBox}>
            <Text style={styles.explanationLabel}>Análise</Text>
            <Text style={styles.explanationText}>{result.explanation}</Text>
          </View>

          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠️ Esta é apenas uma recomendação. Alavancagem envolve riscos significativos. Use sempre stop-loss.
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function FactorCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.factorCard}>
      <Text style={styles.factorLabel}>{label}</Text>
      <Text style={styles.factorValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050510" },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "bold", color: "#ffd700", marginBottom: 4 },
  subtitle: { fontSize: 13, color: "#666", marginBottom: 16 },
  card: { backgroundColor: "#0d0d1a", borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#2a2a1e" },
  label: { color: "#aaa", fontSize: 13, marginBottom: 6, marginTop: 12 },
  pickerWrapper: { backgroundColor: "#111122", borderRadius: 8, borderWidth: 1, borderColor: "#2a2a4a", overflow: "hidden" },
  picker: { color: "#fff", height: 44 },
  button: { backgroundColor: "#ffd700", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 20 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#000", fontWeight: "bold", fontSize: 15 },
  errorText: { color: "#ff6b6b", textAlign: "center", marginVertical: 8 },
  resultCard: { backgroundColor: "#0d0d1a", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#2a2a1e" },
  resultTitle: { color: "#aaa", fontSize: 13, marginBottom: 12 },
  meterContainer: { height: 44, backgroundColor: "#111122", borderRadius: 8, overflow: "hidden", justifyContent: "center", marginBottom: 16 },
  meterBar: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 8 },
  meterText: { textAlign: "center", fontWeight: "bold", fontSize: 20, zIndex: 1 },
  factorsGrid: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16, gap: 8 },
  factorCard: { flex: 1, backgroundColor: "#111122", borderRadius: 8, padding: 10, alignItems: "center" },
  factorLabel: { color: "#666", fontSize: 11, marginBottom: 4 },
  factorValue: { color: "#fff", fontSize: 14, fontWeight: "bold" },
  explanationBox: { backgroundColor: "#111122", borderRadius: 8, padding: 12, marginBottom: 12 },
  explanationLabel: { color: "#888", fontSize: 11, marginBottom: 6 },
  explanationText: { color: "#ddd", fontSize: 13, lineHeight: 18 },
  warningBox: { backgroundColor: "#ff440011", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#ff440033" },
  warningText: { color: "#ff8888", fontSize: 11, lineHeight: 16 },
});
