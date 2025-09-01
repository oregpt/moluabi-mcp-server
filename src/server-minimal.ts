#!/usr/bin/env node

// Add comprehensive error handling to prevent crash loops
process.on('uncaughtException', (error) => {
  console.error('❌ UNCAUGHT EXCEPTION:', error);
  console.error('❌ Stack:', error.stack);
  console.error('🔄 Attempting graceful shutdown...');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION at:', promise, 'reason:', reason);
  console.error('🔄 Attempting graceful shutdown...');
  process.exit(1);
});

import express, { Request, Response } from "express";
import dotenv from 'dotenv';

console.log('🚀 Starting minimal server for debugging...');

// Load environment variables
dotenv.config();

// Create our Express application
const app = express();

// Configure our Express application to parse JSON bodies
app.use(express.json());

console.log('✅ Express app created');

// Add basic middleware
app.use((req, res, next) => {
  console.log(`📝 ${req.method} ${req.path}`);
  next();
});

console.log('✅ Basic middleware added');

// Add health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'MoluAbi MCP Server (Minimal)',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    port: parseInt(process.env.PORT || '5000', 10),
    debug: 'minimal_server_test'
  });
});

console.log('✅ Health endpoint registered');

// Setup basic POST endpoint
app.post('/', async (req: Request, res: Response) => {
  console.log('🔥 POST request received:', req.body);
  res.status(200).json({
    message: 'Minimal server running',
    received: req.body,
    timestamp: new Date().toISOString()
  });
});

console.log('✅ POST endpoint registered');

// Add catch-all handler with proper pattern syntax  
app.use((req, res, next) => {
  // Only handle unmatched routes
  if (req.path !== '/' && req.path !== '/health') {
    console.log(`🚨 UNHANDLED REQUEST: ${req.method} ${req.path}`);
    res.status(404).json({ 
      error: 'Route not found', 
      method: req.method, 
      path: req.path,
      available_endpoints: ['POST /', 'GET /health']
    });
  } else {
    next();
  }
});

console.log('✅ Catch-all handler registered');

// Start the server
const PORT = parseInt(process.env.PORT || '5000', 10);

console.log(`🔧 Starting server on port ${PORT}...`);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Minimal MCP Server listening on port ${PORT}`);
  console.log(`🌐 Server URL: http://localhost:${PORT}/`);
  console.log('✅ Server started successfully - minimal version working');
});

// Add graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🔄 Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server shut down complete');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🔄 Received SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server shut down complete');
    process.exit(0);
  });
});

console.log('✅ Minimal server setup complete');