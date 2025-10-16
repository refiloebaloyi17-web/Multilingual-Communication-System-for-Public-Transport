import requests
import logging
from typing import Optional

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def translate_with_google(text: str, source_lang: str, target_lang: str) -> str:
    """
    Translate text using Google Translate API via googletrans
    """
    try:
        # Try using the newer version of googletrans
        from googletrans import Translator
        translator = Translator()
        translation = translator.translate(text, src=source_lang, dest=target_lang)
        
        if translation and hasattr(translation, 'text') and translation.text:
            logger.info(f"Google Translate successful: {text} -> {translation.text}")
            return translation.text
        else:
            logger.warning("Google Translate returned no translation")
            raise Exception("No translation received")
            
    except Exception as e:
        logger.error(f"Google Translate error: {e}")
        # Fall back to LibreTranslate
        return translate_with_libretranslate(text, source_lang, target_lang)

def translate_with_libretranslate(text: str, source_lang: str, target_lang: str) -> str:
    """
    Translate text using LibreTranslate API as primary fallback
    """
    try:
        # Multiple LibreTranslate public instances
        instances = [
            "https://libretranslate.de/translate",
            "https://translate.argosopentech.com/translate",
            "https://libretranslate.p.rapidapi.com/translate"
        ]
        
        payload = {
            "q": text,
            "source": source_lang,
            "target": target_lang,
            "format": "text"
        }
        
        headers = {
            "Content-Type": "application/json"
        }
        
        for url in instances:
            try:
                logger.info(f"Trying LibreTranslate instance: {url}")
                response = requests.post(url, json=payload, headers=headers, timeout=10)
                
                if response.status_code == 200:
                    result = response.json()
                    translated_text = result.get("translatedText", "")
                    if translated_text:
                        logger.info(f"LibreTranslate successful: {text} -> {translated_text}")
                        return translated_text
                else:
                    logger.warning(f"LibreTranslate instance {url} returned status {response.status_code}")
            except Exception as e:
                logger.warning(f"LibreTranslate instance {url} failed: {e}")
                continue
                
        # If all LibreTranslate instances fail, use fallback
        logger.warning("All LibreTranslate instances failed, using phrase fallback")
        return fallback_translation(text, source_lang, target_lang)
            
    except Exception as e:
        logger.error(f"All translation services failed: {e}")
        return fallback_translation(text, source_lang, target_lang)

