import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  jsonb,
  json,
  varchar,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table - required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  password: varchar("password"), // Hashed password for local auth
  provider: varchar("provider").default("local"), // Auth provider: local, google, github, facebook
  providerId: varchar("provider_id"), // ID from the auth provider if OAuth
  tier: varchar("tier").default("free"), // User subscription tier: free, pro
  usedPages: integer("used_pages").default(0),
  totalPages: integer("total_pages").default(5), // Free tier: 5 pages per month
  maxShotsPerScene: integer("max_shots_per_scene").default(5), // Free tier: 5 shots per scene
  canGenerateStoryboards: boolean("can_generate_storyboards").default(false), // Storyboard access
  stripeCustomerId: varchar("stripe_customer_id"), // Stripe customer ID for subscriptions
  stripeSubscriptionId: varchar("stripe_subscription_id"), // Active subscription ID
  emailVerified: boolean("email_verified").default(false),
  verificationToken: varchar("verification_token"),
  resetToken: varchar("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  magicLinkToken: varchar("magic_link_token"),
  magicLinkExpiry: timestamp("magic_link_expiry"),
  // Account deletion tracking
  pendingDeletion: boolean("pending_deletion").default(false),
  deletionScheduledAt: timestamp("deletion_scheduled_at"),
  // User preferences
  preferences: json("preferences").default({
    notifications: {
      email: true,
      parsing: true,
      marketing: false
    },
    appearance: {
      theme: "system",
      language: "en",
      timezone: "utc"
    }
  }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Scripts table to store uploaded scripts (Firebase user IDs)
export const scripts = pgTable("scripts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(), // Firebase user ID (no foreign key constraint)
  title: text("title").notNull(),
  filePath: text("file_path"),
  content: text("content"),
  pageCount: integer("page_count").default(0),
  fileType: text("file_type"), // PDF, DOCX, TXT
  fileSize: integer("file_size"), // File size in bytes
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const scriptsRelations = relations(scripts, ({ one }) => ({
  parse: one(parseJobs, {
    fields: [scripts.id],
    references: [parseJobs.scriptId],
  }),
}));

export type InsertScript = typeof scripts.$inferInsert;
export type Script = typeof scripts.$inferSelect;

// Parse Jobs table to track parsing status (Firebase user IDs)
export const parseJobs = pgTable("parse_jobs", {
  id: serial("id").primaryKey(),
  scriptId: integer("script_id").notNull().references(() => scripts.id),
  userId: text("user_id").notNull(), // Firebase user ID (no foreign key constraint)
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  selectedColumns: jsonb("selected_columns").$type<string[]>().default([]),
  previewData: jsonb("preview_data").$type<any>(),
  fullParseData: jsonb("full_parse_data").$type<any>(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const parseJobsRelations = relations(parseJobs, ({ one }) => ({
  script: one(scripts, {
    fields: [parseJobs.scriptId],
    references: [scripts.id],
  }),
}));

export type InsertParseJob = typeof parseJobs.$inferInsert;
export type ParseJob = typeof parseJobs.$inferSelect;

// Shots table - matches your MongoDB schema structure
export const shots = pgTable("shots", {
  id: serial("id").primaryKey(),
  parseJobId: integer("parse_job_id").references(() => parseJobs.id, { onDelete: "cascade" }).notNull(),
  sceneIndex: integer("scene_index").notNull(),
  userId: varchar("user_id").notNull(), // Firebase user ID
  
  // Shot numbering
  shotNumberInScene: integer("shot_number_in_scene").notNull(),
  displayShotNumber: text("display_shot_number"), // "1A", "1B", etc.
  
  // Core shot details from gpt_logic
  shotDescription: text("shot_description"),
  shotType: text("shot_type"),
  lens: text("lens"),
  movement: text("movement"), // Movement/Equipment
  moodAndAmbience: text("mood_and_ambience"),
  lighting: text("lighting"),
  props: text("props"),
  notes: text("notes"),
  soundDesign: text("sound_design"),
  colourTemp: text("colour_temp"),
  
  // Scene context fields
  sceneHeading: text("scene_heading"),
  location: text("location"),
  timeOfDay: text("time_of_day"),
  tone: text("tone"),
  
  // Additional content fields for column selection
  characters: text("characters"),
  action: text("action"),
  dialogue: text("dialogue"),
  
  // Image generation fields for storyboard module
  imagePromptText: text("image_prompt_text"),
  imageData: text("image_data"), // Base64 encoded image data
  imageGeneratedAt: timestamp("image_generated_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const shotsRelations = relations(shots, ({ one }) => ({
  parseJob: one(parseJobs, {
    fields: [shots.parseJobId],
    references: [parseJobs.id],
  }),
}));

export type InsertShot = typeof shots.$inferInsert;
export type Shot = typeof shots.$inferSelect;

// Script Health Analysis table
export const scriptHealthAnalysis = pgTable("script_health_analysis", {
  id: serial("id").primaryKey(),
  scriptId: integer("script_id").references(() => scripts.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  // Health Score Metrics
  overallScore: integer("overall_score").notNull(),
  structureScore: integer("structure_score").notNull(),
  pacingScore: integer("pacing_score").notNull(),
  characterScore: integer("character_score").notNull(),
  dialogueScore: integer("dialogue_score").notNull(),
  visualScore: integer("visual_score").notNull(),
  marketabilityScore: integer("marketability_score").notNull(),
  
  // Analysis Results
  strengths: jsonb("strengths").$type<string[]>().notNull(),
  improvements: jsonb("improvements").$type<any[]>().notNull(),
  genre: text("genre").notNull(),
  mood: text("mood").notNull(),
  targetAudience: text("target_audience").notNull(),
  marketingTags: jsonb("marketing_tags").$type<string[]>().notNull(),
  oneLinePitch: text("one_line_pitch").notNull(),
  estimatedBudget: text("estimated_budget").notNull(),
  productionComplexity: text("production_complexity").notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const scriptHealthRelations = relations(scriptHealthAnalysis, ({ one }) => ({
  script: one(scripts, {
    fields: [scriptHealthAnalysis.scriptId],
    references: [scripts.id],
  }),
}));

export type InsertScriptHealth = typeof scriptHealthAnalysis.$inferInsert;
export type ScriptHealth = typeof scriptHealthAnalysis.$inferSelect;

// Contact submissions table
export const contactSubmissions = pgTable("contact_submissions", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  email: varchar("email").notNull(),
  subject: varchar("subject").notNull(),
  message: text("message").notNull(),
  status: varchar("status").default("pending"), // pending, responded, resolved
  createdAt: timestamp("created_at").defaultNow().notNull(),
  respondedAt: timestamp("responded_at"),
});

export type InsertContactSubmission = typeof contactSubmissions.$inferInsert;
export type ContactSubmission = typeof contactSubmissions.$inferSelect;



// Create insert schemas
export const insertScriptSchema = createInsertSchema(scripts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertParseJobSchema = createInsertSchema(parseJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

// Column type enum for column selection
export const columnTypes = [
  "sceneNumber",
  "sceneHeading", 
  "shotNumber",
  "shotDescription",
  "shotType",
  "location",
  "timeOfDay",
  "lens",
  "movement",
  "moodAndAmbience",
  "lighting",
  "props",
  "notes",
  "soundDesign",
  "colourTemp",
  "characters",
  "tone",
  "action",
  "dialogue",
] as const;

export const columnTypeSchema = z.enum(columnTypes);
export type ColumnType = z.infer<typeof columnTypeSchema>;
