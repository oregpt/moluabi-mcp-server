# Overview

MoluAbi MCP Server is a production-ready Model Context Protocol (MCP) server that provides comprehensive AI agent management capabilities. The system enables programmatic creation, management, and interaction with AI agents through a standardized MCP interface. It serves as a backend service that can be consumed by MCP-compatible clients, offering 10 comprehensive tools for complete AI agent lifecycle management including real-time interaction, permission management, and usage tracking.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Backend Architecture
The server is built using TypeScript with a modular, service-oriented architecture. The core is structured around three main layers:

**Core Services Layer**: Contains the `AgentService` which handles all agent-related business logic including creation, management, permissions, and interactions. The `database.ts` module provides data access using Drizzle ORM with PostgreSQL as the primary data store.

**MCP Protocol Layer**: Implements the Model Context Protocol specification using the `@modelcontextprotocol/sdk`. The main server (`server.ts`) handles tool registration and request routing, supporting both tool listing and execution requests.

**Payment System Architecture**: Features a pluggable payment abstraction layer with three provider implementations:
- **NoPaymentProvider**: Free tier access with no payment validation
- **AtxpPaymentProvider**: Pay-per-use model with transaction-based billing
- **SubscriptionPaymentProvider**: Tier-based access with usage limits

## Data Storage Architecture
Uses PostgreSQL as the primary database with Drizzle ORM for type-safe database operations. The schema includes:
- **Users table**: Authentication and profile management
- **Agents table**: Core AI agent entities with metadata
- **Agent Access table**: Granular permission management
- **Usage Records table**: Billing and analytics tracking
- **Sessions table**: Authentication session storage

## Tool System Design
Implements 10 MCP tools through a centralized tool factory pattern:
- Agent lifecycle management (create, update, delete, list)
- Permission management (grant/revoke access)
- Real-time interaction capabilities
- Usage monitoring and billing integration

The tools use JSON schema validation for input parameters and provide detailed error handling with appropriate MCP error codes.

## Authentication & Security
Session-based authentication using Express sessions with PostgreSQL storage. Supports OAuth integration through Passport.js with OpenID Connect. All database operations include user-based access control validation.

# External Dependencies

## Core Framework Dependencies
- **@modelcontextprotocol/sdk**: Provides MCP protocol implementation and type definitions
- **TypeScript**: Primary development language with strict type checking
- **tsx**: Development runtime for TypeScript execution

## Database & ORM
- **@neondatabase/serverless**: Serverless PostgreSQL connection handling with WebSocket support
- **drizzle-orm**: Type-safe database ORM with migration support
- **drizzle-kit**: Database schema management and migration tools

## Authentication & Security
- **express**: Web framework for HTTP handling
- **express-session**: Session management middleware
- **connect-pg-simple**: PostgreSQL session store
- **passport**: Authentication middleware
- **openid-client**: OAuth/OpenID Connect client implementation

## Utility Libraries
- **zod**: Schema validation and type inference
- **memoizee**: Function result caching for performance optimization
- **ws**: WebSocket implementation for real-time features

## Development Tools
- **@types/node**: Node.js type definitions
- **@types/memoizee**: Type definitions for memoization library

The system is designed to work with existing MoluAbi database schemas and can be deployed as a standalone service or integrated into larger MoluAbi platform deployments.