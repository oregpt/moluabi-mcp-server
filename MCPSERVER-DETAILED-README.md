# MCP Server Detailed Technical README

## Overview
This is a comprehensive technical documentation for the **MoluAbi MCP (Model Context Protocol) Server** - a production-ready backend service that provides AI agent management capabilities through both **stdio MCP protocol** and **HTTP REST endpoints**. This server integrates with your existing MoluAbi platform and enables programmatic agent lifecycle management with comprehensive cost tracking.

## Architecture Overview

### Dual Protocol Support
The server implements **two interfaces** for maximum compatibility:
1. **stdio MCP Protocol**: Standard MCP client integration (Claude Desktop, MCP-compatible tools)
2. **HTTP REST Endpoints**: Web application integration, API testing, direct HTTP calls

### Core Technology Stack
- **Runtime**: Node.js with TypeScript
- **MCP Framework**: `@modelcontextprotocol/sdk`
- **Database**: PostgreSQL with Drizzle ORM
- **Web Framework**: Express.js (for HTTP endpoints)
- **Payment System**: Pluggable providers (ATXP, subscription, or none)

## Database Integration

### Current Connection
- **Connected to**: Your production PostgreSQL database
- **ORM**: Drizzle with type-safe operations
- **Migration Strategy**: Schema-first with `npm run db:push`

### Database Schema Analysis
The MCP server uses the following tables in your production database:

#### Core Tables
1. **`users`** - User authentication and profiles
   - `id` (varchar, UUID): Primary key
   - `email`, `first_name`, `last_name`, `profile_image_url`
   - No organization relationship currently

2. **`agents`** - AI agent entities
   - `id` (serial): Primary key  
   - `name`, `description`, `instructions`: Agent configuration
   - `owner_id` (varchar): References users.id
   - `type`: "file-based", "team", "hybrid"
   - `is_public`, `is_shareable`: Access control flags
   - `grant_all_org_access`: Organization hint (unused currently)
   - `tags` (jsonb): Metadata storage

3. **`agent_access`** - Permission management
   - `agent_id` → `agents.id`
   - `user_id` → `users.id`
   - Enables sharing agents between users

4. **`usage_records`** - Billing and analytics
   - Tracks every operation with cost and token usage
   - Links to users and agents for reporting

5. **`files`** + **`document_chunks`** - Knowledge base
   - File uploads and vector embeddings for agent context

### Critical Architecture Gap: Organization Support

**🚨 IMPORTANT BUSINESS LOGIC MISMATCH**

The MCP server was designed with organization support in mind, but your production database **lacks organization structure**:

- **MCP Tools Accept**: `organizationId` parameter
- **Database Reality**: No `organizations` table, no `organization_id` columns
- **Business Impact**: Agent creation ignores organizational context

**Recommended Alignment Options:**
1. **Add Organization Support**: Create organizations table, add foreign keys
2. **Remove Organization Parameters**: Simplify to user-only model
3. **Phase Migration**: Implement organizations in phases

## Service Architecture

### AgentService (src/core/agent-service.ts)
**Core business logic layer** handling all agent operations:

#### Agent Lifecycle Management
- **`createAgent()`**: Creates new agents with validation
- **`updateAgent()`**: Owner-only modifications  
- **`deleteAgent()`**: Permanent removal with cascade
- **`listAgents()`**: Returns owned + accessible agents
- **`getAgent()`**: Retrieves with permission check

#### Permission System
- **Owner Access**: Full control (CRUD operations)
- **Shared Access**: Read-only via `agent_access` table
- **Public Access**: Read-only for `is_public` agents
- **Access Control**: `checkAgentAccess()` validates all operations

#### AI Interaction (Currently Simulated)
- **`promptAgent()`**: Sends messages to agents
- **Response Generation**: Placeholder implementation
- **Cost Calculation**: Token-based pricing simulation
- **Integration Point**: Replace with actual AI service calls

#### Usage Tracking
- **`getUsageReport()`**: Detailed billing reports
- **Cost Recording**: Every operation tracked
- **Analytics**: Token usage, operation counts

### Payment System Architecture

#### PaymentManager (src/payments/payment-manager.ts)
**Pluggable payment architecture** with three provider implementations:

1. **NoPaymentProvider**: Free access, no validation
2. **AtxpPaymentProvider**: Pay-per-use with blockchain integration
3. **SubscriptionPaymentProvider**: Tier-based access limits

#### Cost Transparency Feature
**Every operation returns exact cost information**:
```json
{
  "success": true,
  "result": "...",
  "cost": 0.05,
  "operation": "create_agent"
}
```

#### Current Pricing Structure
```typescript
const PRICING = {
  create_agent: 0.05,
  list_agents: 0.001,
  get_agent: 0.001,
  update_agent: 0.02,
  delete_agent: 0.01,
  prompt_agent: 0.01, // Base + token costs
  add_user_to_agent: 0.005,
  remove_user_from_agent: 0.005,
  get_usage_report: 0.002,
  get_pricing: 0.001
}
```

