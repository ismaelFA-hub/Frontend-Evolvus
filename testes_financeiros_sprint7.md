# Testes Financeiros — Sprint 7 (Per-Plan Thresholds + iv_skew PRO + Regime Overrides)

**Período:** 2026-02-09 → 2026-03-09 (30 dias)
**Gerado em:** 2026-03-10
**Versão:** Sprint 7 — Configuração por Plano + iv_skew PRO + Multiplicadores de Regime por Plano
**Baseline (ANTES):** Sprint 6 — Thresholds Calibrados + Regime Adaptativo
**Metodologia:** Paper trading determinístico — OHLCV CoinGecko cache 12h

---

## 📊 Contexto do Mercado

| Ativo | Inicial | Final | Retorno Hold |
|-------|---------|-------|-------------|
| BTC | $69,296.81 | $67,293.79 | -2.89% |
| ETH | $2,091.04 | $1,984.11 | -5.11% |
| SOL | $87.67 | $83.34 | -4.94% |

**Benchmark BTC Hold:** -2.89%

---

## 📋 1. Comparativo Sprint 6 vs Sprint 7

| Plano | Capital | Retorno S5 | Retorno S6 | Retorno S7 | S6→S7 | vs BTC | Liq | DD |
|-------|---------|-----------|-----------|-----------|-------|--------|-----|----|
| **FREE** 🆓 | $1,000.00 | -28.62% | -28.62% | **-28.62%** | ➡️ **-0.00%** | -25.73% | 0 | 90.00% |
| **PRO** ⭐ | $10,000.00 | -53.39% | -53.65% | **-53.50%** | ➡️ **+0.15%** | -50.61% | 0 | 90.35% |
| **PREMIUM** 💎 | $25,000.00 | -25.86% | -26.04% | **-25.35%** | ➡️ **+0.69%** | -22.46% | 0 | 11.73% |
| **ENTERPRISE** 🏆 | $100,000.00 | -5.26% | -4.54% | **-3.99%** | ➡️ **+0.55%** | -1.10% | 8 | 29.21% |

### 1.1 Mudanças Sprint 7 por Plano

| Plano | Mudança | Antes (S6) | Depois (S7) | Efeito |
|-------|---------|-----------|------------|--------|
| PRO | iv_skew adicionado | ❌ Sem acesso | ✅ Ativo (ATR 15%) | +1 cérebro protetor |
| PRO | funding_rate BULL | ×0.65 | ×0.75 | Menos bloqueio de longs |
| PRO | oi_divergence BULL | ×0.65 | ×0.75 | Menos bloqueio de longs |
| PRO | iv_skew BULL | N/A | ×0.75 | Incorporado ao regime PRO |
| PRO | protetores BEAR | ×1.35 | ×1.25 | Proteção moderada em bear |
| PREMIUM | funding_rate BULL | ×0.65 | ×0.70 | Alinhado com iv_skew |
| PREMIUM | oi_divergence BULL | ×0.65 | ×0.70 | Alinhado com iv_skew |
| PREMIUM | funding_rate BEAR | ×1.35 | ×1.30 | Alinhado com iv_skew |
| PREMIUM | oi_divergence BEAR | ×1.35 | ×1.30 | Alinhado com iv_skew |
| FREE/Enterprise | Sem mudanças | — | — | Baseline inalterado |

### 1.2 Arquitetura de Thresholds por Plano (Sprint 7)

`brainWorker.ts` exporta `PLAN_THRESHOLD_CONFIGS` com a configuração documentada por plano:

| Plano | funding_rate SELL | oi_divergence priceChange | iv_skew ATR | iv_skew habilitado |
|-------|------------------|--------------------------|------------|-------------------|
| Free | 0.001 (0.10%) | 2% | N/A | ❌ Não |
| **Pro** | **0.001 (0.10%)** | **2%** | **15%** | **✅ Sprint 7** |
| Premium | 0.001 (0.10%) | 2% | 15% | ✅ Sim |
| Enterprise | 0.001 (0.10%) | 2% | 15% | ✅ Sim |

> **Nota:** Thresholds globais são idênticos (compute global, cachê Redis). A sensibilidade
> por plano é expressa nos `PLAN_REGIME_OVERRIDES` em `brainEngine.ts` (scoring stage).

