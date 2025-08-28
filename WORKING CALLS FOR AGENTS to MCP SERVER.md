# Working Calls for Agents to MCP Server

## Overview
This document provides complete examples of all 10 MCP tools available for AI agent management. Each example includes the exact curl command and expected response format.

**Server Endpoint:** `http://localhost:5000/mcp/call`  
**Authentication:** API key in format `mab_...`  
**Content-Type:** `application/json`

---

## 1. GET PRICING
Retrieve current model and operation costs

**Call:**
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"tool":"get_pricing","arguments":{"apiKey":"mab_your_api_key"}}' \
  http://localhost:5000/mcp/call
```

**Response:**
```json
{
  "success": true,
  "pricing": {
    "models": {
      "gpt-4": {"inputCost": 0.03, "outputCost": 0.06},
      "gpt-3.5-turbo": {"inputCost": 0.0015, "outputCost": 0.002},
      "claude-3": {"inputCost": 0.025, "outputCost": 0.075}
    },
    "operations": {
      "create_agent": 0.05,
      "list_agents": 0.001,
      "get_agent": 0.001,
      "update_agent": 0.02,
      "delete_agent": 0.01,
      "prompt_agent": 0.01,
      "add_user_to_agent": 0.005,
      "remove_user_from_agent": 0.005,
      "get_usage_report": 0.002,
      "get_pricing": 0.001
    }
  },
  "cost": 0.001,
  "operation": "get_pricing"
}
```

---

## 2. CREATE AGENT
Create a new AI agent

**Call:**
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"tool":"create_agent","arguments":{"apiKey":"mab_your_api_key","name":"My New Agent","description":"Agent for customer support","type":"file-based"}}' \
  http://localhost:5000/mcp/call
```

**Response:**
```json
{
  "success": true,
  "agent": {
    "success": true,
    "agent": {
      "id": 87,
      "name": "My New Agent",
      "description": "Agent for customer support",
      "instructions": "",
      "type": "file-based",
      "isPublic": false,
      "isShareable": false,
      "createdAt": "2025-08-28T02:42:26.233Z",
      "updatedAt": "2025-08-28T02:42:26.233Z"
    }
  },
  "cost": 0.05,
  "operation": "create_agent",
  "organizationId": "oregpt"
}
```

---

## 3. LIST AGENTS
Get all agents in your organization

**Call:**
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"tool":"list_agents","arguments":{"apiKey":"mab_your_api_key"}}' \
  http://localhost:5000/mcp/call
```

**Response:**
```json
{
  "success": true,
  "agents": [
    {
      "id": 1,
      "name": "Customer Support Agent",
      "description": "Handles customer inquiries",
      "type": "file-based",
      "isPublic": true,
      "isShareable": true,
      "createdAt": "2025-07-12T18:43:56.974Z",
      "updatedAt": "2025-08-28T02:16:40.935Z"
    }
  ],
  "cost": 0.001,
  "operation": "list_agents",
  "organizationId": "oregpt"
}
```

---

## 4. GET AGENT
View specific agent details

**Call:**
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"tool":"get_agent","arguments":{"apiKey":"mab_your_api_key","agentId":1}}' \
  http://localhost:5000/mcp/call
```

**Response:**
```json
{
  "success": true,
  "agent": {
    "success": true,
    "agent": {
      "id": 1,
      "name": "Customer Support Agent",
      "description": "Handles customer inquiries",
      "instructions": "## Core Purpose\nI am a customer support agent...",
      "type": "file-based",
      "isPublic": true,
      "isShareable": true,
      "createdAt": "2025-07-12T18:43:56.974Z",
      "updatedAt": "2025-08-28T02:16:40.935Z"
    }
  },
  "cost": 0.001,
  "operation": "get_agent",
  "organizationId": "oregpt"
}
```

---

## 5. UPDATE AGENT
Modify agent properties

**Call:**
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"tool":"update_agent","arguments":{"apiKey":"mab_your_api_key","agentId":1,"name":"Updated Agent Name","description":"Updated description"}}' \
  http://localhost:5000/mcp/call