## API Interface Documentation

### MCP Tools (10 Available)
All tools support both stdio MCP and HTTP REST interfaces:

#### 1. `create_agent`
**Purpose**: Create new AI agents
**Parameters**:
- `name` (required): Agent display name
- `description`: Purpose and capabilities  
- `instructions`: Behavioral instructions
- `userId` (required): Owner ID
- `organizationId`: **Currently ignored due to schema mismatch**
- `type`: "file-based" | "team" | "hybrid"
- `isPublic`: Public accessibility (default: false)
- `isShareable`: Can be shared (default: false)

#### 2. `list_agents`
**Purpose**: Get all accessible agents for user
**Parameters**:
- `userId` (required): Requesting user
- `limit`: Max results (1-100, default: 50)

#### 3. `get_agent`
**Purpose**: Retrieve specific agent details
**Parameters**:
- `agentId` (required): Agent identifier
- `userId` (required): Requesting user

#### 4. `update_agent`
**Purpose**: Modify agent configuration (owner only)
**Parameters**:
- `agentId` (required): Target agent
- `userId` (required): Must be owner
- Optional: `name`, `description`, `instructions`, `type`, `isPublic`, `isShareable`

#### 5. `delete_agent`
**Purpose**: Permanently remove agent (owner only)
**Parameters**:
- `agentId` (required): Target agent
- `userId` (required): Must be owner

#### 6. `prompt_agent`
**Purpose**: Send message to agent, get AI response
**Parameters**:
- `agentId` (required): Target agent
- `userId` (required): Message sender
- `message` (required): Content (1-10,000 chars)

#### 7. `add_user_to_agent`
**Purpose**: Grant user access to agent
**Parameters**:
- `agentId` (required): Target agent
- `userEmail` (required): Email of user to add
- `ownerId` (required): Agent owner granting access

#### 8. `remove_user_from_agent`
**Purpose**: Revoke user access to agent
**Parameters**:
- `agentId` (required): Target agent
- `userEmail` (required): Email of user to remove
- `ownerId` (required): Agent owner revoking access

#### 9. `get_usage_report`
**Purpose**: Detailed billing and usage analytics
**Parameters**:
- `userId` (required): Report subject
- `days`: Time window (1-365, default: 30)

#### 10. `get_pricing`
**Purpose**: Current cost information
**Parameters**: None

### HTTP REST Endpoints

#### Health & Discovery
- **`GET /`**: Health check endpoint
- **`GET /tools`**: List all available MCP tools with schemas
- **`GET /pricing`**: Current pricing information

#### MCP Tool Execution
- **`POST /mcp/call`**: Execute any MCP tool via HTTP
  ```json
  {
    "tool": "create_agent",
    "arguments": {
      "name": "My Agent",
      "userId": "user-123",
      "description": "Helper agent"
    }
  }
  ```

## Business Logic Alignment Issues

### 1. Organization Support Mismatch
**Current State**: MCP server accepts `organizationId` but ignores it
**Root Cause**: No organization tables in production database
**Business Impact**: Agents created without organizational context

### 2. Authentication Integration
**Current State**: Manual `userId` parameter required for all operations
**Platform Integration**: Should integrate with your existing auth system
**Recommendation**: Add session-based authentication for HTTP endpoints

### 3. AI Service Integration
**Current State**: Simulated AI responses with random costs
**Platform Integration**: Should connect to your existing AI infrastructure
**Critical Gap**: No actual AI model execution

### 4. File Management Integration
**Current State**: Database schema supports file uploads
**Platform Integration**: Should connect to your file storage system
**Missing**: File upload/download endpoints and processing

## Deployment Configuration

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Payment System
PAYMENT_MODE=atxp|subscription|none
ATXP_WALLET_DESTINATION=your-wallet-address