### 1.3 Multiplicadores de Regime por Plano (Sprint 7)

| Categoria | Cérebros | Regime | PRO (S7) | PREMIUM (S7) | Antes S6 |
|-----------|---------|--------|----------|-------------|----------|
| Protetores | `funding_rate`, `oi_divergence`, `iv_skew` | BULL | **×0.75** | ×0.70 | ×0.65–0.70 |
| Protetores | `funding_rate`, `oi_divergence`, `iv_skew` | BEAR | **×1.25** | ×1.30 | ×1.30–1.35 |
| Trend brains | `supertrend`, `strong_trend_snowball` | BULL | ×1.25 (global) | ×1.25 (global) | ×1.25 |
| Trend brains | `supertrend`, `strong_trend_snowball` | BEAR | ×0.80 (global) | ×0.80 (global) | ×0.80 |

---

## 🤖 2. Análise por Plano

### 🆓 FREE

| Métrica | Sprint 6 | Sprint 7 | Variação |
|---------|---------|---------|----------|
| Retorno | -28.62% | **-28.62%** | ➡️ **-0.00%** |
| Drawdown | 90.00% | 90.00% | +0.00% |
| Trades | 18 | 14 | -4 |
| Brains fired | — | 0 | — |

**Notas:**
- Free S7: sem mudanças — plano Free não tem acesso a brains de regime
- 5 microcérebros básicos — iv_skew NÃO disponível no Free
- ⚡ Circuit Breaker ATIVADO: Drawdown 90.00% ≥ limite 20%

### ⭐ PRO

| Métrica | Sprint 6 | Sprint 7 | Variação |
|---------|---------|---------|----------|
| Retorno | -53.65% | **-53.50%** | ➡️ **+0.15%** |
| Drawdown | 90.00% | 90.35% | +0.35% |
| Trades | 259 | 77 | -182 |
| Brains fired | — | 385 | — |

**Notas:**
- Sprint 7 PRO: 3 cérebros (funding_rate + oi_divergence + iv_skew NOVO)
- iv_skew adicionado ao PRO: threshold ATR 15% — mesmo calibrado Premium
- Regime PRO BULL: ×0.75 protetores (S6: ×0.65) — menos bloqueio em bull
- Regime PRO BEAR: ×1.25 protetores (S6: ×1.35) — proteção moderada em bear
- ⚡ Circuit Breaker PRO ATIVADO: Drawdown 90.35% ≥ limite 30%
- Regime detectado: BULL=37 BEAR=36 RANGING=82

### 💎 PREMIUM

| Métrica | Sprint 6 | Sprint 7 | Variação |
|---------|---------|---------|----------|
| Retorno | -26.04% | **-25.35%** | ➡️ **+0.69%** |
| Drawdown | 3.52% | 11.73% | +8.21% |
| Trades | 421 | 98 | -323 |
| Brains fired | — | 666 | — |
| Skimmed | $41.60 | $1.38 | — |

**Notas:**
- Sprint 7 Premium: funding_rate/oi_divergence BULL ×0.70 (S6: ×0.65) — levemente mais permissivo
- Sprint 7 Premium: funding_rate/oi_divergence BEAR ×1.30 (S6: ×1.35) — alinhado com iv_skew
- iv_skew BULL ×0.70, BEAR ×1.30 — inalterado (já era o valor correto)
- ✅ Profit Skimming (10%): $1.38 protegido no cofre
- Regime detectado: BULL=37 BEAR=36 RANGING=79

### 🏆 ENTERPRISE

| Métrica | Sprint 6 | Sprint 7 | Variação |
|---------|---------|---------|----------|
| Retorno | -4.54% | **-3.99%** | ➡️ **+0.55%** |
| Drawdown | 5.86% | 29.21% | +23.35% |
| Trades | 756 | 217 | -539 |
| Brains fired | — | 1504 | — |
| Skimmed | $0.00 | $413.29 | — |

**Notas:**
- Sprint 7 Enterprise: mesmo que S6 mas com baseline S7 (funding_rate/oi_divergence ×0.70/1.30)
- Enterprise usa PREMIUM baseline — sem overrides de plano (maior capital, mais proteção)
- ✅ Profit Skimming (12%): $413.29 protegido no cofre
- ⚡ Circuit Breaker ENTERPRISE (15% DD) ATIVADO: Drawdown 29.21% ≥ limite 15%

