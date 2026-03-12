import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';

const CRYPTO_BASE_URL = process.env.EXPO_PUBLIC_CRYPTO_URL || 'http://localhost:3001';

export default function TradingDashboard() {
  const [prices, setPrices] = useState({});
  const [coinData, setCoinData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    // Polling de preços em tempo real (EventSource não é suportado no React Native)
    const fetchPrices = async () => {
      try {
        const response = await fetch(`${CRYPTO_BASE_URL}/api/crypto/prices`);
        const data = await response.json();
        setPrices(data);
        setLoading(false);
      } catch (err) {
        setErrors(prev => ({ ...prev, polling: 'Falha na conexão com servidor' }));
        setLoading(false);
      }
    };

    fetchPrices();
    const pollingInterval = setInterval(fetchPrices, 2000);

    // Buscar dados aprofundados da CoinGecko (se disponível)
    const fetchDeepData = setInterval(async () => {
      try {
        const response = await fetch(`${CRYPTO_BASE_URL}/api/crypto/coingecko/bitcoin`);
        const data = await response.json();
        if (!data.error) setCoinData(data);
      } catch (err) {
        setErrors(prev => ({ ...prev, coingecko: err.message }));
      }
    }, 30000);

    return () => {
      clearInterval(pollingInterval);
      clearInterval(fetchDeepData);
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4caf50" />
        <Text style={styles.loadingText}>Carregando dados de mercado...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>📊 Trading Dashboard</Text>
      
      {Object.keys(errors).length > 0 && (
        <View style={styles.errors}>
          <Text style={styles.errorTitle}>⚠️ Avisos:</Text>
          {Object.entries(errors).map(([key, msg]) => (
            <Text key={key} style={styles.errorText}>• {key}: {msg}</Text>
          ))}
        </View>
      )}
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💰 Preços em Tempo Real</Text>
        {Object.keys(prices).length === 0 ? (
          <Text style={styles.noData}>Nenhum dado disponível</Text>
        ) : (
          Object.entries(prices).map(([asset, data]) => (
            <View key={asset} style={styles.row}>
              <Text style={styles.asset}>{asset}</Text>
              <Text style={styles.price}>${data.price}</Text>
              <Text style={styles.source}>via {data.source}</Text>
            </View>
          ))
        )}
      </View>

      {coinData && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📈 Dados Aprofundados (CoinGecko)</Text>
          <Text>Market Cap: ${coinData.market_data?.market_cap?.usd?.toLocaleString()}</Text>
          <Text>Volume 24h: ${coinData.market_data?.total_volume?.usd?.toLocaleString()}</Text>
          <Text>All Time High: ${coinData.market_data?.ath?.usd}</Text>
          <Text>Variação 24h: {coinData.market_data?.price_change_percentage_24h?.toFixed(2)}%</Text>
        </View>
      )}

      {!coinData && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📈 Dados Aprofundados</Text>
          <Text style={styles.noData}>CoinGecko não configurada</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#0a0a0a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  loadingText: { color: '#fff', marginTop: 10 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  errors: { backgroundColor: '#332200', padding: 10, borderRadius: 8, marginBottom: 20 },
  errorTitle: { color: '#ffaa00', fontWeight: 'bold' },
  errorText: { color: '#ffaa00', fontSize: 12 },
  section: { backgroundColor: '#1a1a1a', padding: 15, borderRadius: 10, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#333' },
  asset: { color: '#fff', fontSize: 16 },
  price: { color: '#4caf50', fontSize: 16, fontWeight: 'bold' },
  source: { color: '#888', fontSize: 12 },
  noData: { color: '#666', fontStyle: 'italic' },
});
