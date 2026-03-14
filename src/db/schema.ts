import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(), // Hashed
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(), // The roomId
  name: text('name').notNull().default('New Room'),
  ownerId: text('owner_id').references(() => users.id, { onDelete: 'cascade' }),
  videoId: text('video_id').notNull().default(''),
  playlistId: text('playlist_id').notNull().default(''),
  videoTime: real('video_time').notNull().default(0),
  isPlaying: integer('is_playing', { mode: 'boolean' }).notNull().default(false),
  videoTitle: text('video_title'),
  uploadDate: text('upload_date'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// For tracking rooms a user joined or is a member of
export const roomMembers = sqliteTable('room_members', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roomId: text('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull().default(new Date()),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.roomId] }),
}));

export const history = sqliteTable('history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roomId: text('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  videoId: text('video_id').notNull(),
  title: text('title').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull().default(new Date()),
});

export const queue = sqliteTable('queue', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roomId: text('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  videoId: text('video_id').notNull(),
  title: text('title').notNull(),
  thumbnail: text('thumbnail'),
  uploadDate: text('upload_date'),
  addedBy: text('added_by').notNull(),
  position: integer('position').notNull(),
});
