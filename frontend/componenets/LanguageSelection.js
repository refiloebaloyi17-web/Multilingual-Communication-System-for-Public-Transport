import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Button, Text, RadioButton } from 'react-native-paper';
import { translationAPI } from '../services/api';

const LanguageSelection = ({ currentLanguage, onLanguageSelect, onContinue }) => {
  const [languages, setLanguages] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage);

  useEffect(() => {
    loadLanguages();
  }, []);

  const loadLanguages = async () => {
    try {
      const response = await translationAPI.getLanguages();
      setLanguages(response.data);
    } catch (error) {
      console.error('Error loading languages:', error);
    }
  };

  const handleLanguageSelect = (langCode) => {
    setSelectedLanguage(langCode);
    onLanguageSelect(langCode);
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.title}>
            Select Your Language
          </Text>
          <ScrollView style={styles.scrollView}>
            <RadioButton.Group
              onValueChange={handleLanguageSelect}
              value={selectedLanguage}
            >
              {languages.map((lang) => (
                <RadioButton.Item
                  key={lang.lang_id}
                  label={lang.lang_name}
                  value={lang.lang_code}
                  style={styles.radioItem}
                />
              ))}
            </RadioButton.Group>
          </ScrollView>
          <Button
            mode="contained"
            onPress={onContinue}
            style={styles.button}
            disabled={!selectedLanguage}
          >
            Continue to Translation
          </Button>
        </Card.Content>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  card: {
    flex: 1,
  },
  title: {
    textAlign: 'center',
    marginBottom: 20,
    color: '#2196F3',
  },
  scrollView: {
    flex: 1,
  },
  radioItem: {
    paddingVertical: 8,
  },
  button: {
    marginTop: 20,
  },
});

export default LanguageSelection;