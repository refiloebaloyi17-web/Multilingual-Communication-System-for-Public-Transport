# Multilingual-Communication-System-for-Public-Transport
The Multilingual Communication System is a mobile and web-based solution designed to bridge the language gap between drivers and passengers in South African public transport.
It allows drivers to speak in their preferred language, and the system automatically performs speech-to-text conversion, translation, and speech output in the selected target language — ensuring clear and efficient communication across language barriers.

Features

Speech-to-Text (STT) — Converts spoken audio (e.g., from the driver) into text using Google Speech Recognition.
Real-Time Translation — Translates recognized text into the selected target language via Google Translate.
Speech Output — Converts translated text back to speech using the Expo Speech API for playback.
User Authentication — Drivers can register, log in, and securely access the system.
Language Selection — Supports multiple South African languages (English, isiZulu, isiXhosa, Afrikaans, Sesotho, etc.).
Cross-Platform App — Built with React Native (Expo) for mobile and FastAPI for the backend.

System Architecture

Frontend (Mobile App):
Developed with React Native (Expo)
Handles UI, recording, playback, and user interaction
Communicates with the backend via REST API calls

Backend (Server):
Built with FastAPI

Provides routes for:
/auth/register and /auth/login
/speech-to-text for audio processing
/translate/text for text translation
Uses googletrans, pydub, and speech_recognition libraries

Database:
SQLite (via SQLModel)
Stores user profiles and authentication tokens

Workflow
Driver registers and logs in through the mobile app.
Driver selects the preferred target language.

When the driver speaks, the system:
Records the audio (.m4a)
Sends it to the backend (/speech-to-text)
Converts to .wav and performs speech recognition
Translates recognized text into the chosen language
Sends translated text and plays back as audio
