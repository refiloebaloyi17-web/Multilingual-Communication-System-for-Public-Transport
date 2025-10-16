import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert, Vibration, Platform } from 'react-native';
import { Card, Button, Text, TextInput, Appbar, Chip, ActivityIndicator } from 'react-native-paper';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

const TranslationScreen = ({ user, onLogout, onProfile, apiUrl = 'http://192.168.0.131:8000' }) => {
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('zu');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [languages, setLanguages] = useState([]);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasAudioPermission, setHasAudioPermission] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  const recordingRef = useRef(null);
  const recordingTimeoutRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const isRecordingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    loadLanguages();
    setupAudio();
    
    return () => {
      isMountedRef.current = false;
      // Cleanup on unmount
      cleanupRecording();
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      Speech.stop();
    };
  }, []);

  useEffect(() => {
    // Cleanup interval when recording stops
    if (isRecording) {
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    }
    
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [isRecording]);

  const cleanupRecording = async () => {
    try {
      if (recordingRef.current) {
        console.log('Cleaning up recording...');
        try {
          const status = await recordingRef.current.getStatusAsync();
          if (status.isRecording) {
            await recordingRef.current.stopAndUnloadAsync();
          }
        } catch (error) {
          console.log('Error during recording cleanup:', error);
        }
        recordingRef.current = null;
      }
      isRecordingRef.current = false;
      if (isMountedRef.current) {
        setIsRecording(false);
        setIsListening(false);
      }
    } catch (error) {
      console.log('Cleanup recording error:', error);
    }
  };

  const loadLanguages = async () => {
    try {
      console.log('Loading languages from:', `${apiUrl}/languages`);
      const response = await fetch(`${apiUrl}/languages`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Languages loaded:', data.languages);
      setLanguages(data.languages || []);
    } catch (error) {
      console.error('Error loading languages:', error);
      Alert.alert('Error', 'Failed to load languages. Using default languages.');
      // Set default languages as fallback
      setLanguages([
        { lang_id: 1, lang_code: 'zu', lang_name: 'isiZulu' },
        { lang_id: 2, lang_code: 'xh', lang_name: 'isiXhosa' },
        { lang_id: 3, lang_code: 'af', lang_name: 'Afrikaans' },
        { lang_id: 4, lang_code: 'st', lang_name: 'Sesotho' },
      ]);
    }
  };

  const setupAudio = async () => {
    try {
      console.log('Requesting audio permissions...');
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Microphone permission is required for voice translation');
        setHasAudioPermission(false);
        return;
      }
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      
      setHasAudioPermission(true);
      console.log('Audio permissions granted');
    } catch (error) {
      console.error('Audio setup error:', error);
      setHasAudioPermission(false);
      Alert.alert('Audio Error', 'Failed to setup audio recording');
    }
  };

  const startRecording = async () => {
    try {
      if (!hasAudioPermission) {
        Alert.alert('Permission Required', 'Microphone permission is required');
        return;
      }

      // Clean up any existing recording first
      await cleanupRecording();
      
      // Small delay to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 300));

      Vibration.vibrate(100);
      
      console.log('Starting fresh recording...');
      
      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const recording = new Audio.Recording();
      
      try {
        await recording.prepareToRecordAsync(
          Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
        );
        await recording.startAsync();
        
        recordingRef.current = recording;
        isRecordingRef.current = true;
        
        if (isMountedRef.current) {
          setIsRecording(true);
          setIsListening(true);
        }
        
        console.log('Recording started successfully');
        
        // Clear any existing timeout
        if (recordingTimeoutRef.current) {
          clearTimeout(recordingTimeoutRef.current);
        }
        
        // Auto-stop after 8 seconds to prevent infinite recording
        recordingTimeoutRef.current = setTimeout(() => {
          if (isRecordingRef.current) {
            console.log('Auto-stopping recording after 8 seconds');
            stopRecording();
          }
        }, 8000);
        
      } catch (prepareError) {
        console.error('Failed to prepare recording:', prepareError);
        recordingRef.current = null;
        isRecordingRef.current = false;
        if (isMountedRef.current) {
          setIsRecording(false);
          setIsListening(false);
        }
        Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
      }
      
    } catch (error) {
      console.error('Failed to start recording', error);
      if (isMountedRef.current) {
        setIsRecording(false);
        setIsListening(false);
      }
    }
  };

  const stopRecording = async () => {
    try {
      console.log('Attempting to stop recording...');
      Vibration.vibrate(100);
      
      // Clear the auto-stop timeout
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }
      
      if (!isRecordingRef.current || !recordingRef.current) {
        console.log('No active recording to stop');
        if (isMountedRef.current) {
          setIsRecording(false);
          setIsListening(false);
        }
        return;
      }
      
      let uri = null;
      
      try {
        // Check if recording exists and is recording
        const status = await recordingRef.current.getStatusAsync();
        console.log('Recording status:', status);
        
        if (status.canRecord && status.isRecording) {
          await recordingRef.current.stopAndUnloadAsync();
          uri = recordingRef.current.getURI();
          console.log('Recording stopped successfully, URI:', uri);
        } else {
          console.log('Recording was not active, status:', status);
        }
      } catch (stopError) {
        console.error('Error during recording stop:', stopError);
        // Continue with cleanup even if stop fails
      } finally {
        // Always clean up references
        recordingRef.current = null;
        isRecordingRef.current = false;
        
        if (isMountedRef.current) {
          setIsRecording(false);
          setIsListening(false);
        }
      }
      
      // Process the recorded audio if we have a URI
      if (uri) {
        console.log('Processing recorded audio:', uri);
        await processRecordedAudio(uri);
      } else {
        console.log('No recording URI available for processing');
      }
      
    } catch (error) {
      console.error('Unexpected error in stopRecording:', error);
      // Force cleanup on any error
      recordingRef.current = null;
      isRecordingRef.current = false;
      if (isMountedRef.current) {
        setIsRecording(false);
        setIsListening(false);
      }
    }
  };

  const processRecordedAudio = async (audioUri) => {
    if (!isMountedRef.current) return;
    
    setIsTranscribing(true);
    
    try {
      console.log('Processing recorded audio:', audioUri);
      
      // Use simulation for speech recognition (since we don't have backend speech-to-text)
      const simulatedText = await simulateSpeechRecognition();
      
      if (simulatedText && isMountedRef.current) {
        setInputText(simulatedText);
        
        // Show what was detected
        setTimeout(() => {
          if (isMountedRef.current) {
            Alert.alert('Voice Input', `Detected: "${simulatedText}"`, [
              { 
                text: 'Translate', 
                onPress: () => {
                  setTimeout(() => {
                    handleTranslate();
                  }, 500);
                }
              },
              { text: 'Cancel', style: 'cancel' }
            ]);
          }
        }, 100);
      } else if (isMountedRef.current) {
        Alert.alert('Speech Recognition', 'Could not understand speech. Please try again.');
      }
      
    } catch (error) {
      console.error('Speech recognition error:', error);
      if (isMountedRef.current) {
        Alert.alert('Speech Recognition Error', 'Failed to process audio. Please try again.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsTranscribing(false);
      }
    }
  };

  const simulateSpeechRecognition = async () => {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const commonPhrases = [
      "How much is the fare?",
      "Where are you going?",
      "Please stop here",
      "Thank you",
      "This is your stop",
      "Exact change please",
      "Buckle your seatbelt",
      "Next stop coming up",
      "Please move to the back",
      "Watch your step",
      "Good morning",
      "Good afternoon",
      "Have a nice day",
      "How long until we arrive?",
      "This bus goes to the city",
      "I need to get to the airport",
      "What time does the next bus come?",
      "Is this the right bus for downtown?",
      "How much luggage can I bring?",
      "Do you accept credit cards?"
    ];
    
    const randomPhrase = commonPhrases[Math.floor(Math.random() * commonPhrases.length)];
    console.log('Simulated speech recognition:', randomPhrase);
    
    return randomPhrase;
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) {
      Alert.alert('Error', 'Please enter text to translate');
      return;
    }

    if (!isMountedRef.current) return;

    setLoading(true);
    try {
      console.log('Translating text:', inputText);
      const response = await fetch(`${apiUrl}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: inputText,
          source_lang: 'en',
          target_lang: targetLanguage
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Translation failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Translation result:', data);
      
      if (isMountedRef.current) {
        setTranslatedText(data.translated_text);
        
        // Auto-speak the translation
        setTimeout(() => {
          speakTranslatedText();
        }, 500);
      }
      
    } catch (error) {
      console.error('Translation error:', error);
      if (isMountedRef.current) {
        Alert.alert('Translation Error', 'Failed to translate text. Please check your connection and try again.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const speakTranslatedText = () => {
    if (translatedText && isMountedRef.current) {
      try {
        const languageCode = 
          targetLanguage === 'zu' ? 'zu-ZA' : 
          targetLanguage === 'xh' ? 'xh-ZA' :
          targetLanguage === 'af' ? 'af-ZA' : 
          targetLanguage === 'st' ? 'st-ZA' : 'en-US';
        
        console.log('Speaking text with language:', languageCode);
        Speech.speak(translatedText, {
          language: languageCode,
          rate: 0.8,
          pitch: 1.0,
          volume: 1.0,
        });
      } catch (error) {
        console.error('Speech error:', error);
        if (isMountedRef.current) {
          Alert.alert('Speech Error', 'Failed to speak the translation');
        }
      }
    }
  };

  const stopSpeaking = () => {
    Speech.stop();
  };

  const handleQuickPhrase = (phrase) => {
    if (!isMountedRef.current) return;
    
    setInputText(phrase);
    // Auto-translate quick phrases
    setTimeout(() => {
      handleTranslate();
    }, 100);
  };

  const handleVoiceTranslate = async () => {
    if (isRecordingRef.current) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const quickPhrases = [
    "How much is the fare?",
    "Where are you going?",
    "Please stop here",
    "Thank you",
    "This is your stop",
    "Exact change please",
    "Buckle your seatbelt",
    "Next stop coming up",
    "Please move to the back",
    "Watch your step",
    "Good morning",
    "Good afternoon",
    "Have a nice day",
    "How long until we arrive?",
    "This bus goes to the city"
  ];

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getLanguageName = (code) => {
    const lang = languages.find(l => l.lang_code === code);
    return lang ? lang.lang_name : code;
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title="Taxi Translator" subtitle="Voice Translation" />
        <Appbar.Action icon="account" onPress={onProfile} />
        <Appbar.Action icon="logout" onPress={onLogout} />
      </Appbar.Header>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* User Info */}
        {user && (
          <Card style={styles.userCard}>
            <Card.Content>
              <Text variant="titleSmall">Welcome, {user.full_name}</Text>
              <Text variant="bodySmall" style={styles.userRole}>
                {user.role} • Language: {user.language_pref || 'Not set'}
              </Text>
            </Card.Content>
          </Card>
        )}

        {/* Language Selection */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Translate to:
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.languageScroll}>
              <View style={styles.languageContainer}>
                {languages.filter(lang => lang.lang_code !== 'en').map((language) => (
                  <Chip
                    key={language.lang_id}
                    selected={targetLanguage === language.lang_code}
                    onPress={() => setTargetLanguage(language.lang_code)}
                    style={[
                      styles.languageChip,
                      targetLanguage === language.lang_code && styles.selectedLanguageChip
                    ]}
                    mode="outlined"
                    showSelectedOverlay
                  >
                    {language.lang_name}
                  </Chip>
                ))}
              </View>
            </ScrollView>
            <Text style={styles.selectedLanguageText}>
              Selected: {getLanguageName(targetLanguage)}
            </Text>
          </Card.Content>
        </Card>

        {/* Voice Translation Section */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              🎤 Voice Translation:
            </Text>
            
            <View style={styles.voiceSection}>
              {!hasAudioPermission && (
                <Text style={styles.permissionWarning}>
                  Microphone permission required for voice translation
                </Text>
              )}
              
              <Button
                mode={isRecording ? "contained" : "outlined"}
                onPress={handleVoiceTranslate}
                icon={isRecording ? "stop" : "microphone"}
                style={styles.voiceButton}
                disabled={loading || !hasAudioPermission || isTranscribing}
                buttonColor={isRecording ? '#ff4444' : '#2196F3'}
                textColor="white"
              >
                {isRecording ? `Stop (${formatTime(recordingDuration)})` : 
                 isTranscribing ? 'Processing...' : 'Start Voice Translation'}
              </Button>
              
              {(isListening || isTranscribing) && (
                <View style={styles.listeningIndicator}>
                  <ActivityIndicator animating={true} color="#2196F3" />
                  <Text style={styles.listeningText}>
                    {isTranscribing ? 'Processing your speech...' : 'Listening... Speak now'}
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.instructionText}>
              Tap the microphone, speak your phrase clearly, and we'll translate it automatically
            </Text>

            <TextInput
              label="Or type your message here..."
              value={inputText}
              onChangeText={setInputText}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.input}
              placeholder="How much is the fare? Where are you going?"
              editable={!loading && !isTranscribing}
            />
            
            <Button
              mode="contained"
              onPress={handleTranslate}
              loading={loading}
              disabled={loading || !inputText.trim() || isTranscribing}
              style={styles.translateButton}
              icon="translate"
            >
              {loading ? 'Translating...' : 'Translate Text'}
            </Button>
          </Card.Content>
        </Card>

        {/* Translation Result */}
        {translatedText ? (
          <Card style={[styles.card, styles.resultCard]}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                🔊 Translation ({getLanguageName(targetLanguage)}):
              </Text>
              <Text style={styles.translatedText}>{translatedText}</Text>
              
              <View style={styles.speakButtons}>
                <Button
                  mode="contained"
                  onPress={speakTranslatedText}
                  icon="volume-high"
                  style={styles.speakButton}
                  disabled={!translatedText}
                >
                  Speak Again
                </Button>
                
                <Button
                  mode="outlined"
                  onPress={stopSpeaking}
                  icon="stop"
                  style={styles.speakButton}
                >
                  Stop
                </Button>
              </View>
            </Card.Content>
          </Card>
        ) : null}

        {/* Quick Phrases */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              💬 Quick Phrases:
            </Text>
            <Text style={styles.phraseSubtitle}>Tap to auto-translate</Text>
            <View style={styles.phraseContainer}>
              {quickPhrases.map((phrase, index) => (
                <Button
                  key={index}
                  mode="outlined"
                  onPress={() => handleQuickPhrase(phrase)}
                  style={styles.phraseButton}
                  compact
                  disabled={loading || isTranscribing}
                >
                  {phrase}
                </Button>
              ))}
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 10,
  },
  userCard: {
    marginBottom: 10,
    backgroundColor: '#e3f2fd',
  },
  userRole: {
    color: '#666',
    marginTop: 4,
  },
  card: {
    marginBottom: 10,
  },
  resultCard: {
    backgroundColor: '#e8f5e8',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  sectionTitle: {
    marginBottom: 8,
    color: '#333',
    fontWeight: '600',
  },
  selectedLanguageText: {
    marginTop: 8,
    color: '#666',
    fontStyle: 'italic',
  },
  input: {
    marginBottom: 15,
    marginTop: 10,
  },
  voiceSection: {
    marginBottom: 15,
  },
  permissionWarning: {
    color: '#ff6b35',
    marginBottom: 10,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  instructionText: {
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
    fontStyle: 'italic',
    fontSize: 12,
  },
  voiceButton: {
    marginBottom: 10,
  },
  listeningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  listeningText: {
    marginLeft: 10,
    color: '#1976d2',
    fontWeight: '500',
  },
  translateButton: {
    marginTop: 5,
  },
  translatedText: {
    fontSize: 18,
    lineHeight: 24,
    marginVertical: 10,
    color: '#2e7d32',
    textAlign: 'center',
    fontWeight: '500',
  },
  speakButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  speakButton: {
    flex: 1,
  },
  languageScroll: {
    marginHorizontal: -16,
  },
  languageContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  languageChip: {
    marginRight: 8,
  },
  selectedLanguageChip: {
    backgroundColor: '#2196F3',
  },
  phraseContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  phraseSubtitle: {
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  phraseButton: {
    marginBottom: 8,
  },
});

export default TranslationScreen;