import path from 'node:path'
import dotenv from 'dotenv'
import { defineConfig } from 'prisma/config'

dotenv.config()

export default defineConfig({
  schema: path.join('packages', 'db', 'prisma', 'schema.prisma'),
  migrations: {
    seed: 'npx tsx packages/db/seed.ts',
  },
})
