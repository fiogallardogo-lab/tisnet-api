#!/bin/sh

set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Starting TISNET API..."
exec node dist/main