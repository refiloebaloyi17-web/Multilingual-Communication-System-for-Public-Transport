import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, ScrollView } from 'react-native';
import { Provider as PaperProvider, Text, Button, TextInput, Card } from 'react-native-paper';
import TranslationScreen from './componenets/TranslationScreen';
import ProfileScreen from './componenets/profileScreen';

// ✅ USE YOUR ACTUAL IP ADDRESS
const API_BASE_URL = 'http://192.168.0.131:8000';

const App = () => { 

// Update the state to include profile screen
  const [currentScreen, setCurrentScreen] = useState('login');
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState('checking');

  useEffect(() => {
    checkAPI();
  }, []);

  const makeRequest = async (url, method = 'GET', data = null) => {
    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      };

      if (data) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Request failed:', error);
      throw error;
    }
  };

  const checkAPI = async () => {
    try {
      setApiStatus('checking');
      const data = await makeRequest(`${API_BASE_URL}/`);
      console.log('✅ API connected:', data);
      setApiStatus('connected');
    } catch (error) {
      console.log('❌ API connection failed:', error.message);
      setApiStatus('failed');
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setLoading(true);
    try {
      const data = await makeRequest(`${API_BASE_URL}/login`, 'POST', {
        email: email,
        password: password
      });
      
      setUser(data.user);
      setCurrentScreen('translation');
    } catch (error) {
      Alert.alert('Login Failed', error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      const data = await makeRequest(`${API_BASE_URL}/register`, 'POST', {
        full_name: fullName,
        email: email,
        password: password,
        role: 'driver'
      });
      
      Alert.alert('Success', 'Registration successful! Please login.');
      setCurrentScreen('login');
      setFullName('');
    } catch (error) {
      Alert.alert('Registration Failed', error.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setEmail('');
    setPassword('');
    setFullName('');
    setCurrentScreen('login');
  };

  const renderStatusIndicator = () => {
    if (currentScreen === 'translation') return null;
    
    let statusColor, statusText;
    
    switch (apiStatus) {
      case 'connected':
        statusColor = '#4CAF50';
        statusText = '✅ Connected to Server';
        break;
      case 'failed':
        statusColor = '#F44336';
        statusText = '❌ Server Connection Failed';
        break;
      default:
        statusColor = '#FF9800';
        statusText = '🔄 Checking Connection...';
    }

    return (
      <View style={[styles.statusBar, { backgroundColor: statusColor }]}>
        <Text style={styles.statusText}>{statusText}</Text>
        <Button 
          mode="text" 
          onPress={checkAPI}
          textColor="white"
          compact
        >
          Retry
        </Button>
      </View>
    );
  };

  const renderLoginScreen = () => (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineMedium" style={styles.title}>
            🚕 Taxi Translator
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Multilingual Communication System
          </Text>

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry
            style={styles.input}
          />
          
          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading || apiStatus !== 'connected'}
            style={styles.button}
          >
            Login
          </Button>
          
          <Button
            mode="outlined"
            onPress={() => setCurrentScreen('register')}
            style={styles.button}
          >
            Create New Account
          </Button>
        </Card.Content>
      </Card>
    </View>
  );

  const renderRegisterScreen = () => (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineMedium" style={styles.title}>
            Create Driver Account
          </Text>
          
          <TextInput
            label="Full Name"
            value={fullName}
            onChangeText={setFullName}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry
            style={styles.input}
          />
          
          <Button
            mode="contained"
            onPress={handleRegister}
            loading={loading}
            disabled={loading}
            style={styles.button}
          >
            Register as Driver
          </Button>
          
          <Button
            mode="text"
            onPress={() => setCurrentScreen('login')}
            style={styles.button}
          >
            Back to Login
          </Button>
        </Card.Content>
      </Card>
    </View>
  );



// Add this function to handle user updates
const handleUpdateUser = (updatedUser) => {
  setUser(updatedUser);
};

// Update the getCurrentScreen function
const getCurrentScreen = () => {
  switch (currentScreen) {
    case 'login':
      return renderLoginScreen();
    case 'register':
      return renderRegisterScreen();
    case 'translation':
      return (
        <TranslationScreen 
          user={user}
          onLogout={handleLogout}
          onProfile={() => setCurrentScreen('profile')}
          apiUrl={API_BASE_URL}
        />
      );
    case 'profile':
      return (
        <ProfileScreen 
          user={user}
          onBack={() => setCurrentScreen('translation')}
          apiUrl={API_BASE_URL}
          onUpdateUser={handleUpdateUser}
        />
      );
    default:
      return renderLoginScreen();
  }
};

  return (
    <PaperProvider>
      <View style={styles.appContainer}>
        {renderStatusIndicator()}
        {getCurrentScreen()}
      </View>
    </PaperProvider>
  );
};

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statusText: {
    color: 'white',
    fontWeight: 'bold',
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    padding: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 16,
    color: '#666',
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
  },
});

export default App;