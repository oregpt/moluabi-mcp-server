#!/bin/bash

echo "🧪 MCP Tools Test Suite Runner"
echo "=============================="
echo ""

# Check if required environment variables are set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable not set"
    exit 1
fi

echo "📋 Test Configuration:"
echo "   Database: Connected"
echo "   Payment Mode: Testing with free tier"
echo "   ATXP Wallet: ${PAYMENT_DESTINATION:-'Not set (testing mode)'}"
echo ""

# Run the comprehensive test suite
echo "🚀 Starting comprehensive MCP tool tests..."
echo ""

tsx test-mcp-tools.js

echo ""
echo "✅ Test suite completed!"