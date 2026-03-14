const Database = require('better-sqlite3');
const db = new Database('sqlite.db');

db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL DEFAULT '',
      playlist_id TEXT NOT NULL DEFAULT '',
      video_time REAL NOT NULL DEFAULT 0,
      is_playing INTEGER NOT NULL DEFAULT 0,
      video_title TEXT,
      upload_date TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
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

console.log('Database initialized successfully.');
