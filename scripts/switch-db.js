#!/usr/bin/env node

/**
 * Database Provider Switcher for DarkFlow Manager
 * Usage:
 *   node scripts/switch-db.js pg       # Switch to PostgreSQL
 *   node scripts/switch-db.js sqlite   # Switch to SQLite
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const targetProvider = (process.argv[2] || '').toLowerCase();

const rootDir = path.resolve(__dirname, '..');
const prismaDir = path.join(rootDir, 'prisma');
const targetSchema = path.join(prismaDir, 'schema.prisma');

if (targetProvider === 'pg' || targetProvider === 'postgres' || targetProvider === 'postgresql') {
  const pgTemplate = path.join(prismaDir, 'schema.postgresql.prisma');
  if (!fs.existsSync(pgTemplate)) {
    console.error('❌ Template not found:', pgTemplate);
    process.exit(1);
  }
  fs.copyFileSync(pgTemplate, targetSchema);
  console.log('🐘 Configurado proveedor: PostgreSQL en prisma/schema.prisma');
  console.log('👉 Asegúrate de tener configurado DATABASE_URL en tu archivo .env:');
  console.log('   DATABASE_URL="postgresql://usuario:password@localhost:5432/darkflow?schema=public"');
} else if (targetProvider === 'sqlite') {
  const sqliteTemplate = path.join(prismaDir, 'schema.sqlite.prisma');
  if (!fs.existsSync(sqliteTemplate)) {
    console.error('❌ Template not found:', sqliteTemplate);
    process.exit(1);
  }
  fs.copyFileSync(sqliteTemplate, targetSchema);
  console.log('🗃️ Configurado proveedor: SQLite (file:./dev.db) en prisma/schema.prisma');
} else {
  console.log('Uso:');
  console.log('  node scripts/switch-db.js pg       # Cambia a PostgreSQL');
  console.log('  node scripts/switch-db.js sqlite   # Cambia a SQLite local');
  process.exit(1);
}

// Regenerate Prisma client
try {
  console.log('🔄 Ejecutando npx prisma generate...');
  execSync('npx prisma generate', { stdio: 'inherit', cwd: rootDir });
  console.log('✅ Cliente Prisma generado con éxito.');
} catch (error) {
  console.error('❌ Error regenerando cliente Prisma:', error.message);
  process.exit(1);
}
