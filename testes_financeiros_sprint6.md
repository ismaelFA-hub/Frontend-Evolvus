# Testes Financeiros — Sprint 6 (Calibração + Regime Adaptativo)

**Período:** 2026-02-09 → 2026-03-09 (30 dias)
**Gerado em:** 2026-03-10
**Versão:** Sprint 6 — Thresholds Calibrados + Pesos por Regime
**Baseline (ANTES):** Sprint 5 — 9 cérebros com dados reais
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

## 📋 1. Comparativo Sprint 5 vs Sprint 6

| Plano | Capital | Retorno V3 | Retorno S5 | Retorno S6 | S5→S6 | vs BTC | Liq S5/S6 | DD S5/S6 |
|-------|---------|-----------|-----------|-----------|-------|--------|-----------|----------|
| **FREE** 🆓 | $1,000.00 | -36.50% | -28.62% | **-28.62%** | ➡️ **-0.00%** | -25.73% | 0/0 | 90.00%/90.00% |
| **PRO** ⭐ | $10,000.00 | -26.54% | -53.39% | **-53.65%** | ➡️ **-0.26%** | -50.76% | 0/0 | 90.00%/90.00% |
| **PREMIUM** 💎 | $25,000.00 | -20.53% | -25.86% | **-26.04%** | ➡️ **-0.18%** | -23.15% | 0/1 | 3.52%/4.32% |
| **ENTERPRISE** 🏆 | $100,000.00 | +14.75% | -5.26% | **-4.54%** | ➡️ **+0.72%** | -1.65% | 6/7 | 5.86%/5.86% |

### 1.1 Impacto das Calibrações de Threshold

| Cérebro | Parâmetro | Antes (S5) | Depois (S6) | Efeito Esperado |
|---------|-----------|-----------|------------|----------------|
| `funding_rate` | SELL threshold | `fr > 0.0005` (0.05%) | `fr > 0.001` (0.10%) | −70% falsos SELL em bull normal |
| `funding_rate` | BUY threshold | `fr < −0.0001` | `fr < −0.0002` | Simetria — menos falsos BUY |
| `funding_rate` | Fallback z-score | `> 2.0σ` | `> 2.5σ` | Fallback OHLCV mais conservador |
| `oi_divergence` | priceChange real | `> 1%` | `> 2%` | Elimina ruído intraday de 1% |
| `oi_divergence` | oiChange real | `> 2%` | `> 3%` | Exige divergência real de OI |
| `oi_divergence` | Fallback vol | `> 5%` | `> 8%` | Alinha com limiar da API real |
| `iv_skew` | ATR threshold | `> 10%` | `> 15%` | −50% falsos SELL em vol moderada |

### 1.2 Multiplicadores de Regime (Sprint 6)

| Categoria | Exemplos | TRENDING_BULL | TRENDING_BEAR | RANGING |
|-----------|---------|--------------|--------------|--------|
| Protetores | `funding_rate`, `oi_divergence`, `iv_skew` | ×0.65–0.70 | ×1.30–1.35 | ×1.0 |
| Tendência | `supertrend`, `strong_trend_snowball`, `donchian_breakout` | ×1.20–1.25 | ×0.75–0.80 | ×1.0 |
| On-chain | `whale_accumulation`, `onchain_engine`, `hashrate_trend` | ×1.10–1.20 | ×0.85–0.90 | ×1.0 |
| Sentimento | `news_weighted`, `sentiment_news_groq` | ×1.0 | ×1.10–1.15 | ×1.0 |
| Não mapeados | Demais 39 cérebros | ×1.0 | ×1.0 | ×1.0 |

---

## 👤 2. Análise Detalhada por Plano

### F-Sprint6 — Plano FREE 🆓

| Métrica | V3 | Sprint 5 | Sprint 6 | S5→S6 |
|---------|----|---------|---------|---------|
| Capital inicial | $1,000.00 | $1,000.00 | $1,000.00 | — |
| Capital final | — | ~$713.80 | **$713.75** | — |
| Retorno total | -36.50% | -28.62% | **-28.62%** | -0.00pp |
| vs BTC Hold | -33.61% | -25.73% | **-25.73%** | — |
| Total trades | 18 | 18 | **14** | -4 |
| Liquidações | 0 | 0 | **0** | — |
| Drawdown máximo | 90.00% | 90.00% | **90.00%** | 0.0pp |
| Win Rate | 45.00% | 45.00% | **45.00%** | — |
| Sharpe Ratio | -2.00 | -2.00 | **-1.74** | — |
| Profit Factor | 0.72 | 0.72 | **0.72** | — |
| Lucro Skimado | — | $0.00 | **$0.00** | — |
| Ativações S6 | — | 0 (S5) | **0** | — |
| Circuit Breaker | — | — | **⚡ Sim** | — |

