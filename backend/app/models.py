from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UserCreate(BaseModel):
    full_name: str
    email: str
    password: str
    role: str = "driver"

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    user_id: int
    full_name: str
    email: str
    role: str
    language_pref: str

class TranslationRequest(BaseModel):
    text: str
    source_lang: str
    target_lang: str

class TranslationResponse(BaseModel):
    original_text: str
    translated_text: str
    source_lang: str
    target_lang: str

# Add these Pydantic models to models.py or in main.py
class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    language_pref: Optional[str] = None

class TranslationHistory(BaseModel):
    message_id: int
    original_text: str
    translated_text: str
    target_language: str
    timestamp: datetime