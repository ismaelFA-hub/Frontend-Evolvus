import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import { usePlanTheme } from '@/lib/theme-context';
import { apiRequest } from '@/lib/query-client';

const C = Colors.dark;

interface Invoice {
  id: string;
  status: 'pending' | 'paid' | 'waived';
  periodStart: string;
  periodEnd: string;
  feeAmountBrl: number;
  netProfitBrl: number;
}

export default function BillingScreen() {
  const insets = useSafeAreaInsets();
  const { planTheme } = usePlanTheme();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchInvoices();
  }, []);

  async function fetchInvoices() {
    try {
      const res = await apiRequest('GET', '/api/payment/invoices');
      const data = await res.json();
      setInvoices(data);
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function formatBRL(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  }

  function StatusBadge({ status }: { status: Invoice['status'] }) {
    let color = C.textSecondary;
    let label = 'Desconhecido';
    let bgColor = C.surface;

    if (status === 'paid') {
      color = C.primary;
      label = 'Pago';
      bgColor = `${C.primary}15`;
    } else if (status === 'pending') {
      color = C.warning;
      label = 'Pendente';
      bgColor = `${C.warning}15`;
    } else if (status === 'waived') {
      color = C.textTertiary;
      label = 'Isento';
      bgColor = `${C.textTertiary}15`;
    }

    return (
      <View style={[styles.badge, { backgroundColor: bgColor }]}>
        <Text style={[styles.badgeText, { color }]}>{label}</Text>
      </View>
    );
  }

  const webTopInset = Platform.OS === "web" ? 20 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.title}>Faturas</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={planTheme.primary} />
        </View>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={64} color={C.textTertiary} />
              <Text style={styles.emptyText}>Nenhuma fatura encontrada</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.invoiceCard, { borderColor: `${planTheme.primary}20` }]}>
              <View style={styles.cardHeader}>
                <Text style={styles.period}>
                  {formatDate(item.periodStart)} - {formatDate(item.periodEnd)}
                </Text>
                <StatusBadge status={item.status} />
              </View>
              
              <View style={styles.cardBody}>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Lucro Líquido</Text>
                  <Text style={styles.metricValue}>{formatBRL(item.netProfitBrl)}</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Taxa de Performance</Text>
                  <Text style={[styles.metricValue, { color: planTheme.primary }]}>
                    {formatBRL(item.feeAmountBrl)}
                  </Text>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 12,
    gap: 16
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 24, color: C.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 20, gap: 16 },
  emptyState: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingTop: 100,
    gap: 16 
  },
  emptyText: { 
    fontFamily: "Inter_500Medium", 
    fontSize: 16, 
    color: C.textSecondary 
  },
  invoiceCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 16
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  period: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: C.text
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8
  },
  badgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  metric: {
    gap: 4
  },
  metricLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: C.textSecondary
  },
  metricValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: C.text
  }
});