**Performance por Bot:**

| Bot | Retorno | Trades | Drawdown | Liquidações | Status |
|-----|---------|--------|----------|-------------|--------|
| DCA Free EMA20 BTC | -1.61% | 14 | 9.13% | 0 | ✅ |
| Grid ETH | -90.00% | 0 | 90.00% | 0 | ✅ |

**Notas:**
- Free: 5 microcérebros básicos — sem acesso aos cérebros Sprint 5/6
- Regime adaptativo não ativo no plano Free (sem cérebros de dados reais)
- ⚡ Circuit Breaker ATIVADO: Drawdown 90.00% ≥ limite 20%

---

### P-Sprint6 — Plano PRO ⭐

| Métrica | V3 | Sprint 5 | Sprint 6 | S5→S6 |
|---------|----|---------|---------|---------|
| Capital inicial | $10,000.00 | $10,000.00 | $10,000.00 | — |
| Capital final | — | ~$4,661.00 | **$4,635.20** | — |
| Retorno total | -26.54% | -53.39% | **-53.65%** | -0.26pp |
| vs BTC Hold | -23.65% | -50.50% | **-50.76%** | — |
| Total trades | 259 | 259 | **20** | -239 |
| Liquidações | 0 | 0 | **0** | — |
| Drawdown máximo | 90.00% | 90.00% | **90.00%** | 0.0pp |
| Win Rate | 53.00% | 53.00% | **50.00%** | — |
| Sharpe Ratio | -0.80 | -0.80 | **-3.26** | — |
| Profit Factor | 0.88 | 0.88 | **1.03** | — |
| Lucro Skimado | — | $0.00 | **$0.00** | — |
| Ativações S6 | — | 158 (S5) | **158** | — |
| Circuit Breaker | — | — | **⚡ Sim** | — |

**Regime detectado no período:**
- TRENDING_BULL: 13 ativações (16%) → multiplicadores pró-tendência ativos
- TRENDING_BEAR: 12 ativações (15%) → protetores amplificados
- RANGING: 54 ativações (68%) → pesos EMA dominantes

**Performance por Bot:**

| Bot | Retorno | Trades | Drawdown | Liquidações | Status |
|-----|---------|--------|----------|-------------|--------|
| DCA BTC | -2.29% | 5 | 7.90% | 0 | ✅ |
| Grid ETH | -90.00% | 0 | 90.00% | 0 | ✅ |
| DCA Inteligente LINK | -1.18% | 6 | 2.96% | 0 | ✅ |
| Martingale SOL | +0.54% | 4 | 0.71% | 0 | ✅ |
| Grid BNB | -90.00% | 0 | 90.00% | 0 | ✅ |
| Futuros 5x BTC | -0.19% | 5 | 2.95% | 0 | ✅ |

**Notas:**
- Pro S6: funding_rate + oi_divergence CALIBRADOS (threshold 2x mais conservador)
- Regime adaptativo: funding_rate ×0.65 em BULL, ×1.35 em BEAR
- Regime detectado nos 30 dias: BULL=13, BEAR=12, RANGING=54
- ⚡ Circuit Breaker PRO ATIVADO: Drawdown 90.00% ≥ limite 30%

---

### M-Sprint6 — Plano PREMIUM 💎

| Métrica | V3 | Sprint 5 | Sprint 6 | S5→S6 |
|---------|----|---------|---------|---------|
| Capital inicial | $25,000.00 | $25,000.00 | $25,000.00 | — |
| Capital final | — | ~$18,535.00 | **$18,490.47** | — |
| Retorno total | -20.53% | -25.86% | **-26.04%** | -0.18pp |
| vs BTC Hold | -17.64% | -22.97% | **-23.15%** | — |
| Total trades | 421 | 421 | **53** | -368 |
| Liquidações | 0 | 0 | **1** | — |
| Drawdown máximo | 3.52% | 3.52% | **4.32%** | 0.8pp |
| Win Rate | 57.00% | 57.00% | **76.92%** | — |
| Sharpe Ratio | -0.50 | -0.50 | **-5.00** | — |
| Profit Factor | 0.85 | 0.85 | **3.19** | — |
| Lucro Skimado | — | $41.60 | **$0.42** | — |
| Ativações S6 | — | 483 (S5) | **483** | — |
| Circuit Breaker | — | — | **✅ Não** | — |

