import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Switch,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { ScenarioChart } from "@/components/ScenarioChart";
import { apiRequest } from "@/lib/query-client";

interface Scenario {
  id: number;
  path: number[];
  confidence: number;
  description: string;
  riskLevel: "low" | "medium" | "high";
  title: string;
}

const RISK_LABELS: Record<string, string> = {
  low: "Baixo",
  medium: "Médio",
  high: "Alto",
};

const RISK_COLORS: Record<string, string> = {
  low: "#00ff88",
  medium: "#ffd700",
  high: "#ff6b6b",
};

export default function ScenarioSimulator() {
  const [symbol, setSymbol] = useState("BTC");
  const [days, setDays] = useState("3");
  const [scenarios, setScenarios] = useState("10");
  const [includeMacro, setIncludeMacro] = useState(true);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Scenario[] | null>(null);
  const [error, setError] = useState("");

  const handleSimulate = async () => {
    setLoading(true);
    setError("");
    setResults(null);
    try {
      const data = await apiRequest("POST", "/api/scenario/simulate", {
        symbol,
        days: parseInt(days, 10),
        scenarios: parseInt(scenarios, 10),
        includeMacro,
      });
      setResults(data as Scenario[]);
    } catch (e: any) {
      setError(e.message ?? "Erro ao simular cenários");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Simulador de Cenários IA</Text>
      <Text style={styles.subtitle}>Projeções de preço com Geometric Brownian Motion + Groq AI</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Ativo</Text>
        <View style={styles.pickerWrapper}>
          <Picker selectedValue={symbol} onValueChange={setSymbol} style={styles.picker} dropdownIconColor="#00d4ff">
            <Picker.Item label="Bitcoin (BTC)" value="BTC" />
            <Picker.Item label="Ethereum (ETH)" value="ETH" />
            <Picker.Item label="Solana (SOL)" value="SOL" />
            <Picker.Item label="BNB" value="BNB" />
            <Picker.Item label="XRP" value="XRP" />
          </Picker>
        </View>

        <Text style={styles.label}>Dias de projeção (1–7)</Text>
        <TextInput
          value={days}
          onChangeText={setDays}
          keyboardType="numeric"
          style={styles.input}
          placeholderTextColor="#666"
          maxLength={1}
        />

        <Text style={styles.label}>Número de cenários (5–20)</Text>
        <TextInput
          value={scenarios}
          onChangeText={setScenarios}
          keyboardType="numeric"
          style={styles.input}
          placeholderTextColor="#666"
          maxLength={2}
        />

        <View style={styles.row}>
          <Text style={styles.label}>Incluir contexto macro</Text>
          <Switch
            value={includeMacro}
            onValueChange={setIncludeMacro}
            trackColor={{ false: "#333", true: "#00d4ff44" }}
            thumbColor={includeMacro ? "#00d4ff" : "#666"}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSimulate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={styles.buttonText}>Simular Cenários</Text>
          )}
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {results && results.length > 0 && (
        <View>
          <Text style={styles.sectionTitle}>Trajetórias de Preço</Text>
          <ScenarioChart data={results} days={parseInt(days, 10)} />

          <Text style={styles.sectionTitle}>Detalhes dos Cenários</Text>
          {results.map((scenario) => (
            <View key={scenario.id} style={[styles.scenarioCard, { borderLeftColor: RISK_COLORS[scenario.riskLevel] }]}>
              <View style={styles.scenarioHeader}>
                <Text style={styles.scenarioTitle}>{scenario.title}</Text>
                <View style={[styles.riskBadge, { backgroundColor: RISK_COLORS[scenario.riskLevel] + "22" }]}>
                  <Text style={[styles.riskText, { color: RISK_COLORS[scenario.riskLevel] }]}>
                    {RISK_LABELS[scenario.riskLevel]}
                  </Text>
                </View>
              </View>
              <Text style={styles.scenarioConf}>
                Confiança: {(scenario.confidence * 100).toFixed(1)}%
              </Text>
              <Text style={styles.scenarioDesc}>{scenario.description}</Text>
              <View style={styles.priceRange}>
                <Text style={styles.priceRangeText}>
                  Final: ${scenario.path[scenario.path.length - 1].toFixed(2)}
                </Text>
                <Text style={[styles.priceRangeText, {
                  color: scenario.path[scenario.path.length - 1] >= scenario.path[0] ? "#00ff88" : "#ff6b6b",
                }]}>
                  {((scenario.path[scenario.path.length - 1] / scenario.path[0] - 1) * 100).toFixed(2)}%
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050510" },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "bold", color: "#00d4ff", marginBottom: 4 },
  subtitle: { fontSize: 13, color: "#666", marginBottom: 16 },
  card: { backgroundColor: "#0d0d1a", borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#1a1a3e" },
  label: { color: "#aaa", fontSize: 13, marginBottom: 6, marginTop: 12 },
  pickerWrapper: { backgroundColor: "#111122", borderRadius: 8, borderWidth: 1, borderColor: "#2a2a4a", overflow: "hidden" },
  picker: { color: "#fff", height: 44 },
  input: { backgroundColor: "#111122", borderWidth: 1, borderColor: "#2a2a4a", borderRadius: 8, padding: 10, color: "#fff", fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  button: { backgroundColor: "#00d4ff", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 20 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#000", fontWeight: "bold", fontSize: 15 },
  errorText: { color: "#ff6b6b", textAlign: "center", marginVertical: 8 },
  sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "600", marginTop: 16, marginBottom: 8 },
  scenarioCard: { backgroundColor: "#0d0d1a", borderRadius: 10, padding: 12, marginBottom: 8, borderLeftWidth: 3 },
  scenarioHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  scenarioTitle: { color: "#fff", fontWeight: "bold", fontSize: 14, flex: 1 },
  riskBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  riskText: { fontSize: 11, fontWeight: "600" },
  scenarioConf: { color: "#888", fontSize: 12, marginBottom: 4 },
  scenarioDesc: { color: "#ccc", fontSize: 12, marginBottom: 6 },
  priceRange: { flexDirection: "row", justifyContent: "space-between" },
  priceRangeText: { color: "#aaa", fontSize: 12, fontWeight: "600" },
});
