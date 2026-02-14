#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy --schema=./packages/db/prisma/schema.prisma
echo "Migrations complete."

echo "Starting application..."
exec node server.js
