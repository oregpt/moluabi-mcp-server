# MoluAbi MCP Server

> **Production-ready Model Context Protocol server for AI agent management**

This is a standalone **Model Context Protocol (MCP) server** that provides programmatic access to MoluAbi's AI agent management platform. It offers 10 comprehensive tools for creating, managing, and interacting with AI assistants through a secure, payment-aware architecture.

## 🎯 What This Provides

This MCP server enables **complete AI agent lifecycle management**:

- **Create agents** with custom instructions and capabilities
- **Manage permissions** with granular access control
- **Real-time interaction** with AI assistants
- **Usage tracking** and billing integration
- **Payment abstraction** supporting multiple billing models
- **Database integration** with PostgreSQL
- **Security validation** and user authentication

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- PostgreSQL database (existing MoluAbi schema)
- Environment variables configured

### Installation

```bash
# Clone or copy this directory
cd mcp-server

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Build the server
npm run build
