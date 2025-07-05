#!/bin/bash
cd /home/runner/workspace
echo "Starting IndieShots server..."
exec npx tsx server/index.ts