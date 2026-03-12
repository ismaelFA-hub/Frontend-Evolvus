#!/usr/bin/env node
/**
 * setup-env.js — Configuração automática do .env
 *
 * Uso:
 *   npm run setup -- gsk_sua_chave_aqui
 *   npm run setup -- gsk_sua_chave_aqui AIza_sua_gemini_key
 *   node scripts/setup-env.js gsk_sua_chave_aqui
 *
 * O script:
 *   1. Copia .env.example → .env (se ainda não existir)
 *   2. Substitui GROQ_API_KEY (obrigatório)
 *   3. Substitui GEMINI_API_KEY (opcional, segundo argumento)
 *   4. Gera JWT_SECRET e ENCRYPTION_KEY aleatórios se ainda forem placeholder
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const ENV_EXAMPLE = path.join(ROOT, '.env.example');
const ENV_FILE = path.join(ROOT, '.env');

// ── Detect wrong directory ────────────────────────────────────────────────────
const PKG_FILE = path.join(ROOT, 'package.json');
if (!fs.existsSync(PKG_FILE)) {
  // Try to get repo URL from git config, fallback to GitHub URL
  let repoUrl = 'https://github.com/ismaelFA-hub/Evolvus-Core-Quantum.git';
  try {
    const { execSync } = require('child_process');
    const remote = execSync('git config --get remote.origin.url', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    if (remote) repoUrl = remote;
  } catch (_) { /* git not available, use default */ }

  console.error('\n❌ ERRO: package.json não encontrado!');
  console.error('   Você está no diretório errado.\n');
  console.error('📋 SOLUÇÃO — cole estes comandos no terminal:\n');
  console.error('   # 1. Clone o repositório (se ainda não clonou)');
  console.error(`   git clone ${repoUrl}\n`);
  console.error('   # 2. Entre na pasta do projeto');
  console.error('   cd Evolvus-Core-Quantum\n');
  console.error('   # 3. Instale as dependências');
  console.error('   npm install\n');
  console.error('   # 4. Configure o ambiente com sua chave Groq');
  console.error('   npm run setup -- gsk_sua_chave_aqui\n');
  console.error('💡 Obtenha sua chave grátis em: https://console.groq.com/keys\n');
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function setEnvVar(content, key, value) {
  const regex = new RegExp(`^(${key}=).*$`, 'm');
  if (regex.test(content)) {
    return content.replace(regex, `$1${value}`);
  }
  // Append at end if not found
  return content.trimEnd() + `\n${key}=${value}\n`;
}

const KNOWN_PLACEHOLDERS = new Set([
  'troque-isso-em-producao-use-string-aleatoria-de-48-chars-minimo',
  'troque-isso-em-producao-string-diferente-do-jwt-secret',
  'troque-isso-em-producao-exatamente-64-chars-hex-aqui-sim000000',
  'gsk_coloque-sua-chave-aqui-de-console-groq-com',
]);

function isPlaceholder(value) {
  if (!value || value.length < 10) return true;
  if (KNOWN_PLACEHOLDERS.has(value)) return true;
  if (value.startsWith('troque-')) return true;
  return false;
}

function getEnvVar(content, key) {
  const match = content.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return match ? match[1].trim() : null;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const groqKey = args[0];
const geminiKey = args[1];

console.log('\n🚀 Evolvus Setup — Configuração do Ambiente\n');

// Validate GROQ key format
if (!groqKey) {
  console.error('❌ Erro: você precisa passar sua GROQ API key como argumento.');
  console.error('\n📋 Como usar:');
  console.error('   npm run setup -- gsk_sua_chave_aqui\n');
  console.error('💡 Obtenha sua chave gratuita em: https://console.groq.com/keys\n');
  process.exit(1);
}

if (!groqKey.startsWith('gsk_')) {
  console.error(`❌ Erro: a chave não parece ser uma GROQ API key válida.`);
  console.error('   As chaves do Groq começam com "gsk_"');
  console.error(`   Você enviou: ${groqKey.substring(0, 8)}...`);
  console.error('\n💡 Obtenha sua chave em: https://console.groq.com/keys\n');
  process.exit(1);
}

// Step 1: Create .env from .env.example if needed
if (!fs.existsSync(ENV_FILE)) {
  if (!fs.existsSync(ENV_EXAMPLE)) {
    console.error('❌ Arquivo .env.example não encontrado. Execute na pasta raiz do projeto.');
    process.exit(1);
  }
  fs.copyFileSync(ENV_EXAMPLE, ENV_FILE);
  console.log('📄 Criado: .env (copiado de .env.example)');
} else {
  console.log('📄 Encontrado: .env existente (será atualizado)');
}

// Step 2: Read current .env
let content = fs.readFileSync(ENV_FILE, 'utf8');

// Step 3: Set GROQ_API_KEY
content = setEnvVar(content, 'GROQ_API_KEY', groqKey);
console.log(`✅ GROQ_API_KEY configurada: ${groqKey.substring(0, 8)}...${groqKey.slice(-4)}`);

// Step 4: Set GEMINI_API_KEY (optional)
if (geminiKey) {
  // Replace the commented example line directly to keep .env clean
  if (/^#\s*GEMINI_API_KEY=/m.test(content)) {
    content = content.replace(/^#\s*GEMINI_API_KEY=.*$/m, `GEMINI_API_KEY=${geminiKey}`);
  } else {
    content = setEnvVar(content, 'GEMINI_API_KEY', geminiKey);
  }
  console.log(`✅ GEMINI_API_KEY configurada: ${geminiKey.substring(0, 8)}...`);
}

// Step 5: Generate secure JWT_SECRET if still placeholder
const currentJwt = getEnvVar(content, 'JWT_SECRET');
if (isPlaceholder(currentJwt)) {
  const newJwtSecret = crypto.randomBytes(48).toString('hex');
  content = setEnvVar(content, 'JWT_SECRET', newJwtSecret);
  console.log('🔐 JWT_SECRET gerado automaticamente (seguro)');
}

// Step 6: Generate JWT_REFRESH_SECRET if still placeholder (must differ from JWT_SECRET)
const currentRefresh = getEnvVar(content, 'JWT_REFRESH_SECRET');
if (isPlaceholder(currentRefresh)) {
  const newRefreshSecret = crypto.randomBytes(48).toString('hex');
  content = setEnvVar(content, 'JWT_REFRESH_SECRET', newRefreshSecret);
  console.log('🔐 JWT_REFRESH_SECRET gerado automaticamente (seguro)');
}

// Step 7: Generate ENCRYPTION_KEY if still placeholder
const currentEnc = getEnvVar(content, 'ENCRYPTION_KEY');
if (isPlaceholder(currentEnc)) {
  const newEncKey = crypto.randomBytes(32).toString('hex');
  content = setEnvVar(content, 'ENCRYPTION_KEY', newEncKey);
  console.log('🔐 ENCRYPTION_KEY gerada automaticamente (AES-256)');
}

// Step 8: Write back
fs.writeFileSync(ENV_FILE, content, 'utf8');

console.log('\n✨ Configuração completa! Seu .env está pronto.\n');
console.log('▶️  Para iniciar o projeto:');
console.log('   npm run dev\n');