---

## 📊 3. Análise dos Bots por Plano

### 🆓 FREE — Bots Individuais

| Bot | Estratégia | Capital | Retorno | Trades | DD | Status |
|-----|-----------|---------|---------|--------|----|---------|
| DCA Free EMA20 BTC | dca_ema20_free | $700.00 | -1.61% | 14 | 9.13% | ✅ |
| Grid ETH | grid_standard | $250.00 | -90.00% | 0 | 90.00% | ✅ |

### ⭐ PRO — Bots Individuais

| Bot | Estratégia | Capital | Retorno | Trades | DD | Status |
|-----|-----------|---------|---------|--------|----|---------|
| DCA Padrão BTC | dca_standard | $1,200.00 | -2.07% | 7 | 9.13% | ✅ |
| Grid ETH | grid_standard | $1,500.00 | -87.42% | 24 | 90.35% | ✅ |
| DCA Inteligente LINK | dca_intelligent | $1,000.00 | -0.53% | 5 | 1.45% | ✅ |
| Martingale SOL | martingale_standard | $1,200.00 | -0.52% | 31 | 1.33% | ✅ |
| Grid BNB | grid_standard | $1,200.00 | -90.00% | 0 | 90.00% | ✅ |
| Futures LONG 5x BTC | futures | $1,000.00 | -2.20% | 10 | 7.54% | ✅ |

*Regime detectado: BULL=37 (24%) BEAR=36 (23%) RANGING=82 (53%)*

### 💎 PREMIUM — Bots Individuais

| Bot | Estratégia | Capital | Retorno | Trades | DD | Status |
|-----|-----------|---------|---------|--------|----|---------|
| DCA Padrão BTC | dca_standard | $2,500.00 | -0.18% | 3 | 3.84% | ✅ |
| DCA Padrão ETH | dca_standard | $2,500.00 | -0.42% | 3 | 3.35% | ✅ |
| DCA Inteligente BTC | dca_intelligent | $2,000.00 | -0.82% | 7 | 1.22% | ✅ |
| DCA Inteligente ETH | dca_intelligent | $2,000.00 | +0.38% | 5 | 1.32% | ✅ |
| Grid Evolutivo BTC | grid_evolutive | $2,000.00 | -1.56% | 15 | 3.82% | ✅ |
| Grid Evolutivo ETH | grid_evolutive | $1,500.00 | +0.37% | 13 | 2.12% | ✅ |
| Martingale SOL | martingale_standard | $2,000.00 | +0.21% | 27 | 1.00% | ✅ |
| Martingale Prob LINK | martingale_prob | $2,000.00 | -0.70% | 17 | 0.77% | ✅ |
| Futures LONG 12x BTC | futures | $2,000.00 | +11.02% | 8 | 11.73% | ✅ |

*Regime detectado: BULL=37 (24%) BEAR=36 (24%) RANGING=79 (52%)*

### 🏆 ENTERPRISE — Bots Individuais

| Bot | Estratégia | Capital | Retorno | Trades | DD | Status |
|-----|-----------|---------|---------|--------|----|---------|
| DCA Padrão BTC | dca_standard | $10,000.00 | -0.84% | 7 | 5.44% | ✅ |
| DCA Padrão ETH | dca_standard | $8,000.00 | -1.11% | 7 | 5.73% | ✅ |
| DCA Inteligente BTC | dca_intelligent | $8,000.00 | -0.33% | 9 | 2.58% | ✅ |
| DCA Inteligente ETH | dca_intelligent | $8,000.00 | +0.27% | 5 | 0.94% | ✅ |
| DCA Inteligente SOL | dca_intelligent | $4,000.00 | -0.60% | 4 | 0.61% | ✅ |
| Grid Evolutivo BTC | grid_evolutive | $8,000.00 | -1.56% | 15 | 3.82% | ✅ |
| Grid Evolutivo ETH | grid_evolutive | $6,000.00 | +0.37% | 13 | 2.12% | ✅ |
| Grid Evolutivo SOL | grid_evolutive | $4,000.00 | -3.10% | 13 | 4.96% | ✅ |
| Martingale BTC | martingale_standard | $6,000.00 | -0.11% | 23 | 1.17% | ✅ |
| Martingale SOL | martingale_standard | $4,000.00 | +0.21% | 27 | 1.00% | ✅ |
| Martingale Prob ETH | martingale_prob | $6,000.00 | +2.34% | 14 | 0.32% | ✅ |
| Martingale Prob LINK | martingale_prob | $4,000.00 | +0.97% | 20 | 0.58% | ✅ |
| Bot Colaborativo BTC+ETH | collaborative | $8,000.00 | +29.27% | 24 | 3.31% | ✅ |
| Futures LONG 15x BTC | futures | $4,000.00 | -20.46% | 9 | 29.21% | ✅ |
| Futures LONG 20x ETH | futures | $3,000.00 | +4.53% | 14 | 18.24% | ⚠️ |
| Futures SHORT 20x BTC | futures | $3,000.00 | +6.14% | 13 | 13.13% | ⚠️ |

