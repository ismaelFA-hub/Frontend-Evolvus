#!/usr/bin/env node

/**
 * Evolvus Core Quantum — Script de Build
 *
 * Para gerar um APK/IPA de preview para testes no celular, use EAS:
 *
 *   npx eas build --profile preview --platform android
 *   npx eas build --profile preview --platform ios
 *
 * Para publicar uma atualização OTA (Over The Air):
 *
 *   npx eas update --branch main --message "sua mensagem"
 *
 * Para rodar em desenvolvimento com tunnel (celular via Expo Go):
 *
 *   npm run expo:dev
 *   (ou: npx expo start --tunnel)
 *
 * Documentação completa: README.md
 */

console.log("Use 'npm run expo:dev' para desenvolvimento ou 'npx eas build' para builds de produção.");
console.log("Consulte o README.md para mais informações.");
process.exit(0);
