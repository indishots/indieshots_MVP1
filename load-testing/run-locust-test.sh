#!/bin/bash

echo "🚀 Starting Locust Load Test for Image Generation API"
echo "=================================================="

cd "$(dirname "$0")"

# Check if locust is available
if ! command -v locust &> /dev/null; then
    echo "❌ Locust not found. Installing..."
    pip install locust
fi

echo "📊 Test Configuration:"
echo "   • Target: https://indieshots.replit.app"
echo "   • Focus: Image generation APIs"
echo "   • Authentication: premium@demo.com"
echo ""

# Default parameters
USERS=${1:-10}
SPAWN_RATE=${2:-2}
DURATION=${3:-60}

echo "🎯 Running headless test with:"
echo "   • Users: $USERS"
echo "   • Spawn rate: $SPAWN_RATE users/second"
echo "   • Duration: ${DURATION}s"
echo ""

# Create results directory
mkdir -p results

# Get timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "▶️  Starting load test..."

# Run Locust in headless mode
locust -f locustfile.py \
    --headless \
    --users $USERS \
    --spawn-rate $SPAWN_RATE \
    --run-time ${DURATION}s \
    --host=https://indieshots.replit.app \
    --html "results/locust-report-${USERS}users-${TIMESTAMP}.html" \
    --csv "results/locust-data-${USERS}users-${TIMESTAMP}"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Load test completed successfully!"
    echo "📄 Results saved to:"
    echo "   • HTML Report: results/locust-report-${USERS}users-${TIMESTAMP}.html"
    echo "   • CSV Data: results/locust-data-${USERS}users-${TIMESTAMP}*.csv"
    echo ""
    echo "🔍 Key metrics to check:"
    echo "   • Response times for image generation"
    echo "   • Success rate (should be >95%)"
    echo "   • OpenAI API rate limit errors (503s)"
    echo "   • Authentication success rate"
else
    echo "❌ Load test failed. Check the error messages above."
fi