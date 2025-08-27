import { sql, relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
  serial,
} from "drizzle-orm/pg-core";

// Session storage table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Agents table - core AI assistant entities
export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  instructions: text("instructions"),
  ownerId: varchar("owner_id").notNull().references(() => users.id),
  type: varchar("type", { length: 50 }).default("file-based").notNull(),
  isPublic: boolean("is_public").default(false).notNull(),
  isShareable: boolean("is_shareable").default(false).notNull(),
  grantAllOrgAccess: boolean("grant_all_org_access").default(false).notNull(),
  tags: jsonb("tags").default([]).notNull(),
  isAnonymous: boolean("is_anonymous").default(false).notNull(),
  conversationLoggingEnabled: boolean("conversation_logging_enabled").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Agent access control - who can access which agents
export const agentAccess = pgTable("agent_access", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => agents.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_agent_access_agent_id").on(table.agentId),
  index("idx_agent_access_user_id").on(table.userId),
]);

// Files table for agent knowledge base
export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id, { onDelete: 'cascade' }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type", { length: 100 }),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

// Document chunks for vector storage and retrieval
export const documentChunks = pgTable("document_chunks", {
  id: serial("id").primaryKey(),
  fileId: integer("file_id").references(() => files.id, { onDelete: 'cascade' }),
  agentId: integer("agent_id").references(() => agents.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  embedding: jsonb("embedding"), // Vector embeddings for semantic search
  chunkIndex: integer("chunk_index").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_document_chunks_agent_id").on(table.agentId),
  index("idx_document_chunks_file_id").on(table.fileId),
]);

// Usage tracking for billing and analytics
export const usageRecords = pgTable("usage_records", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  agentId: integer("agent_id").references(() => agents.id),
  action: varchar("action", { length: 100 }).notNull(),
  cost: integer("cost").default(0), // Cost in cents
  tokensUsed: integer("tokens_used").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_usage_records_user_id").on(table.userId),
  index("idx_usage_records_created_at").on(table.createdAt),
]);

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  ownedAgents: many(agents),
  agentAccess: many(agentAccess),
  usageRecords: many(usageRecords),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  owner: one(users, {
    fields: [agents.ownerId],
    references: [users.id],
  }),
  agentAccess: many(agentAccess),
  files: many(files),
  documentChunks: many(documentChunks),
  usageRecords: many(usageRecords),
}));

export const agentAccessRelations = relations(agentAccess, ({ one }) => ({
  agent: one(agents, {
    fields: [agentAccess.agentId],
    references: [agents.id],
  }),
  user: one(users, {
    fields: [agentAccess.userId],
    references: [users.id],
  }),
}));

export const filesRelations = relations(files, ({ one, many }) => ({
  agent: one(agents, {
    fields: [files.agentId],
    references: [agents.id],
  }),
  documentChunks: many(documentChunks),
}));

export const documentChunksRelations = relations(documentChunks, ({ one }) => ({
  file: one(files, {
    fields: [documentChunks.fileId],
    references: [files.id],
  }),
  agent: one(agents, {
    fields: [documentChunks.agentId],
    references: [agents.id],
  }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type UpsertUser = typeof users.$inferInsert;

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = typeof agents.$inferInsert;

export type AgentAccess = typeof agentAccess.$inferSelect;
export type InsertAgentAccess = typeof agentAccess.$inferInsert;

export type File = typeof files.$inferSelect;
export type InsertFile = typeof files.$inferInsert;

export type DocumentChunk = typeof documentChunks.$inferSelect;
export type InsertDocumentChunk = typeof documentChunks.$inferInsert;

export type UsageRecord = typeof usageRecords.$inferSelect;
export type InsertUsageRecord = typeof usageRecords.$inferInsert;
