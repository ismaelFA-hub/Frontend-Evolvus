import { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n-context";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;

type NewsTab = 'latest' | 'trending' | 'analysis';
type Category = 'Markets' | 'Regulation' | 'DeFi' | 'Technology';

const CATEGORY_COLORS: Record<Category, string> = {
  Markets: C.success,
  Regulation: '#2A5ADA',
  DeFi: '#9945FF',
  Technology: '#00B4D8',
};

interface NewsItem {
  id: string;
  title: string;
  source: string;
  timeAgo: string;
  category: Category;
  snippet: string;
}

const TRENDING_TOPICS = [
  { topic: 'Bitcoin ETF Inflows', mentions: 12400, change: '+340%' },
  { topic: 'Solana Ecosystem', mentions: 8700, change: '+180%' },
  { topic: 'CBDC Regulations', mentions: 6200, change: '+95%' },
  { topic: 'Layer 2 Scaling', mentions: 5100, change: '+67%' },
  { topic: 'DeFi Yield Farming', mentions: 4300, change: '+52%' },
  { topic: 'Institutional Crypto', mentions: 3800, change: '+41%' },
];

export default function NewsScreen() {
  const insets = useSafeAreaInsets();
  const { planTheme } = usePlanTheme();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<NewsTab>('latest');
  const [latestArticles, setLatestArticles] = useState<NewsItem[]>([]);
  const [analysisArticles, setAnalysisArticles] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  useEffect(() => {
    async function fetchNews() {
      try {
        setLoading(true);
        const [macroData, summaryData] = await Promise.allSettled([
          apiRequest<{ themes: string[]; outlook: string; keyRisks: string[] }>("GET", "/api/intelligence/macro"),
          apiRequest<{ summary: string; highlights: string[]; sentiment: string }>(
            "POST", "/api/content/daily-summary",
            { date: new Date().toISOString().slice(0, 10) }
          ),
        ]);

        if (macroData.status === 'fulfilled' && macroData.value) {
          const { themes = [], outlook = '', keyRisks = [] } = macroData.value;
          const articles: NewsItem[] = [];
          themes.forEach((theme, i) => {
          articles.push({ id: `macro-theme-${i}`, title: String(theme), source: 'Macro Intelligence', timeAgo: 'Now', category: 'Markets', snippet: i === 0 ? outlook : '' });
          });
          keyRisks.forEach((risk, i) => {
            articles.push({ id: `risk-${i}`, title: String(risk), source: 'Key Risk', timeAgo: 'Today', category: 'Regulation', snippet: '' });
          });
          setLatestArticles(articles);
        }

        if (summaryData.status === 'fulfilled' && summaryData.value) {
          const { highlights = [], summary = '', sentiment = '' } = summaryData.value;
          const articles: NewsItem[] = highlights.map((h, i) => ({
            id: `summary-${i}`,
            title: String(h),
            source: `Daily Summary · ${sentiment}`,
            timeAgo: 'Today',
            category: 'Markets' as Category,
            snippet: i === 0 ? summary : '',
          }));
          setAnalysisArticles(articles);
        }
      } catch {
        // silent - keep empty arrays
      } finally {
        setLoading(false);
      }
    }
    fetchNews();
  }, []);

  const tabs: { key: NewsTab; label: string }[] = [
    { key: 'latest', label: 'Latest' },
    { key: 'trending', label: 'Trending' },
    { key: 'analysis', label: 'Analysis' },
  ];

  const renderArticle = (article: NewsItem) => {
    const catColor = CATEGORY_COLORS[article.category];
    return (
      <Pressable key={article.id} style={styles.articleCard} onPress={() => Haptics.selectionAsync()}>
        <View style={[styles.categoryIndicator, { backgroundColor: catColor }]} />
        <View style={styles.articleContent}>
          <View style={styles.articleMeta}>
            <View style={[styles.categoryBadge, { backgroundColor: `${catColor}20` }]}>
              <Text style={[styles.categoryText, { color: catColor }]}>{article.category}</Text>
            </View>
            <Text style={styles.timeText}>{article.timeAgo}</Text>
          </View>
          <Text style={styles.articleTitle} numberOfLines={2}>{article.title}</Text>
          <Text style={styles.articleSnippet} numberOfLines={2}>{article.snippet}</Text>
          <View style={styles.articleFooter}>
            <Text style={styles.sourceText}>{article.source}</Text>
            <Ionicons name="bookmark-outline" size={16} color={C.textTertiary} />
          </View>
        </View>
      </Pressable>
    );
  };

  const renderTrending = () => (
    <View>
      <Text style={styles.sectionLabel}>Most Discussed Topics</Text>
      {TRENDING_TOPICS.map((item, idx) => (
        <Pressable key={idx} style={styles.trendingRow} onPress={() => Haptics.selectionAsync()}>
          <View style={styles.trendingLeft}>
            <Text style={styles.trendingRank}>#{idx + 1}</Text>
            <View>
              <Text style={styles.trendingTopic}>{item.topic}</Text>
              <Text style={styles.trendingMentions}>{item.mentions.toLocaleString()} mentions</Text>
            </View>
          </View>
          <View style={[styles.trendingBadge, { backgroundColor: C.successDim }]}>
            <Ionicons name="trending-up" size={14} color={C.success} />
            <Text style={[styles.trendingChange, { color: C.success }]}>{item.change}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => { Haptics.selectionAsync(); router.back(); }} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.title}>{t('news')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && { backgroundColor: planTheme.primaryDim, borderColor: planTheme.primary }]}
            onPress={() => { setActiveTab(tab.key); Haptics.selectionAsync(); }}
          >
            <Text style={[styles.tabText, activeTab === tab.key && { color: planTheme.primary }]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <ActivityIndicator size="large" color={planTheme.primary} />
          </View>
        ) : (
          <>
            {activeTab === 'latest' && latestArticles.map(renderArticle)}
            {activeTab === 'trending' && renderTrending()}
            {activeTab === 'analysis' && analysisArticles.map(renderArticle)}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text },
  tabBar: { flexDirection: "row", paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  tabText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.textSecondary },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  articleCard: { flexDirection: "row", backgroundColor: C.card, borderRadius: 16, marginBottom: 12, overflow: "hidden", borderWidth: 1, borderColor: C.border },
  categoryIndicator: { width: 4, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  articleContent: { flex: 1, padding: 16 },
  articleMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  categoryText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  timeText: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary },
  articleTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.text, marginBottom: 6, lineHeight: 22 },
  articleSnippet: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, lineHeight: 19, marginBottom: 10 },
  articleFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sourceText: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textTertiary },
  sectionLabel: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.text, marginBottom: 16, marginTop: 4 },
  trendingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  trendingLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  trendingRank: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.textTertiary, width: 30 },
  trendingTopic: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text },
  trendingMentions: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary, marginTop: 2 },
  trendingBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  trendingChange: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
});
