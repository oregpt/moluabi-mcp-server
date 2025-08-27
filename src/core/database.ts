import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import {
  agents,
  users, 
  agentAccess,
  files,
  documentChunks,
  usageRecords,
  type Agent,
  type User,
  type InsertAgent,
  type AgentAccess,
  type UsageRecord,
} from "../../shared/schema.js";

// Get database URL from environment
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

const sql = neon(databaseUrl);
export const db = drizzle(sql);

// Export types and tables for use in services
export { 
  agents, 
  users, 
  agentAccess, 
  files, 
  documentChunks, 
  usageRecords 
};

export type { 
  Agent, 
  User, 
  InsertAgent, 
  AgentAccess, 
  UsageRecord 
};
