#!/usr/bin/env node
/**
 * setup-railway-vars.js — Configura variáveis de ambiente no Railway via CLI
 *
 * Pré-requisito: Railway CLI instalado e autenticado
 *   npm install -g @railway/cli
 *   railway login
 *   railway link    (dentro da pasta do projeto, selecione seu serviço)
 *
 * Uso:
 *   npm run setup:railway                    # apenas secrets (auto-gerados)
 *   npm run setup:railway -- gsk_sua_chave   # com GROQ_API_KEY
 *
 * O script define automaticamente no Railway:
 *   NODE_ENV, PORT, JWT_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY
 * Opcionalmente:
 *   GROQ_API_KEY (se passado como primeiro argumento)
 */

const crypto = require('crypto');
const { spawnSync } = require('child_process');

// Keys whose values are safe to display in full
const NON_SENSITIVE_KEYS = new Set(['NODE_ENV', 'PORT']);

// ── Helpers ──────────────────────────────────────────────────────────────────

function railwaySet(key, value) {
  // Use spawnSync with array args to avoid shell injection
  const result = spawnSync('railway', ['variables', 'set', `${key}=${value}`], {
    stdio: 'pipe',
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    const msg = (result.stderr || result.error?.message || 'erro desconhecido').trim();
    console.error(`  ❌ Falhou ao definir ${key}: ${msg}`);
    process.exit(1);
  }
  const display = NON_SENSITIVE_KEYS.has(key)
    ? value
    : `${value.substring(0, 4)}...${value.slice(-4)}`;
  console.log(`  ✅ ${key} = ${display}`);
}

function checkRailwayCLI() {
  const result = spawnSync('railway', ['--version'], { stdio: 'pipe' });
  if (result.status !== 0 || result.error) {
    console.error('\n❌ Railway CLI não encontrado.');
    console.error('   Instale com:  npm install -g @railway/cli');
    console.error('   Depois autentique:  railway login');
    console.error('   E vincule o projeto:  railway link\n');
    process.exit(1);
  }
}

function checkRailwayLinked() {
  const result = spawnSync('railway', ['status'], { stdio: 'pipe' });
  if (result.status !== 0 || result.error) {
    console.error('\n❌ Nenhum projeto Railway vinculado.');
    console.error('   Execute:  railway link');
    console.error('   Selecione seu projeto e serviço, depois rode este script novamente.\n');
    process.exit(1);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const groqKey = args[0];

console.log('\n🚀 Evolvus — Configuração de variáveis no Railway\n');

checkRailwayCLI();
checkRailwayLinked();

if (groqKey && !groqKey.startsWith('gsk_')) {
  // 'gsk_' is the current Groq API key prefix (as of 2024); update if Groq changes it
  console.error(`❌ Argumento passado não parece ser uma GROQ API key válida.`);
  console.error('   As chaves do Groq começam com "gsk_"');
  console.error('\n💡 Obtenha sua chave em: https://console.groq.com/keys\n');
  process.exit(1);
}

console.log('📦 Definindo variáveis no Railway...\n');

// Non-sensitive defaults
railwaySet('NODE_ENV', 'production');
railwaySet('PORT', '3001');

// 48 bytes = 384 bits — sufficient entropy for HMAC-SHA256/SHA512 JWT signing
const jwtSecret = crypto.randomBytes(48).toString('hex');
railwaySet('JWT_SECRET', jwtSecret);

// Must differ from JWT_SECRET to prevent token type confusion attacks
const jwtRefreshSecret = crypto.randomBytes(48).toString('hex');
railwaySet('JWT_REFRESH_SECRET', jwtRefreshSecret);

// 32 bytes = 256 bits — required for AES-256-GCM encryption
const encryptionKey = crypto.randomBytes(32).toString('hex');
railwaySet('ENCRYPTION_KEY', encryptionKey);

// Optional: GROQ_API_KEY
if (groqKey) {
  railwaySet('GROQ_API_KEY', groqKey);
}

console.log('\n✨ Variáveis configuradas com sucesso no Railway!');
console.log('\n📌 Próximos passos:');
console.log('   1. No painel Railway, adicione um PostgreSQL ao projeto');
console.log('      → O Railway injetará DATABASE_URL automaticamente');
console.log('   2. (Opcional) Adicione um Redis → REDIS_URL injetado automaticamente');
if (!groqKey) {
  console.log('   3. Defina GROQ_API_KEY manualmente em Variables (para IA):');
  console.log('      railway variables set "GROQ_API_KEY=gsk_sua_chave"');
  console.log('      Obtenha em: https://console.groq.com/keys');
}
console.log('\n🔗 Verifique todas as variáveis com: railway variables\n');