*Regime detectado: BULL=76 (26%) BEAR=72 (25%) RANGING=140 (49%)*

---

## 📋 4. Resumo Final

| Métrica | Free | Pro | Premium | Enterprise |
|---------|------|-----|---------|------------|
| Capital | $1,000.00 | $10,000.00 | $25,000.00 | $100,000.00 |
| Retorno S6 | -28.62% | -53.65% | -26.04% | -4.54% |
| Retorno S7 | **-28.62%** | **-53.50%** | **-25.35%** | **-3.99%** |
| S6→S7 | -0.00% | **+0.15%** | +0.69% | +0.55% |
| vs BTC Hold | -25.73% | -50.61% | -22.46% | -1.10% |
| Liquidações | 0 | 0 | 0 | 8 |
| Drawdown | 90.00% | 90.35% | 11.73% | 29.21% |
| Win Rate | 45.00% | 72.41% | 77.27% | 60.32% |
| Sharpe | -1.74 | -3.24 | -5.00 | -0.75 |
| Profit Factor | 0.72 | 1.64 | 1.86 | 1.00 |
| Skimmed | — | — | $1.38 | $413.29 |
| Brains PRO | 2 (S6) | **3 (+iv_skew)** | 6 | 8 |
| Regime override | — | ×0.75/1.25 | ×0.70/1.30 | ×0.70/1.30 |
| Circuit Breaker | ⚡ | ⚡ | ✅ | ⚡ |

### Portfólio Total

| Métrica | Sprint 6 | Sprint 7 | Variação |
|---------|---------|---------|----------|
| Capital total | $136,000.00 | $136,000.00 | — |
| Capital final | ~$119,298.80 | **$120,037.08** | — |
| Retorno total | -12.28% | **-11.74%** | +0.54% |
| Benchmark BTC | -2.89% | -2.89% | — |
| Alpha gerado | -9.39% | **-8.85%** | +0.54% |
| Skimmed total | — | **$414.67** | — |
| Total trades | — | **406** | — |

---

## 🔑 5. Conclusões Sprint 7

1. **iv_skew no PRO**: Adicionar iv_skew ao PRO aumenta a sensibilidade ao skew de volatilidade implícita, adicionando um sinal protetor relevante que antes era exclusivo ao Premium.
2. **Regime ×0.75 BULL para PRO**: Reduzir o dampening de 0.65→0.75 em bull permite que mais longs passem em mercados de alta, potencialmente reduzindo missed opportunities.
3. **Regime ×1.25 BEAR para PRO**: Reduzir de 1.35→1.25 em bear alinha com o perfil de risco PRO — menos proteção agressiva, mas capital menor suporta menos drawdown.
4. **PREMIUM alinhamento**: Unificar funding_rate e oi_divergence em ×0.70/1.30 (mesmo que iv_skew) simplifica a calibração e reduz inconsistências entre cérebros da mesma categoria.
5. **Impacto esperado**: PRO pode ver melhoria em períodos de bull (menos bloqueios), com trade-off de menor proteção em períodos de bear. Premium/Enterprise ficam com configuração conservadora.

---

> **Script:** `scripts/sim_sprint7.ts`
> **Cache OHLCV:** `scripts/.sim_cache/` (12h TTL, dados CoinGecko)
> **Baseline S6:** `scripts/testes_financeiros_sprint6.md`
> **Implementação:** `server/workers/brainWorker.ts` + `server/market/brainEngine.ts` + `server/payment/stripeService.ts`