# Server
PORT=5000
NODE_ENV=production
```

### Startup Process
1. **Payment System Initialization**: Validates payment provider setup
2. **Database Connection**: Connects to PostgreSQL with connection pooling
3. **HTTP Server Launch**: Express server on port 5000
4. **MCP Server Ready**: stdio transport listening for MCP connections

### Current Deployment Status
- ✅ **HTTP Server**: Running on port 5000
- ✅ **Database**: Connected to production PostgreSQL  
- ✅ **Payment System**: ATXP provider initialized
- ✅ **MCP Protocol**: stdio transport ready
- ⚠️ **AI Integration**: Simulation only

## Integration Recommendations

### Immediate Alignment Tasks

#### 1. Organization Support Decision
**Option A: Add Organization Support**
- Create `organizations` table
- Add `organization_id` to `users` and `agents`
- Update MCP tools to use organization context
- Migrate existing data

**Option B: Remove Organization Parameters**
- Remove `organizationId` from all MCP tool schemas
- Update business logic to be user-only
- Simplify permission model

#### 2. Authentication Integration
**Current**: Manual `userId` parameter
**Recommended**: Session-based authentication
```typescript
// Add middleware to extract userId from session
app.use((req, res, next) => {
  req.userId = req.session?.user?.id;
  next();
});
```

#### 3. AI Service Integration
**Replace simulation with actual AI calls:**
```typescript
async generateAIResponse(agent: Agent, message: string): Promise<string> {
  // Replace with your AI service integration
  const response = await yourAIService.chat({
    model: agent.type,
    messages: [
      { role: "system", content: agent.instructions },
      { role: "user", content: message }
    ]
  });
  return response.content;
}
```

### Data Migration Considerations

#### Safe Schema Updates
```bash
# Current process for schema changes
npm run db:push --force
```

#### Production Database Safety
- **Never change ID column types**: Causes migration failures
- **Test schema changes**: Use development database first
- **Backup before migrations**: Critical for production safety

## Monitoring & Observability

### Logging Structure
```
🚀 MoluAbi MCP Server starting...
💸 Payment mode: ATXP (pay-per-use)
✅ ATXP SDK initialized with wallet destination
💸 Payment Provider: AtxpPaymentProvider initialized successfully
🔧 Available tools: create_agent, list_agents, get_agent, update_agent, delete_agent, prompt_agent, add_user_to_agent, remove_user_from_agent, get_usage_report, get_pricing
✅ MoluAbi MCP Server ready and listening for requests
🌐 HTTP server listening on port 5000
```

### Operation Logging
```
✅ Created agent: My Test Agent (ID: 1)
📊 Recorded usage: create_agent for user user-123, cost: $0.0500
⚠️ Payment validation failed for user user-456, action: create_agent
🗑️ Deleted agent: Old Agent (ID: 5)
```

### Error Handling
- **MCP Errors**: Proper error codes for protocol compliance
- **HTTP Errors**: Standard status codes with detailed messages
- **Database Errors**: Graceful handling with user-friendly messages
- **Payment Errors**: Clear billing validation failures

## Security Considerations

### Access Control
- **Owner Verification**: All modification operations verify ownership
- **Permission Checks**: Read operations validate access rights
- **Email Validation**: User lookup by email with existence checks
- **Input Validation**: JSON schema validation for all parameters

### Data Protection
- **No Secret Logging**: Sensitive data excluded from logs
- **SQL Injection Prevention**: Drizzle ORM with parameterized queries
- **Session Security**: Secure session configuration needed

## Performance Characteristics

### Database Optimization
- **Indexes**: Strategic indexes on foreign keys and lookup columns
- **Connection Pooling**: Managed by Drizzle and Neon
- **Query Efficiency**: Single queries for most operations

### Cost Transparency Overhead
- **Every Response**: Includes exact operation cost
- **Usage Recording**: Async database writes for performance
- **Memory Usage**: Minimal overhead for cost calculations

## Testing & Validation

### Current Test Coverage
- **Manual Testing**: `test-actual-tools.js` script available
- **Database Operations**: Tested against production schema
- **Payment Integration**: Validated with ATXP provider
- **HTTP Endpoints**: Basic functional testing completed

### Recommended Testing Strategy
1. **Unit Tests**: Service layer business logic
2. **Integration Tests**: Database operations with test data
3. **API Tests**: HTTP endpoint validation
4. **MCP Protocol Tests**: stdio transport compliance
5. **Performance Tests**: Load testing for production readiness

## Next Steps for Platform Integration

### Phase 1: Data Model Alignment
1. **Decide on organization support** (add tables vs remove parameters)
2. **Update schema** to match business requirements
3. **Migrate existing data** safely

### Phase 2: Authentication Integration  
1. **Add session middleware** for HTTP endpoints
2. **Remove manual userId parameters** from HTTP calls
3. **Integrate with platform auth system**

### Phase 3: AI Service Integration
1. **Replace simulation** with actual AI service calls
2. **Add model selection** and configuration
3. **Implement streaming responses** for real-time interaction

### Phase 4: File Management
1. **Add file upload endpoints** for agent knowledge
2. **Integrate with platform file storage**
3. **Implement vector search** for document chunks

### Phase 5: Production Hardening
1. **Add comprehensive monitoring** and alerting
2. **Implement rate limiting** and abuse prevention
3. **Add backup and recovery** procedures
4. **Performance optimization** and caching

---

## Questions for Development Team

1. **Organization Model**: Should agents belong to organizations or remain user-scoped?
2. **Authentication**: How should the MCP server integrate with your existing auth system?
3. **AI Service**: Which AI models and services should be integrated?
4. **File Storage**: How should file uploads and knowledge base integration work?
5. **Billing**: Should the payment system integration be modified for your billing model?
6. **Deployment**: How does this fit into your existing deployment and monitoring infrastructure?

This MCP server provides a solid foundation for AI agent management but requires alignment with your platform's specific business logic and infrastructure patterns.