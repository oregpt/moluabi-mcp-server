# Test ATXP Integration - Deployed App

Deployed URL: https://atxp-moluabi-demo.replit.app

## 1. Switch to ATXP Mode:
```bash
curl -X POST https://atxp-moluabi-demo.replit.app/api/payment-method \
  -H "Content-Type: application/json" \
  -d '{"method":"atxp"}'
```

## 2. Test List Agents (Current Issue):
```bash
curl -s https://atxp-moluabi-demo.replit.app/api/agents
```

## 3. Test Other Agent Operations:

### Get specific agent
```bash
curl -s https://atxp-moluabi-demo.replit.app/api/agents/123
```

### Create agent
```bash
curl -X POST https://atxp-moluabi-demo.replit.app/api/agents \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Agent","description":"Test from MCP team","type":"file-based"}'
```

### Update agent  
```bash
curl -X PUT https://atxp-moluabi-demo.replit.app/api/agents/123 \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Agent","description":"Updated by MCP team"}'
```

### Delete agent
```bash
curl -X DELETE https://atxp-moluabi-demo.replit.app/api/agents/999
```

## 4. Test Pricing:
```bash
curl -s https://atxp-moluabi-demo.replit.app/api/pricing
```