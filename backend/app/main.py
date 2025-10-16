from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import logging
import requests
import hashlib
from datetime import datetime
from typing import List, Optional
from app.models import UserCreate, UserLogin, UserResponse, TranslationRequest, TranslationResponse
from app.models import UserUpdate, TranslationHistory
from app.google_translate import translate_with_google
import speech_recognition as sr
import tempfile
import os
from fastapi import UploadFile, File
import io

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Multilingual Transport Communication System",
    description="Real-time translation system for South African taxi drivers and passengers",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database initialization
def init_db():
    with sqlite3.connect('taxi_translator.db') as conn:
        # Users table
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('driver', 'passenger')),
                language_pref TEXT DEFAULT 'en',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Languages table
        conn.execute('''
            CREATE TABLE IF NOT EXISTS languages (
                lang_id INTEGER PRIMARY KEY AUTOINCREMENT,
                lang_code TEXT UNIQUE NOT NULL,
                lang_name TEXT NOT NULL
            )
        ''')
        
        # Messages/translations table
        conn.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                message_id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER,
                receiver_id INTEGER,
                original_text TEXT NOT NULL,
                translated_text TEXT NOT NULL,
                source_lang VARCHAR(10) DEFAULT 'en',
                target_lang VARCHAR(10) NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sender_id) REFERENCES users (user_id),
                FOREIGN KEY (receiver_id) REFERENCES users (user_id)
            )
        ''')
        
        # Insert default languages if not exists
        languages = [
            ('en', 'English'),
            ('zu', 'isiZulu'),
            ('xh', 'isiXhosa'),
            ('af', 'Afrikaans'),
            ('st', 'Sesotho'),
            ('tn', 'Setswana'),
            ('ts', 'Xitsonga'),
            ('ss', 'siSwati'),
            ('ve', 'Tshivenda'),
            ('nr', 'isiNdebele')
        ]
        
        for lang_code, lang_name in languages:
            try:
                conn.execute(
                    "INSERT OR IGNORE INTO languages (lang_code, lang_name) VALUES (?, ?)",
                    (lang_code, lang_name)
                )
            except Exception as e:
                logger.warning(f"Could not insert language {lang_code}: {e}")
        
        conn.commit()
    logger.info("Database initialized successfully")

def get_db():
    conn = sqlite3.connect('taxi_translator.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.on_event("startup")
def startup_event():
    init_db()

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

@app.get("/")
def read_root():
    return {
        "message": "Multilingual Transport Communication System API", 
        "status": "running",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }

# Add this endpoint to main.py
@app.post("/speech-to-text")
async def speech_to_text(file: UploadFile = File(...)):
    """
    Convert speech audio to text using Google Speech Recognition
    """
    try:
        # Check if the file is an audio file
        if not file.content_type.startswith('wav/'):
            raise HTTPException(status_code=400, detail="File must be an audio file")
        
        # Read the audio file
        contents = await file.read()
        
        # Create a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio:
            temp_audio.write(contents)
            temp_audio_path = temp_audio.name
        
        try:
            # Initialize recognizer
            recognizer = sr.Recognizer()
            
            # Load audio file
            with sr.AudioFile(temp_audio_path) as source:
                audio_data = recognizer.record(source)
                
            # Recognize speech using Google Speech Recognition
            text = recognizer.recognize_google(audio_data)
            
            logger.info(f"Speech recognition successful: {text}")
            return {"text": text, "confidence": "high"}
            
        except sr.UnknownValueError:
            logger.warning("Google Speech Recognition could not understand audio")
            return {"text": "", "confidence": "low", "error": "Could not understand audio"}
        except sr.RequestError as e:
            logger.error(f"Could not request results from Google Speech Recognition service: {e}")
            return {"text": "", "confidence": "low", "error": "Speech recognition service error"}
            
    except Exception as e:
        logger.error(f"Speech to text error: {e}")
        raise HTTPException(status_code=500, detail=f"Speech recognition failed: {str(e)}")
    finally:
        # Clean up temporary file
        if 'temp_audio_path' in locals() and os.path.exists(temp_audio_path):
            os.unlink(temp_audio_path)

@app.post("/register", response_model=dict)
def register(user_data: UserCreate):
    with get_db() as conn:
        try:
            if user_data.role not in ['driver', 'passenger']:
                raise HTTPException(status_code=400, detail="Role must be 'driver' or 'passenger'")
            
            hashed_password = hash_password(user_data.password)
            cursor = conn.execute(
                "INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)",
                (user_data.full_name, user_data.email, hashed_password, user_data.role)
            )
            conn.commit()
            
            new_user = conn.execute(
                "SELECT user_id, full_name, email, role, language_pref FROM users WHERE user_id = ?",
                (cursor.lastrowid,)
            ).fetchone()
            
            logger.info(f"New user registered: {user_data.email} as {user_data.role}")
            
            return {
                "message": "User registered successfully", 
                "user": dict(new_user)
            }
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=400, detail="Email already exists")
        except Exception as e:
            logger.error(f"Registration error: {e}")
            raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@app.post("/login", response_model=dict)
def login(credentials: UserLogin):
    with get_db() as conn:
        try:
            hashed_password = hash_password(credentials.password)
            user = conn.execute(
                "SELECT user_id, full_name, email, role, language_pref FROM users WHERE email = ? AND password = ?",
                (credentials.email, hashed_password)
            ).fetchone()
            
            if not user:
                logger.warning(f"Failed login attempt for email: {credentials.email}")
                raise HTTPException(status_code=401, detail="Invalid credentials")
            
            logger.info(f"User logged in: {credentials.email}")
            
            return {
                "message": "Login successful",
                "user": dict(user)
            }
        except Exception as e:
            logger.error(f"Login error: {e}")
            raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")

@app.get("/languages")
def get_languages():
    with get_db() as conn:
        try:
            languages = conn.execute("SELECT * FROM languages ORDER BY lang_name").fetchall()
            return {
                "languages": [dict(lang) for lang in languages],
                "count": len(languages)
            }
        except Exception as e:
            logger.error(f"Error fetching languages: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch languages: {str(e)}")

@app.post("/translate", response_model=TranslationResponse)
def translate(request: TranslationRequest):
    try:
        if not request.text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        logger.info(f"Translation request: '{request.text}' from {request.source_lang} to {request.target_lang}")
        
        # Use the improved translation service
        translated_text = translate_with_google(
            request.text, 
            request.source_lang, 
            request.target_lang
        )
        
        # Store the translation in database
        with get_db() as conn:
            try:
                conn.execute(
                    "INSERT INTO messages (sender_id, receiver_id, original_text, translated_text, source_lang, target_lang) VALUES (?, ?, ?, ?, ?, ?)",
                    (1, 2, request.text, translated_text, request.source_lang, request.target_lang)
                )
                conn.commit()
            except Exception as db_error:
                logger.warning(f"Could not save translation to database: {db_error}")
                # Continue even if database save fails
        
        logger.info(f"Translation successful: '{request.text}' -> '{translated_text}'")
        
        return TranslationResponse(
            original_text=request.text,
            translated_text=translated_text,
            source_lang=request.source_lang,
            target_lang=request.target_lang
        )
    except Exception as e:
        logger.error(f"Translation endpoint error: {e}")
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")

@app.get("/health")
def health_check():
    with get_db() as conn:
        try:
            # Test database connection
            conn.execute("SELECT 1")
            db_status = "healthy"
        except Exception as e:
            db_status = f"unhealthy: {e}"
    
    return {
        "status": "healthy", 
        "timestamp": datetime.now().isoformat(),
        "database": db_status,
        "version": "1.0.0"
    }

@app.get("/test-translation")
def test_translation():
    """Test endpoint to verify translation is working"""
    test_cases = [
        ("Hello, how much is the fare?", "en", "zu"),
        ("Thank you", "en", "xh"),
        ("Where are you going?", "en", "af"),
        ("Please stop here", "en", "st"),
        ("Good morning", "en", "tn")
    ]
    
    results = []
    for text, src, tgt in test_cases:
        try:
            result = translate_with_google(text, src, tgt)
            success = "[Translation Unavailable]" not in result and "[Fallback]" not in result
            results.append({
                "original": text,
                "translated": result,
                "source": src,
                "target": tgt,
                "success": success,
                "service": "Google Translate" if success else "Fallback"
            })
        except Exception as e:
            results.append({
                "original": text,
                "translated": f"Error: {str(e)}",
                "source": src,
                "target": tgt,
                "success": False,
                "service": "Error"
            })
    
    return {
        "results": results,
        "summary": {
            "total": len(results),
            "successful": sum(1 for r in results if r["success"]),
            "failed": sum(1 for r in results if not r["success"]),
            "success_rate": f"{(sum(1 for r in results if r['success']) / len(results)) * 100:.1f}%"
        }
    }

# User profile endpoints
@app.get("/users/{user_id}/profile")
def get_user_profile(user_id: int):
    with get_db() as conn:
        try:
            user = conn.execute(
                """SELECT user_id, full_name, email, role, language_pref, created_at 
                   FROM users WHERE user_id = ?""",
                (user_id,)
            ).fetchone()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Get user's translation statistics
            stats = conn.execute(
                """SELECT 
                       COUNT(*) as total_translations,
                       COUNT(DISTINCT target_lang) as languages_used,
                       MAX(timestamp) as last_translation
                   FROM messages 
                   WHERE sender_id = ?""",
                (user_id,)
            ).fetchone()
            
            return {
                "user": dict(user),
                "stats": dict(stats) if stats else {
                    "total_translations": 0,
                    "languages_used": 0,
                    "last_translation": None
                }
            }
        except Exception as e:
            logger.error(f"Error fetching user profile: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch profile: {str(e)}")

@app.put("/users/{user_id}/profile")
def update_user_profile(user_id: int, user_data: UserUpdate):
    with get_db() as conn:
        try:
            # Verify user exists
            existing_user = conn.execute(
                "SELECT user_id FROM users WHERE user_id = ?", 
                (user_id,)
            ).fetchone()
            if not existing_user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Build dynamic update query based on provided fields
            update_fields = []
            update_values = []
            
            if user_data.full_name is not None:
                update_fields.append("full_name = ?")
                update_values.append(user_data.full_name)
            
            if user_data.email is not None:
                update_fields.append("email = ?")
                update_values.append(user_data.email)
            
            if user_data.language_pref is not None:
                update_fields.append("language_pref = ?")
                update_values.append(user_data.language_pref)
            
            if not update_fields:
                raise HTTPException(status_code=400, detail="No fields to update")
            
            update_values.append(user_id)
            
            query = f"UPDATE users SET {', '.join(update_fields)} WHERE user_id = ?"
            conn.execute(query, update_values)
            conn.commit()
            
            # Get updated user
            updated_user = conn.execute(
                "SELECT user_id, full_name, email, role, language_pref FROM users WHERE user_id = ?",
                (user_id,)
            ).fetchone()
            
            logger.info(f"User profile updated: user_id {user_id}")
            
            return {
                "message": "Profile updated successfully",
                "user": dict(updated_user)
            }
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=400, detail="Email already exists")
        except Exception as e:
            logger.error(f"Error updating user profile: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to update profile: {str(e)}")

@app.get("/users/{user_id}/translation-history")
def get_translation_history(user_id: int, limit: int = 20, offset: int = 0):
    with get_db() as conn:
        try:
            # Verify user exists
            user = conn.execute(
                "SELECT user_id FROM users WHERE user_id = ?", 
                (user_id,)
            ).fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            history = conn.execute(
                """SELECT 
                       message_id,
                       original_text,
                       translated_text,
                       target_lang,
                       timestamp
                   FROM messages 
                   WHERE sender_id = ? 
                   ORDER BY timestamp DESC 
                   LIMIT ? OFFSET ?""",
                (user_id, limit, offset)
            ).fetchall()
            
            total_count = conn.execute(
                "SELECT COUNT(*) as count FROM messages WHERE sender_id = ?",
                (user_id,)
            ).fetchone()["count"]
            
            return {
                "history": [dict(item) for item in history],
                "pagination": {
                    "total": total_count,
                    "limit": limit,
                    "offset": offset,
                    "has_more": (offset + len(history)) < total_count
                }
            }
        except Exception as e:
            logger.error(f"Error fetching translation history: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch translation history: {str(e)}")

@app.put("/users/{user_id}/language")
def update_user_language(user_id: int, language_pref: str):
    with get_db() as conn:
        try:
            # Verify user exists
            user = conn.execute(
                "SELECT user_id FROM users WHERE user_id = ?", 
                (user_id,)
            ).fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Verify language exists
            language = conn.execute(
                "SELECT * FROM languages WHERE lang_code = ? OR lang_name = ?",
                (language_pref, language_pref)
            ).fetchone()
            
            if not language:
                raise HTTPException(status_code=400, detail="Invalid language")
            
            conn.execute(
                "UPDATE users SET language_pref = ? WHERE user_id = ?",
                (language_pref, user_id)
            )
            conn.commit()
            
            logger.info(f"User language preference updated: user_id {user_id} -> {language_pref}")
            
            return {"message": "Language preference updated successfully"}
        except Exception as e:
            logger.error(f"Error updating user language: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to update language: {str(e)}")

# System statistics endpoint
@app.get("/admin/stats")
def get_system_stats():
    with get_db() as conn:
        try:
            user_stats = conn.execute(
                """SELECT 
                       role,
                       COUNT(*) as count 
                   FROM users 
                   GROUP BY role"""
            ).fetchall()
            
            translation_stats = conn.execute(
                """SELECT 
                       target_lang,
                       COUNT(*) as translation_count
                   FROM messages 
                   GROUP BY target_lang 
                   ORDER BY translation_count DESC"""
            ).fetchall()
            
            total_stats = conn.execute(
                """SELECT 
                       COUNT(*) as total_users,
                       (SELECT COUNT(*) FROM messages) as total_translations,
                       (SELECT COUNT(DISTINCT target_lang) FROM messages) as languages_used
                """
            ).fetchone()
            
            return {
                "user_stats": {stat["role"]: stat["count"] for stat in user_stats},
                "translation_stats": {stat["target_lang"]: stat["translation_count"] for stat in translation_stats},
                "total_stats": dict(total_stats) if total_stats else {}
            }
        except Exception as e:
            logger.error(f"Error fetching system stats: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch system statistics: {str(e)}")

# Search translations endpoint
@app.get("/search/translations")
def search_translations(query: str, limit: int = 10):
    with get_db() as conn:
        try:
            results = conn.execute(
                """SELECT 
                       original_text,
                       translated_text,
                       target_lang,
                       timestamp
                   FROM messages 
                   WHERE original_text LIKE ? OR translated_text LIKE ?
                   ORDER BY timestamp DESC 
                   LIMIT ?""",
                (f'%{query}%', f'%{query}%', limit)
            ).fetchall()
            
            return {
                "query": query,
                "results": [dict(item) for item in results],
                "count": len(results)
            }
        except Exception as e:
            logger.error(f"Error searching translations: {e}")
            raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")