import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';
import { sql } from 'drizzle-orm';

const dbDir = path.resolve(process.cwd(), 'data');
const dbPath = path.resolve(dbDir, 'sqlite.db');

// Ensure data directory exists
const fs = require('fs');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const globalForDb = global as unknown as {
  sqlite: Database.Database | undefined;
};

const sqlite = globalForDb.sqlite ?? new Database(dbPath);
if (process.env.NODE_ENV !== 'production') globalForDb.sqlite = sqlite;

sqlite.pragma('journal_mode = WAL');

export const db = drizzle(sqlite, { schema });

// Helper to ensure tables exist
export function initDb() {
    try {
        sqlite.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                image TEXT,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS rooms (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL DEFAULT 'New Room',
                owner_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                video_id TEXT NOT NULL DEFAULT '',
                playlist_id TEXT NOT NULL DEFAULT '',
                video_time REAL NOT NULL DEFAULT 0,
                is_playing INTEGER NOT NULL DEFAULT 0,
                video_title TEXT,
                upload_date TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
        `);
        
        // Migrations
        try { sqlite.exec("ALTER TABLE rooms ADD COLUMN name TEXT NOT NULL DEFAULT 'New Room'"); } catch(e){}
        try { sqlite.exec("ALTER TABLE rooms ADD COLUMN owner_id TEXT REFERENCES users(id) ON DELETE CASCADE"); } catch(e) {}
        
        sqlite.exec(`
            CREATE TABLE IF NOT EXISTS room_members (
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
                joined_at INTEGER NOT NULL,
                PRIMARY KEY (user_id, room_id)
            );
            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
                video_id TEXT NOT NULL,
                title TEXT NOT NULL,
                timestamp INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
                video_id TEXT NOT NULL,
                title TEXT NOT NULL,
                thumbnail TEXT,
                upload_date TEXT,
                added_by TEXT NOT NULL,
                position INTEGER NOT NULL
            );
        `);
    } catch (err) {
        console.error("Failed to initialize database tables:", err);
    }
}

// Auto-initialize on import
initDb();