```

**Response:**
```json
{
  "success": true,
  "agent": {
    "success": true,
    "agent": {
      "id": 1,
      "name": "Updated Agent Name",
      "description": "Updated description",
      "instructions": "## Core Purpose\nI am a customer support agent...",
      "type": "file-based",
      "isPublic": true,
      "isShareable": true,
      "updatedAt": "2025-08-28T02:42:28.885Z"
    }
  },
  "cost": 0.02,
  "operation": "update_agent",
  "organizationId": "oregpt"
}
```

---

## 6. ADD USER ACCESS
Grant user access to specific agent

**Call:**
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"tool":"add_user_to_agent","arguments":{"apiKey":"mab_your_api_key","agentId":1,"userEmail":"user@example.com"}}' \
  http://localhost:5000/mcp/call
```

**Response:**
```json
{
  "success": true,
  "message": "Access granted to user@example.com",
  "cost": 0.005,
  "operation": "add_user_to_agent",
  "organizationId": "oregpt"
}
```

---

## 7. CHAT WITH AGENT
Send message and get AI response (with optional model selection)

**Call:**
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"tool":"prompt_agent","arguments":{"apiKey":"mab_your_api_key","agentId":1,"message":"Hello! How can you help me?","model":"gpt-5"}}' \
  http://localhost:5000/mcp/call
```

**Response (✅ FULLY WORKING):**
```json
{
  "success": true,
  "response": "Hello! I'm here to help you with your questions and provide assistance...",
  "conversationId": 174,
  "tokensUsed": 0,
  "cost": 0.01,
  "operation": "prompt_agent",
  "organizationId": "oregpt"
}
```

**Note:** 
- Model parameter is optional. Available models: `gpt-5`, `claude`, `grok`
- ✅ **STATUS**: Fully working in both production and development environments

---

## 8. REMOVE USER ACCESS
Revoke user access from specific agent

**Call:**
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"tool":"remove_user_from_agent","arguments":{"apiKey":"mab_your_api_key","agentId":1,"userEmail":"user@example.com"}}' \
  http://localhost:5000/mcp/call
```

**Response:**
```json
{
  "success": true,
  "message": "Access removed for user@example.com",
  "cost": 0.005,
  "operation": "remove_user_from_agent",
  "organizationId": "oregpt"
}
```

---

## 9. GET USAGE REPORT
View account usage and billing

**Call:**
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"tool":"get_usage_report","arguments":{"apiKey":"mab_your_api_key","days":7}}' \
  http://localhost:5000/mcp/call
```

**Response:**
```json
{
  "success": true,
  "report": {
    "success": true,
    "usage": {
      "totalRequests": 12,
      "totalTokens": 163,
      "totalCost": 0,
      "breakdown": {
        "embedding_generation": 12
      }
    }
  },
  "cost": 0.002,
  "operation": "get_usage_report",
  "organizationId": "oregpt"
}
```

---

## 10. DELETE AGENT
Permanently remove agent

**Call:**
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"tool":"delete_agent","arguments":{"apiKey":"mab_your_api_key","agentId":87}}' \
  http://localhost:5000/mcp/call
```

**Response:**
```json
{
  "success": true,
  "message": "Agent 87 deleted successfully",
  "cost": 0.01,
  "operation": "delete_agent",
  "organizationId": "oregpt"
}
```

---

## API Key Requirements

- **Format:** Must start with `mab_` followed by hexadecimal characters
- **Permissions:** Different operations require different permissions:
  - `agents:read` - For viewing agents and lists
  - `agents:write` - For creating and updating agents
  - `agents:delete` - For deleting agents
  - `users:write` - For managing user access
  - `chat:write` - For agent interactions

## Error Handling

All tools return consistent error responses:

```json
{
  "success": false,
  "error": "Description of the error",
  "cost": 0
}
```

Common errors:
- `"Invalid API key"` - API key format incorrect or not found
- `"Permission denied"` - Insufficient permissions for operation
- `"No access to this agent"` - Agent not accessible with current permissions

## Cost Tracking

Every successful operation includes:
- `cost` - The cost in USD for this operation
- `operation` - The name of the operation performed
- `organizationId` - Your organization identifier

All costs are automatically processed through ATXP payment system.

---

## Status Summary
✅ **10/10 Tools Working Perfectly**
- All agent management operations functional
- User access management working
- Cost tracking and billing operational
- Authentication and permissions working
- **Chat functionality fully operational**

🚀 **MCP Server Status**: **100% OPERATIONAL** - All tools working perfectly

## Getting Started

1. Obtain your MCP API key from the MoluAbi platform
2. Test with the `get_pricing` tool to verify connectivity
3. Create your first agent with `create_agent`
4. Start building your AI agent management workflow!