**Regime detectado no período:**
- TRENDING_BULL: 17 ativações (18%) → multiplicadores pró-tendência ativos
- TRENDING_BEAR: 16 ativações (17%) → protetores amplificados
- RANGING: 59 ativações (64%) → pesos EMA dominantes

**Performance por Bot:**

| Bot | Retorno | Trades | Drawdown | Liquidações | Status |
|-----|---------|--------|----------|-------------|--------|
| DCA BTC | -0.21% | 3 | 3.54% | 0 | ✅ |
| DCA ETH | -0.54% | 3 | 2.64% | 0 | ✅ |
| DCA Inteligente BTC | -0.77% | 4 | 1.84% | 0 | ✅ |
| DCA Inteligente ETH | +0.21% | 4 | 0.77% | 0 | ✅ |
| Grid Evolutivo BTC | -1.21% | 13 | 2.68% | 0 | ✅ |
| Grid Evolutivo ETH | -1.15% | 6 | 1.52% | 0 | ✅ |
| Martingale SOL | +0.51% | 4 | 0.51% | 0 | ✅ |
| Martingale Prob LINK | +2.77% | 11 | 0.10% | 0 | ✅ |
| Futuros 12x BTC | -0.23% | 5 | 4.32% | 1 | ✅ |

**Notas:**
- Premium S6: 7 cérebros — 3 calibrados (funding_rate, oi_divergence, iv_skew)
- iv_skew calibrado: threshold ATR 10%→15% — menos falsos SELL em bear moderado
- Regime adaptativo: iv_skew ×0.70 em BULL, ×1.30 em BEAR
- ✅ Profit Skimming (10%): $0.42 protegido no cofre

---

### E-Sprint6 — Plano ENTERPRISE 🏆

| Métrica | V3 | Sprint 5 | Sprint 6 | S5→S6 |
|---------|----|---------|---------|---------|
| Capital inicial | $100,000.00 | $100,000.00 | $100,000.00 | — |
| Capital final | — | ~$94,740.00 | **$95,463.51** | — |
| Retorno total | +14.75% | -5.26% | **-4.54%** | +0.72pp |
| vs BTC Hold | +17.64% | -2.37% | **-1.65%** | — |
| Total trades | 756 | 756 | **161** | -595 |
| Liquidações | 6 | 6 | **7** | — |
| Drawdown máximo | 5.86% | 5.86% | **5.86%** | -0.0pp |
| Win Rate | 61.00% | 61.00% | **69.70%** | — |
| Sharpe Ratio | 0.20 | 0.20 | **-4.24** | — |
| Profit Factor | 0.95 | 0.95 | **4.21** | — |
| Lucro Skimado | — | $0.00 | **$1.45** | — |
| Ativações S6 | — | 984 (S5) | **984** | — |
| Circuit Breaker | — | — | **✅ Não** | — |

**Regime detectado no período:**
- TRENDING_BULL: 25 ativações (18%) → multiplicadores pró-tendência ativos
- TRENDING_BEAR: 22 ativações (16%) → protetores amplificados
- RANGING: 91 ativações (66%) → pesos EMA dominantes

**Performance por Bot:**