def fallback_translation(text: str, source_lang: str, target_lang: str) -> str:
    """
    Enhanced fallback translation with better phrase matching
    """
    text_lower = text.lower().strip()
    
    # Enhanced common taxi phrases with actual translations
    translations = {
        "en": {
            "zu": {
                "hello": "Sawubona",
                "how much is the fare": "Imalini imali yokuhamba?",
                "thank you": "Ngiyabonga",
                "where are you going": "Uya kuphi?",
                "please stop here": "Ngicela uma lapha",
                "this is your stop": "Lena indawo yakho yokuma",
                "exact change please": "Ngicela ushintshe olungokoqobo",
                "buckle your seatbelt": "Bopha ibhande lakho lomhlalo",
                "next stop coming up": "Isiteshi esilandelayo sizofika",
                "how long until we arrive": "Sizofika nini?",
                "please move to the back": "Ngicela uhambele emuva",
                "watch your step": "Qaphela ukunyathela kwakho",
                "good morning": "Sawubona ekuseni",
                "good afternoon": "Sawubona emini",
                "have a nice day": "Ube nosuku oluhle",
                "welcome": "Siyakwamukela",
                "please sit down": "Ngicela uhlale phansi",
                "the bus is full": "Ibasi igcwele",
                "we will arrive soon": "Sizofika maduze",
                "please be patient": "Ngicela ube nokubekezela",
                "how much": "Malini",
                "fare": "Imali yokuhamba",
                "stop": "Uma",
                "here": "Lapha",
                "where": "Kuphi",
                "going": "Ukuya",
                "thank": "Bonga",
                "please": "Ngiyacela",
                "bus": "Ibasi",
                "taxi": "Tekisi",
                "money": "Imali",
                "change": "Ushintshi",
                "seatbelt": "Ibhande lomhlalo",
                "next": "Olandelayo",
                "arrive": "Fika",
                "soon": "Maduze",
                "move": "Hamba",
                "back": "Emuva",
                "watch": "Qaphela",
                "step": "Inyathelo",
                "good": "Kuhle",
                "morning": "Ekuseni",
                "afternoon": "Emini",
                "day": "Usuku",
                "nice": "Kuhle",
                "welcome": "Wamukelekile",
                "sit": "Hlala",
                "down": "Phansi",
                "full": "Gcwele",
                "patient": "Bekezela"
            },
            "xh": {
                "hello": "Molo",
                "how much is the fare": "Yimalini ifare?",
                "thank you": "Enkosi",
                "where are you going": "Uya phi?",
                "please stop here": "Ndicela umise apha",
                "this is your stop": "Le yistop sakho",
                "exact change please": "Nceda utshintshe ngokuchanekileyo",
                "buckle your seatbelt": "Bopha ibhande lakho lesitulo",
                "next stop coming up": "Istophu elandelayo iza",
                "how long until we arrive": "Siza kufika nini?",
                "please move to the back": "Nceda uhambise ngasemva",
                "watch your step": "Gcina inyathelo lakho",
                "good morning": "Molo ekuseni",
                "good afternoon": "Molo emva kwemini",
                "have a nice day": "Ube nosuku olumnandi",
                "welcome": "Wamkelekile",
                "please sit down": "Nceda uhlale phantsi",
                "the bus is full": "Ibhasi izalisekile",
                "we will arrive soon": "Siza kufika kungekudala",
                "please be patient": "Nceda ube nombeko"
            },
            "af": {
                "hello": "Hallo",
                "how much is the fare": "Hoeveel is die tarief?",
                "thank you": "Dankie",
                "where are you going": "Waar gaan jy heen?",
                "please stop here": "Stop hier asseblief",
                "this is your stop": "Dit is jou stop",
                "exact change please": "Presiese kleingeld asseblief",
                "buckle your seatbelt": "Maat jou sitplekgordel vas",
                "next stop coming up": "Volgende stop kom nou",
                "how long until we arrive": "Hoe lank tot ons aankom?",
                "please move to the back": "Skuif asseblief agtertoe",
                "watch your step": "Pas op waar jy trap",
                "good morning": "Goeie môre",
                "good afternoon": "Goeie middag",
                "have a nice day": "Geniet die dag",
                "welcome": "Welkom",
                "please sit down": "Gaan sit asseblief",
                "the bus is full": "Die bus is vol",
                "we will arrive soon": "Ons sal binnekort aankom",
                "please be patient": "Wees asseblief geduldig"
            }
        }
    }
    
    # Check for exact phrase matches first
    if (source_lang in translations and 
        target_lang in translations[source_lang]):
        
        # Check exact phrase
        if text_lower in translations[source_lang][target_lang]:
            return translations[source_lang][target_lang][text_lower]
        
        # Check for partial matches
        for phrase, translation in translations[source_lang][target_lang].items():
            if phrase in text_lower:
                return translation
    
    # Simple word-by-word translation for unmatched text
    words = text_lower.split()
    translated_words = []
    
    for word in words:
        # Remove punctuation for better matching
        clean_word = ''.join(char for char in word if char.isalnum())
        if (source_lang in translations and 
            target_lang in translations[source_lang] and
            clean_word in translations[source_lang][target_lang]):
            translated_words.append(translations[source_lang][target_lang][clean_word])
        else:
            translated_words.append(word)
    
    result = ' '.join(translated_words)
    
    # If we couldn't translate anything meaningful, return the original with a note
    if result.lower() == text_lower:
        return f"[Translation Unavailable] {text}"
    
    return result