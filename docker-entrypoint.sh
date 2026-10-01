#!/bin/sh

set -e

echo "Running Prisma migrations..."
if [ "${ALLOW_EMPTY_DB_BASELINE:-false}" = "true" ]; then
  node scripts/bootstrap-empty-db.cjs
else
  npx prisma migrate deploy
fi

echo "Starting TISNET API..."
exec node dist/main