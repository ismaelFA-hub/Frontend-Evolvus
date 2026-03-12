/**
 * PlanComparison — Sprint LXIII
 *
 * Displays an evolutionary comparison between Evolvus plans,
 * showing percentage improvements to encourage upgrades.
 * Also renders the multi-user enterprise enquiry button.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';

const C = Colors.dark;

interface PlanUpgradeInfo {
  from: string;
  to: string;
  headline: string;
  stats: { label: string; value: string }[];
  cta: string;
  colour: string;
}

const UPGRADE_STEPS: PlanUpgradeInfo[] = [
  {
    from: 'Free',
    to: 'Pro',
    // Marketing claim: based on brain count ratio (29 vs 5 = +480%), bot count (10 vs 1 = +900%),
    // and feature unlocks (BIM+XAI+Regime). "275% more intelligent" is an indicative marketing metric.
    headline: 'Plano Pro – 275% mais inteligente, 58% mais eficaz',
    stats: [
      { label: 'Bots', value: '1 → 10 (+900%)' },
      { label: 'Cérebros', value: '5 → 29 (+480%)' },
      { label: 'Backtest', value: '30d → 365d' },
      { label: 'Capital', value: 'R$3k → R$50k' },
      { label: 'BIM + XAI + Regime', value: '✅ desbloqueados' },
    ],
    cta: 'Upgrade para Pro – R$197/mês',
    colour: '#3b82f6',
  },
  {
    from: 'Pro',
    to: 'Premium',
    // Marketing claim: based on brain count increase (40/29 = +38%), 3.5x backtest window,
    // and feature unlocks (Arsenal 30 + Meta-Learning + Creative AI + Market Intel).
    // "340% more predictive capacity" is an indicative marketing metric.
    headline: 'Plano Premium – 340% mais capacidade preditiva, 220% mais estratégias',
    stats: [
      { label: 'Bots', value: '10 → 35 (+250%)' },
      { label: 'Cérebros', value: '29 → 40 (+38%)' },
      { label: 'Backtest', value: '1 → 5 anos' },
      { label: 'Capital', value: 'R$50k → R$500k' },
      { label: 'Arsenal', value: '30 estratégias validadas' },
      { label: 'Meta-Learning + IA Criativa + Market Intel', value: '✅' },
    ],
    cta: 'Upgrade para Premium – R$497/mês',
    colour: '#8b5cf6',
  },
  {
    from: 'Premium',
    to: 'Enterprise',
    headline: 'Plano Enterprise – Máxima performance com IA completa e suporte executivo',
    stats: [
      { label: 'Bots', value: 'Ilimitado' },
      { label: 'Cérebros', value: '59 (todos)' },
      { label: 'Backtest', value: 'Ilimitado' },
      { label: 'Capital', value: 'Ilimitado (mediante acordo)' },
      { label: 'Gêmeo Digital + Anomaly Detector', value: '✅ exclusivo' },
      { label: 'Arsenal', value: 'Ilimitado' },
      { label: 'SLA 99,9% + Suporte Executivo ≤1h', value: '✅' },
      { label: 'Garantia 15 dias', value: 'Reembolso total' },
    ],
    cta: 'Fale com nossa equipe comercial',
    colour: '#f59e0b',
  },
];

interface EnterpriseFormData {
  name: string;
  company: string;
  email: string;
  users: string;
  capital: string;
}

export interface PlanComparisonProps {
  currentPlan?: 'free' | 'pro' | 'premium' | 'enterprise';
  onUpgradePress?: (targetPlan: string) => void;
}

export function PlanComparison({ currentPlan = 'free', onUpgradePress }: PlanComparisonProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EnterpriseFormData>({
    name: '',
    company: '',
    email: '',
    users: '',
    capital: '',
  });
  const [submitted, setSubmitted] = useState(false);

  // Only show upgrade steps above current plan
  const planOrder = ['free', 'pro', 'premium', 'enterprise'];
  const currentIdx = planOrder.indexOf(currentPlan);
  const visibleSteps = UPGRADE_STEPS.slice(currentIdx);

  if (visibleSteps.length === 0) {
    return (
      <View style={styles.maxPlanContainer}>
        <Ionicons name="trophy" size={32} color={C.accent} />
        <Text style={styles.maxPlanText}>Você está no plano máximo – Enterprise</Text>
        <Text style={styles.maxPlanSub}>IA completa, suporte executivo e SLA 99,9% garantido.</Text>
      </View>
    );
  }

  const handleSubmitEnquiry = () => {
    // In production: POST /api/enterprise/enquiry
    setSubmitted(true);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} testID="plan-comparison">
      {visibleSteps.map((step) => (
        <View key={step.to} style={[styles.card, { borderLeftColor: step.colour }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.badge, { backgroundColor: step.colour + '22' }]}>
              <Text style={[styles.badgeText, { color: step.colour }]}>{step.from} → {step.to}</Text>
            </View>
          </View>

          <Text style={styles.headline}>{step.headline}</Text>

          <View style={styles.statsList}>
            {step.stats.map((stat) => (
              <View key={stat.label} style={styles.statRow}>
                <Text style={styles.statLabel}>{stat.label}</Text>
                <Text style={styles.statValue}>{stat.value}</Text>
              </View>
            ))}
          </View>

          {step.to === 'Enterprise' ? (
            <Pressable
              style={[styles.cta, { backgroundColor: step.colour }]}
              onPress={() => setShowForm(true)}
              testID="enterprise-enquiry-btn"
            >
              <Ionicons name="mail" size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.ctaText}>Solicitar orçamento</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.cta, { backgroundColor: step.colour }]}
              onPress={() => onUpgradePress?.(step.to.toLowerCase())}
              testID={`upgrade-to-${step.to.toLowerCase()}-btn`}
            >
              <Ionicons name="arrow-up-circle" size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.ctaText}>{step.cta}</Text>
            </Pressable>
          )}
        </View>
      ))}

      {/* Enterprise multi-user enquiry modal */}
      <Modal
        visible={showForm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowForm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {submitted ? (
              <View style={styles.submittedContainer}>
                <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
                <Text style={styles.submittedTitle}>Solicitação enviada!</Text>
                <Text style={styles.submittedSub}>
                  Nossa equipe comercial entrará em contato em até 24 horas.
                </Text>
                <Pressable
                  style={[styles.cta, { backgroundColor: '#22c55e', marginTop: 20 }]}
                  onPress={() => { setShowForm(false); setSubmitted(false); }}
                >
                  <Text style={styles.ctaText}>Fechar</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Solicitar orçamento Enterprise</Text>
                  <Pressable onPress={() => setShowForm(false)} testID="close-modal-btn">
                    <Ionicons name="close" size={24} color={C.textSecondary} />
                  </Pressable>
                </View>

                <Text style={styles.modalSub}>
                  Usuários adicionais: sob consulta comercial.
                </Text>

                {(
                  [
                    { key: 'name', label: 'Nome', placeholder: 'Seu nome' },
                    { key: 'company', label: 'Empresa', placeholder: 'Nome da empresa' },
                    { key: 'email', label: 'E-mail', placeholder: 'email@empresa.com' },
                    { key: 'users', label: 'Número de usuários', placeholder: 'ex: 5' },
                    { key: 'capital', label: 'Capital previsto (R$)', placeholder: 'ex: 2000000' },
                  ] as { key: keyof EnterpriseFormData; label: string; placeholder: string }[]
                ).map((field) => (
                  <View key={field.key} style={styles.formField}>
                    <Text style={styles.fieldLabel}>{field.label}</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={form[field.key]}
                      onChangeText={(v) => setForm((f) => ({ ...f, [field.key]: v }))}
                      placeholder={field.placeholder}
                      placeholderTextColor={C.textSecondary}
                      keyboardType={
                        field.key === 'users' || field.key === 'capital'
                          ? 'numeric'
                          : 'default'
                      }
                      testID={`enterprise-form-${field.key}`}
                    />
                  </View>
                ))}

                <Pressable
                  style={[styles.cta, { backgroundColor: '#f59e0b', marginTop: 16 }]}
                  onPress={handleSubmitEnquiry}
                  testID="submit-enquiry-btn"
                >
                  <Text style={styles.ctaText}>Enviar solicitação</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  headline: {
    color: C.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
    lineHeight: 22,
  },
  statsList: {
    gap: 6,
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  statLabel: {
    color: C.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  statValue: {
    color: C.text,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  ctaText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  maxPlanContainer: {
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  maxPlanText: {
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  maxPlanSub: {
    color: C.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    color: C.text,
    fontSize: 17,
    fontWeight: '700',
  },
  modalSub: {
    color: C.textSecondary,
    fontSize: 13,
    marginBottom: 16,
  },
  formField: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: C.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  fieldInput: {
    backgroundColor: C.background,
    color: C.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: C.border ?? '#333',
  },
  submittedContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  submittedTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: '700',
  },
  submittedSub: {
    color: C.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
});

export default PlanComparison;
