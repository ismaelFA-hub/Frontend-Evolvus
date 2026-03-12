import { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n-context";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;

// ─── Constants ────────────────────────────────────────────────

/** Deve ser igual ao MAX_SUPPORT_HISTORY do backend (server/ai/supportService.ts) */
const MAX_HISTORY = 6;

// ─── Types ────────────────────────────────────────────────────

interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  source?: "groq" | "local";
  timestamp: Date;
}

// ─── Welcome messages ─────────────────────────────────────────

const STATIC_WELCOME: Record<string, string> = {
  pt: "Olá! Sou o **Nexus**, seu assistente neural da Evolvus. Como posso ajudar hoje?",
  en: "Hi! I'm **Nexus**, Evolvus' neural assistant. How can I help you today?",
  es: "¡Hola! Soy **Nexus**, asistente neural de Evolvus. ¿Cómo puedo ayudarte hoy?",
};

// ─── Quick-question key list (resolved via t() inside the component) ──

const SUPPORT_Q_KEYS = [
  "supportQ1", "supportQ2", "supportQ3", "supportQ4",
  "supportQ5", "supportQ6", "supportQ7",
] as const;

// ─── FAQ Accordion ────────────────────────────────────────────

function FaqAccordion({ faqs, categories }: { faqs: FaqItem[]; categories: string[] }) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const { planTheme } = usePlanTheme();

  if (faqs.length === 0) return null;

  return (
    <View style={faqStyles.container}>
      {categories.map(cat => {
        const items = faqs.filter(f => f.category === cat);
        const isCatOpen = expandedCat === cat;
        return (
          <View key={cat} style={faqStyles.category}>
            <Pressable style={faqStyles.catHeader} onPress={() => setExpandedCat(isCatOpen ? null : cat)}>
              <Text style={faqStyles.catTitle}>{cat}</Text>
              <Ionicons name={isCatOpen ? "chevron-up" : "chevron-down"} size={16} color={C.textSecondary} />
            </Pressable>
            {isCatOpen && items.map(item => {
              const key = `${cat}-${item.question}`;
              const isOpen = expandedItem === key;
              return (
                <View key={key} style={faqStyles.item}>
                  <Pressable style={faqStyles.question} onPress={() => setExpandedItem(isOpen ? null : key)}>
                    <Text style={faqStyles.questionText}>{item.question}</Text>
                    <Ionicons name={isOpen ? "remove" : "add"} size={16} color={planTheme.primary} />
                  </Pressable>
                  {isOpen && <Text style={faqStyles.answer}>{item.answer}</Text>}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

// ─── Bubble component ─────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const { planTheme } = usePlanTheme();

  // Simple markdown-like bold: **text** → bold
  const renderContent = (text: string) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return (
      <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
        {parts.map((part, i) =>
          i % 2 === 1 ? (
            <Text key={i} style={styles.boldText}>
              {part}
            </Text>
          ) : (
            part
          )
        )}
      </Text>
    );
  };

  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <View style={[styles.avatarDot, { backgroundColor: planTheme.primary }]}>
          <Text style={styles.avatarText}>N</Text>
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser
            ? [styles.bubbleUser, { backgroundColor: planTheme.primary }]
            : styles.bubbleAssistant,
        ]}
      >
        {renderContent(msg.content)}
        {!isUser && msg.source === "groq" && (
          <Text style={styles.sourceTag}>✦ Nexus IA</Text>
        )}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────

export default function SupportChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { planTheme } = usePlanTheme();
  const { user } = useAuth();
  const { language, t } = useI18n();
  const scrollRef = useRef<ScrollView>(null);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  // FAQ state
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [faqCategories, setFaqCategories] = useState<string[]>([]);
  const [showFaq, setShowFaq] = useState(false);

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);

  const welcomeText = STATIC_WELCOME[language] ?? STATIC_WELCOME["pt"];

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: welcomeText,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);

  // Session + FAQ init
  useEffect(() => {
    async function init() {
      try {
        const [sessionRes, catRes, faqRes] = await Promise.all([
          apiRequest("POST", "/api/assistant/session", { userId: user?.id ?? "guest", language }).catch(() => null),
          apiRequest("GET", "/api/assistant/faq/categories").catch(() => null),
          apiRequest("GET", "/api/assistant/faq").catch(() => null),
        ]);

        if (sessionRes) {
          const sd = await sessionRes.json() as { sessionId: string; welcomeMessage?: string };
          setSessionId(sd.sessionId);
          if (sd.welcomeMessage) {
            setMessages(prev => [{
              id: "welcome",
              role: "assistant",
              content: sd.welcomeMessage ?? "",
              timestamp: new Date(),
            }, ...prev.filter(m => m.id !== "welcome")]);
          }
        }
        if (catRes) {
          const cd = await catRes.json() as { categories: string[] };
          setFaqCategories(cd.categories ?? []);
        }
        if (faqRes) {
          const fd = await faqRes.json() as { faqs: FaqItem[] };
          setFaqs(fd.faqs ?? []);
        }
      } catch {
        // silently ignore — session/faq is optional
      }
    }
    init();
  }, [user?.id, language]);

  const history = messages
    .filter((m) => m.id !== "welcome")
    .map((m) => ({ role: m.role, content: m.content }));

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setInputText("");

      const userMsg: ChatMessage = {
        id: `u_${Date.now()}`,
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      // Auto-scroll
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

      try {
        const res = await apiRequest("POST", "/api/support/chat", {
          message: trimmed,
          history: history.slice(-MAX_HISTORY),
          language,
          ...(sessionId ? { sessionId } : {}),
        });
        const data = (await res.json()) as {
          answer: string;
          source: "groq" | "local";
        };

        const assistantMsg: ChatMessage = {
          id: `a_${Date.now()}`,
          role: "assistant",
          content: data.answer,
          source: data.source,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        const errorMsg: ChatMessage = {
          id: `e_${Date.now()}`,
          role: "assistant",
          content: t("chatError"),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setLoading(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
      }
    },
    [loading, history, sessionId, t]
  );

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <View style={[styles.evaAvatar, { backgroundColor: planTheme.primary }]}>
              <Text style={styles.evaAvatarText}>N</Text>
            </View>
            <View>
              <Text style={styles.headerTitle}>Nexus</Text>
              <Text style={styles.headerSub}>{t("nexusOnline")}</Text>
            </View>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Ionicons name="information-circle-outline" size={14} color={C.textSecondary} />
          <Text style={styles.disclaimerText}>
            {t("nexusDisclaimer")}
          </Text>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: true })
          }
        >
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          {loading && (
            <View style={styles.typingRow}>
              <View style={[styles.avatarDot, { backgroundColor: planTheme.primary }]}>
                <Text style={styles.avatarText}>N</Text>
              </View>
              <View style={styles.typingBubble}>
                <ActivityIndicator size="small" color={planTheme.primary} />
                <Text style={styles.typingText}>{t("nexusTyping")}</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* FAQ Section */}
        {faqs.length > 0 && (
          <View style={styles.faqSection}>
            <Pressable style={styles.faqHeader} onPress={() => setShowFaq(v => !v)}>
              <Ionicons name="help-circle-outline" size={16} color={planTheme.primary} />
              <Text style={[styles.faqHeaderText, { color: planTheme.primary }]}>{t("nexusFaqTitle")}</Text>
              <Ionicons name={showFaq ? "chevron-up" : "chevron-down"} size={16} color={planTheme.primary} />
            </Pressable>
            {showFaq && <FaqAccordion faqs={faqs} categories={faqCategories} />}
          </View>
        )}

        {/* Quick questions (only when 1 message) */}
        {messages.length <= 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.quickScrollRow}
            contentContainerStyle={styles.quickScrollContent}
          >
            {SUPPORT_Q_KEYS.map((key) => {
              const label = t(key);
              return (
                <Pressable
                  key={key}
                  style={[styles.quickChip, { borderColor: `${planTheme.primary}60` }]}
                  onPress={() => sendMessage(label)}
                >
                  <Text style={[styles.quickChipText, { color: planTheme.primary }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Input */}
        <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder={t("chatPlaceholder")}
            placeholderTextColor={C.textSecondary}
            multiline
            maxLength={1000}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage(inputText)}
            editable={!loading}
          />
          <Pressable
            style={[
              styles.sendBtn,
              { backgroundColor: planTheme.primary },
              (!inputText.trim() || loading) && styles.sendBtnDisabled,
            ]}
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || loading}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  container: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerSpacer: { width: 30 },
  evaAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  evaAvatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  headerTitle: { color: C.text, fontWeight: "700", fontSize: 16 },
  headerSub: { color: C.textSecondary, fontSize: 12 },

  disclaimer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: `${C.card}80`,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  disclaimerText: { color: C.textSecondary, fontSize: 11, flex: 1 },

  messagesList: { flex: 1 },
  messagesContent: { padding: 16, gap: 12 },

  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    maxWidth: "90%",
  },
  bubbleRowUser: { alignSelf: "flex-end", flexDirection: "row-reverse" },
  avatarDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "100%",
  },
  bubbleAssistant: { backgroundColor: C.card },
  bubbleUser: {},
  bubbleText: { color: C.text, fontSize: 14, lineHeight: 21 },
  bubbleTextUser: { color: "#fff" },
  boldText: { fontWeight: "700" },
  sourceTag: { color: C.textSecondary, fontSize: 10, marginTop: 4 },

  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.card,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  typingText: { color: C.textSecondary, fontSize: 13 },

  quickScrollRow: { maxHeight: 48, marginBottom: 4 },
  quickScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: "center",
  },
  quickChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quickChipText: { fontSize: 12, fontWeight: "500" },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.background,
  },
  input: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: C.text,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
  faqSection: { borderTopWidth: 1, borderTopColor: C.border, backgroundColor: `${C.card}80` },
  faqHeader: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10 },
  faqHeaderText: { flex: 1, fontWeight: "600", fontSize: 13 },
});

const faqStyles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingBottom: 8 },
  category: { marginBottom: 6 },
  catHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  catTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text },
  item: { borderBottomWidth: 1, borderBottomColor: `${C.border}50` },
  question: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 8 },
  questionText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 13, color: C.text },
  answer: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, paddingBottom: 8, lineHeight: 18 },
});
