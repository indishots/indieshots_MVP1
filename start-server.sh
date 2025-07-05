#!/bin/bash
cd "$(dirname "$0")"
export NODE_ENV=development
exec npx tsx server/index.ts