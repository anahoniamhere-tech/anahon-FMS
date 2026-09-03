#!/bin/sh
set -e
# Apply pending schema migrations to the mounted SQLite file, then serve.
npx prisma migrate deploy
exec node dist/server.js
