import sqlite3
from contextlib import contextmanager

DATABASE_URL = "transport_translation.db"

@contextmanager
def get_db():
    conn = sqlite3.connect(DATABASE_URL)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    with get_db() as conn:
        # Users table - using TEXT instead of ENUM for SQLite compatibility
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role TEXT CHECK(role IN ('driver', 'passenger')) DEFAULT 'driver',
                language_pref VARCHAR(50) DEFAULT 'English',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Messages table
        conn.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                message_id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER NOT NULL,
                receiver_id INTEGER NOT NULL,
                original_text TEXT NOT NULL,
                translated_text TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sender_id) REFERENCES users (user_id),
                FOREIGN KEY (receiver_id) REFERENCES users (user_id)
            )
        ''')
        
        # Languages table with South African languages
        conn.execute('''
            CREATE TABLE IF NOT EXISTS languages (
                lang_id INTEGER PRIMARY KEY AUTOINCREMENT,
                lang_name VARCHAR(50) NOT NULL,
                lang_code VARCHAR(10) NOT NULL
            )
        ''')
        
        # Insert South African languages
        sa_languages = [
            ('English', 'en'),
            ('Zulu', 'zu'),
            ('Xhosa', 'xh'),
            ('Afrikaans', 'af'),
            ('Sotho', 'st'),
            ('Tswana', 'tn'),
            ('Tsonga', 'ts'),
            ('Swati', 'ss'),
            ('Venda', 've'),
            ('Ndebele', 'nr')
        ]
        
        conn.executemany(
            'INSERT OR IGNORE INTO languages (lang_name, lang_code) VALUES (?, ?)',
            sa_languages
        )
        
        # Admin table
        conn.execute('''
            CREATE TABLE IF NOT EXISTS administrator (
                admin_id INTEGER PRIMARY KEY AUTOINCREMENT,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                permissions_level TEXT CHECK(permissions_level IN ('basic', 'admin', 'superadmin')) DEFAULT 'basic',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        conn.commit()
        print("Database initialized successfully!")