#!/bin/sh
set -e

echo "Running Prisma migrations..."
node ./node_modules/prisma/build/index.js migrate deploy --schema=./packages/db/prisma/schema.prisma
echo "Migrations complete."

echo "Starting application..."
exec node server.js
