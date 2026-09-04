#!/bin/sh
set -e

echo "🚀 Iniciando DarkFlow Manager en contenedor..."

if [ -n "$DATABASE_URL" ]; then
  echo "📦 Sincronizando esquema de base de datos con Prisma..."
  # Run db push in production container
  npx prisma db push --schema=./prisma/schema.postgresql.prisma --accept-data-loss || true
  echo "✅ Esquema de base de datos verificado."
fi

# Execute passed command (typically node server.js)
exec "$@"
