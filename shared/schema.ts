import { sql } from "drizzle-orm";
import { pgTable, uuid, text, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  full_name: varchar("full_name", { length: 200 }).notNull(),
  avatar_url: text("avatar_url"),
  is_online: boolean("is_online").default(false),
  last_seen: timestamp("last_seen", { withTimezone: true }).default(sql`now()`),
  email_verified: boolean("email_verified").default(false),
  verification_token: text("verification_token"),
  verification_token_expires: timestamp("verification_token_expires", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
});

export const chat_rooms = pgTable("chat_rooms", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  is_private: boolean("is_private").default(false),
  created_by: uuid("created_by").references(() => users.id, { onDelete: "cascade" }),
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  room_id: uuid("room_id").references(() => chat_rooms.id, { onDelete: "cascade" }),
  user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  message_type: varchar("message_type", { length: 20 }).default("text"),
  reply_to: uuid("reply_to"),
  edited_at: timestamp("edited_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
});

export const room_members = pgTable("room_members", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  room_id: uuid("room_id").references(() => chat_rooms.id, { onDelete: "cascade" }),
  user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).default("member"),
  joined_at: timestamp("joined_at", { withTimezone: true }).default(sql`now()`),
});

export const friend_requests = pgTable("friend_requests", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sender_id: uuid("sender_id").references(() => users.id, { onDelete: "cascade" }),
  receiver_id: uuid("receiver_id").references(() => users.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 20 }).default("pending"),
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
});

export const friendships = pgTable("friendships", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  user1_id: uuid("user1_id").references(() => users.id, { onDelete: "cascade" }),
  user2_id: uuid("user2_id").references(() => users.id, { onDelete: "cascade" }),
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  username: true,
  full_name: true,
});

export const signupSchema = insertUserSchema.extend({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().min(1, "Please enter your email or username"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().default(true),
});

export const insertChatRoomSchema = createInsertSchema(chat_rooms).pick({
  name: true,
  description: true,
  is_private: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  room_id: true,
  content: true,
  message_type: true,
  reply_to: true,
});

export const insertFriendRequestSchema = createInsertSchema(friend_requests).pick({
  receiver_id: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type SignupData = z.infer<typeof signupSchema>;
export type LoginData = z.infer<typeof loginSchema>;

export type ChatRoom = typeof chat_rooms.$inferSelect;
export type InsertChatRoom = z.infer<typeof insertChatRoomSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type RoomMember = typeof room_members.$inferSelect;
export type FriendRequest = typeof friend_requests.$inferSelect;
export type Friendship = typeof friendships.$inferSelect;

// Self-reference is handled by adding the constraint separately if needed

// Extended types for joins
// Message status for WhatsApp-style indicators
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'error';

export interface MessageWithUser extends Message {
  user: Pick<User, 'id' | 'username' | 'full_name' | 'avatar_url'>;
  reply_to_message?: MessageWithUser;
  // Client-side status for optimistic UI
  status?: MessageStatus;
  // Temporary ID for optimistic messages
  tempId?: string;
}

export interface RoomWithDetails extends ChatRoom {
  created_by_user?: Pick<User, 'id' | 'username' | 'full_name'>;
  member_count?: number;
  unread_count?: number;
  last_message?: MessageWithUser;
  type?: 'direct' | 'group';
  members?: Array<{
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
  }>;
  user_role?: string;
}

export interface MentorshipConnection extends User {
  friendship_id?: string;
  friend_request_id?: string;
  request_status?: string;
  is_sender?: boolean;
}

// Backwards compatibility for any legacy imports
export type FriendWithStatus = MentorshipConnection;

export type MentorshipRequest = FriendRequest;
