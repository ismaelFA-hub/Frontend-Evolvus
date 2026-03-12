import { View, Text, ScrollView, Pressable, StyleSheet, Platform, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { AFFILIATE_LINKS, EXCHANGE_DISPLAY } from "@/lib/affiliate-links";

const C = Colors.dark;

export default function PartnersScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  function handlePress(exchangeId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = AFFILIATE_LINKS[exchangeId];
    if (url) Linking.openURL(url);
  }

  const tier1 = EXCHANGE_DISPLAY.filter(e => e.tier === 1);
  const tier2 = EXCHANGE_DISPLAY.filter(e => e.tier === 2);

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.title}>Exchanges Parceiras</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Acesse as principais exchanges do mercado e comece a operar com os melhores parceiros do Evolvus.
        </Text>

        <Text style={styles.sectionLabel}>Tier 1 — Principais Exchanges</Text>
        <View style={styles.grid}>
          {tier1.map((ex) => (
            <Pressable key={ex.id} style={styles.card} onPress={() => handlePress(ex.id)}>
              <View style={[styles.logoCircle, { backgroundColor: ex.color + "22", borderColor: ex.color + "44" }]}>
                <Text style={[styles.logoLetter, { color: ex.color }]}>{ex.name[0]}</Text>
              </View>
              <Text style={styles.exchangeName} numberOfLines={1}>{ex.name}</Text>
              <View style={styles.visitRow}>
                <Text style={[styles.visitText, { color: ex.color }]}>Acessar</Text>
                <Ionicons name="open-outline" size={12} color={ex.color} />
              </View>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Tier 2 — Exchanges Adicionais</Text>
        <View style={styles.grid}>
          {tier2.map((ex) => (
            <Pressable key={ex.id} style={styles.card} onPress={() => handlePress(ex.id)}>
              <View style={[styles.logoCircle, { backgroundColor: ex.color + "22", borderColor: ex.color + "44" }]}>
                <Text style={[styles.logoLetter, { color: ex.color }]}>{ex.name[0]}</Text>
              </View>
              <Text style={styles.exchangeName} numberOfLines={1}>{ex.name}</Text>
              <View style={styles.visitRow}>
                <Text style={[styles.visitText, { color: ex.color }]}>Acessar</Text>
                <Ionicons name="open-outline" size={12} color={ex.color} />
              </View>
            </Pressable>
          ))}
        </View>

        <Text style={styles.disclaimer}>
          Ao acessar as exchanges pelo Evolvus, você pode se beneficiar de condições especiais de parceria.
        </Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { padding: 8 },
  title: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  intro: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary, lineHeight: 22 },
  sectionLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textTertiary, textTransform: "uppercase", letterSpacing: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: "30%",
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 8,
  },
  logoCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  logoLetter: { fontFamily: "Inter_700Bold", fontSize: 20 },
  exchangeName: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.text, textAlign: "center" },
  visitRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  visitText: { fontFamily: "Inter_500Medium", fontSize: 11 },
  disclaimer: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary, textAlign: "center", lineHeight: 18, marginTop: 8 },
});