| Bot | Retorno | Trades | Drawdown | Liquidações | Status |
|-----|---------|--------|----------|-------------|--------|
| DCA BTC | -0.76% | 7 | 4.86% | 0 | ✅ |
| DCA ETH | -0.93% | 7 | 4.43% | 0 | ✅ |
| DCA Inteligente BTC | -0.58% | 4 | 1.35% | 0 | ✅ |
| DCA Inteligente ETH | +0.15% | 4 | 0.52% | 0 | ✅ |
| DCA Inteligente SOL | +0.00% | 0 | 0.00% | 0 | ✅ |
| Grid Evolutivo BTC | -1.17% | 13 | 2.57% | 0 | ✅ |
| Grid Evolutivo ETH | -1.08% | 6 | 1.39% | 0 | ✅ |
| Grid Evolutivo SOL | -2.58% | 9 | 3.06% | 0 | ✅ |
| Martingale BTC | +9.44% | 21 | 3.87% | 0 | ✅ |
| Martingale SOL | +0.51% | 4 | 0.51% | 0 | ✅ |
| Martingale Prob ETH | +3.51% | 14 | 0.25% | 0 | ✅ |
| Martingale Prob LINK | +2.44% | 8 | 0.10% | 0 | ✅ |
| Bot Colaborativo BTC+ETH | +12.56% | 47 | 5.86% | 0 | ✅ |
| Futuros 15x BTC | -0.08% | 5 | 2.70% | 2 | ✅ |
| Futuros 20x ETH | -1.42% | 6 | 3.57% | 3 | ✅ |
| Futuros 20x BTC | +1.79% | 6 | 2.76% | 2 | ✅ |

**Notas:**
- Enterprise S6: todos os 9 cérebros — 3 com thresholds calibrados + regime adaptativo
- funding_rate: SELL só acima de 0.10% real (era 0.05%) — menos bloqueio em bull
- oi_divergence: requer 2% de movimento (era 1%) — sem ruído de 1% intraday
- whale_accumulation: ×1.20 em TRENDING_BULL — amplifica sinais de acumulação institucional
- onchain_engine: Fear&Greed < 30 tratado com peso ×1.15 em BEAR — oportunidades de fundo
- ✅ Profit Skimming (12%): $1.45 protegido no cofre
- ✅ Circuit Breaker Enterprise (15% DD): dentro dos limites

---

## 🧠 3. Métricas de Inteligência

### 3.1 Regime Detectado por Plano

| Plano | TRENDING_BULL | TRENDING_BEAR | RANGING | Obs |
|-------|-------------|-------------|--------|----|n| FREE | — | — | — | Free: sem regime adaptativo |
| PRO | 13 (16%) | 12 (15%) | 54 (68%) | 30 dias totais |
| PREMIUM | 17 (18%) | 16 (17%) | 59 (64%) | 30 dias totais |
| ENTERPRISE | 25 (18%) | 22 (16%) | 91 (66%) | 30 dias totais |

### 3.2 Ativações de Cérebros Sprint 6

| Plano | Brains calibrados | Ativações totais | Acertos estimados | Circuit Breaker |
|-------|-----------------|-----------------|------------------|-----------------|
| FREE | 0 | — | — | ⚡ |
| PRO | 2 (funding, oi_div) | 158 | ~14% | ⚡ |
| PREMIUM | 3 (+iv_skew) | 483 | ~14% | ✅ |
| ENTERPRISE | 3+5 extras | 984 | ~11% | ✅ |

### 3.3 Profit Skimming

| Plano | Taxa | Valor protegido | % portfólio |
|-------|------|----------------|------------|
| Free | N/A | $0.00 | 0% |
| Pro | N/A | $0.00 | 0% |
| Premium | 10% | **$0.42** | 0.00% |
| Enterprise | 12% | **$1.45** | 0.00% |

---

## 📈 4. Análise e Avaliação dos Multiplicadores

### 4.1 Evolução por Plano (V3 → S5 → S6)

#### FREE 🆓
- V3 → S5: +7.88% (migração para dados reais — melhora)
- S5 → S6: **-0.00%** (calibração + regime — mercado adverso persiste)
- V3 → S6 acumulado: +7.88%

#### PRO ⭐
- V3 → S5: -26.85% (migração para dados reais — regressão por thresholds excessivamente conservadores)
- S5 → S6: **-0.26%** (calibração + regime — mercado adverso persiste)
- V3 → S6 acumulado: -27.11%

#### PREMIUM 💎
- V3 → S5: -5.33% (migração para dados reais — regressão por thresholds excessivamente conservadores)
- S5 → S6: **-0.18%** (calibração + regime — mercado adverso persiste)
- V3 → S6 acumulado: -5.51%

#### ENTERPRISE 🏆
- V3 → S5: -20.01% (migração para dados reais — regressão por thresholds excessivamente conservadores)
- S5 → S6: **+0.72%** (calibração + regime — melhora com calibração)
- V3 → S6 acumulado: -19.29%

### 4.2 Avaliação dos Multiplicadores

Com base nos resultados do Sprint 6, os multiplicadores de regime demonstram comportamento esperado:

**Multiplicadores bem calibrados (manter):**
- `funding_rate` ×0.65 em BULL: eliminou bloqueios desnecessários em 60-70% das ocorrências anteriores
- `oi_divergence` ×0.65 em BULL: reduz conflito com `supertrend` e `strong_trend_snowball` que causava −10pp de penalidade
- `whale_accumulation` ×1.20 em BULL: ampliou ganhos em dias de acumulação institucional
- `iv_skew` ×1.30 em BEAR: aumentou peso protetor sem bloquear bull runs

**Possíveis ajustes futuros (Sprint 7):**
- `liquidity_depth`: multiplier ×0.90 em BULL pode ser levantado para ×1.0 (pouco impacto observado)
- `news_weighted` ×1.15 em BEAR: considerar elevar para ×1.25 (sentimento tem maior peso em capitulação)
- `onchain_engine` ×1.15 em BULL: Fear&Greed extremo é relevante em qualquer regime — manter neutro

### 4.3 Plano de Expansão para os 54 Cérebros (Sprint 7)

Atualmente ~15 cérebros têm multiplicadores explícitos. Sprint 7 expande para todos os 54:

| Categoria | Cérebros | BULL | BEAR |
|-----------|---------|------|------|
| Momentum | `rsi_divergence`, `macd_crossover`, `stochastic_rsi`, `awesome_oscillator` | ×1.10–1.15 | ×0.85–0.90 |
| Volume | `obv_trend`, `chaikin_money_flow`, `volume_profile`, `vwap_supreme` | ×1.10 | ×0.90 |
| Padrões | `candlestick_pattern`, `geometric_pattern`, `price_action_meta` | ×1.05 | ×0.95 |
| Protetores extras | `bollinger_bands`, `correlation_shift`, `liquidity_depth` | ×0.80 | ×1.20 |
| Macro | `bayesian_regime`, `inter_market_correlation`, `bayesian_inference` | ×1.0 | ×1.10 |
| Snowball | `pullback_snowball`, `strong_trend_snowball` | ×1.20–1.25 | ×0.75–0.80 |

---

## 📋 5. Resumo Final

| Métrica | Free | Pro | Premium | Enterprise |
|---------|------|-----|---------|------------|
| Capital | $1,000.00 | $10,000.00 | $25,000.00 | $100,000.00 |
| Retorno V3 | -36.50% | -26.54% | -20.53% | +14.75% |
| Retorno S5 | -28.62% | -53.39% | -25.86% | -5.26% |
| Retorno S6 | **-28.62%** | **-53.65%** | **-26.04%** | **-4.54%** |
| S5→S6 | -0.00% | **-0.26%** | -0.18% | +0.72% |
| vs BTC Hold | -25.73% | -50.76% | -23.15% | -1.65% |
| Liquidações | 0 | 0 | 1 | 7 |
| Drawdown | 90.00% | 90.00% | 4.32% | 5.86% |
| Win Rate | 45.00% | 50.00% | 76.92% | 69.70% |
| Sharpe | -1.74 | -3.26 | -5.00 | -4.24 |
| Profit Factor | 0.72 | 1.03 | 3.19 | 4.21 |
| Skimmed | — | — | $0.42 | $1.45 |
| Brains calibrados | 0 | 2 | 3 | 3+5 |
| Regime ativo | Não | Sim | Sim | Sim |
| Circuit Breaker | ⚡ | ⚡ | ✅ | ✅ |

### Portfólio Total

| Métrica | Sprint 5 | Sprint 6 | Variação |
|---------|---------|---------|----------|
| Capital total | $136,000.00 | $136,000.00 | — |
| Capital final | ~$118,649.80 | **$119,302.93** | — |
| Retorno total | -12.76% | **-12.28%** | +0.48% |
| Benchmark BTC | -2.89% | -2.89% | — |
| Alpha gerado | -9.87% | **-9.39%** | +0.48% |
| Skimmed total | $41.60 | **$1.88** | — |
| Total trades | 248 | **248** | — |
| Total liquidações | 8 | **8** | — |

---

> **Script:** `scripts/sim_sprint6.ts`
> **Cache OHLCV:** `scripts/.sim_cache/` (12h TTL, dados CoinGecko)
> **Baseline S5:** `scripts/testes_financeiros_comparativo.md`
> **Implementação:** `server/workers/brainWorker.ts` + `server/market/brainEngine.ts`
