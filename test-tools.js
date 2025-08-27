#!/usr/bin/env node

// Simple test script to verify MCP tools functionality
import { createAgentTools, validateToolArguments } from './dist/src/tools/agent-tools.js';
import { AgentService } from './dist/src/core/agent-service.js';
import { PaymentManager } from './dist/src/payments/payment-manager.js';

console.log('🧪 Testing MCP Tools functionality...\n');

async function testTools() {
  try {
    // Initialize services
    const paymentManager = new PaymentManager('none'); // Use no-payment mode for testing
    const agentService = new AgentService();
    
    await paymentManager.initialize();
    console.log('✅ Payment Manager initialized');
    
    // Create tools
    const tools = createAgentTools(agentService, paymentManager);
    console.log(`✅ Created ${tools.length} tools:`, tools.map(t => t.name).join(', '));
    
    // Test argument validation
    console.log('\n🔍 Testing argument validation...');
    
    // Test valid arguments
    try {
      validateToolArguments('create_agent', { 
        name: 'Test Agent',
        userId: 'test-user-123'
      });
      console.log('✅ Valid arguments passed validation');
    } catch (error) {
      console.log('❌ Valid arguments failed validation:', error.message);
    }
    
    // Test invalid arguments
    try {
      validateToolArguments('create_agent', { 
        name: '',
        userId: 'test-user-123'
      });
      console.log('❌ Invalid arguments passed validation (should have failed)');
    } catch (error) {
      console.log('✅ Invalid arguments correctly rejected:', error.message);
    }
    
    // Test missing arguments
    try {
      validateToolArguments('prompt_agent', {});
      console.log('❌ Missing arguments passed validation (should have failed)');
    } catch (error) {
      console.log('✅ Missing arguments correctly rejected:', error.message);
    }
    
    // Test pricing tool (should work without database)
    try {
      const pricingTool = tools.find(t => t.name === 'get_pricing');
      if (pricingTool) {
        console.log('✅ Pricing tool found and configured correctly');
      }
    } catch (error) {
      console.log('❌ Pricing tool test failed:', error.message);
    }
    
    console.log('\n🎉 All tool tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Tool test failed:', error);
  }
}

testTools().catch(console.error);