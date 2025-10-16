import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, RefreshControl } from 'react-native';
import { Card, Button, Text, TextInput, Appbar, Chip, List, Avatar, Divider, ActivityIndicator } from 'react-native-paper';

const ProfileScreen = ({ user, onBack, apiUrl, onUpdateUser }) => {
  const [profile, setProfile] = useState(null);
  const [translationHistory, setTranslationHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    language_pref: ''
  });

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      const [profileResponse, historyResponse] = await Promise.all([
        fetch(`${apiUrl}/users/${user.user_id}/profile`),
        fetch(`${apiUrl}/users/${user.user_id}/translation-history?limit=10`)
      ]);

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        setProfile(profileData);
        setFormData({
          full_name: profileData.user.full_name,
          email: profileData.user.email,
          language_pref: profileData.user.language_pref
        });
      }

      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setTranslationHistory(historyData.history);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadProfileData();
  };

  const handleUpdateProfile = async () => {
    if (!formData.full_name.trim()) {
      Alert.alert('Error', 'Full name is required');
      return;
    }

    setUpdating(true);
    try {
      const response = await fetch(`${apiUrl}/users/${user.user_id}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(prev => ({ ...prev, user: data.user }));
        onUpdateUser(data.user);
        setEditMode(false);
        Alert.alert('Success', 'Profile updated successfully');
      } else {
        throw new Error('Update failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setUpdating(false);
    }
  };

  const handleLanguageChange = async (languageCode) => {
    try {
      const response = await fetch(`${apiUrl}/users/${user.user_id}/language`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ language_pref: languageCode }),
      });

      if (response.ok) {
        setFormData(prev => ({ ...prev, language_pref: languageCode }));
        Alert.alert('Success', 'Language preference updated');
        loadProfileData(); // Reload to get updated stats
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update language preference');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={onBack} />
          <Appbar.Content title="Profile" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={onBack} />
        <Appbar.Content title="My Profile" />
        {!editMode && (
          <Appbar.Action 
            icon="pencil" 
            onPress={() => setEditMode(true)} 
          />
        )}
      </Appbar.Header>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Profile Header */}
        <Card style={styles.card}>
          <Card.Content style={styles.profileHeader}>
            <Avatar.Text 
              size={80} 
              label={getInitials(profile?.user.full_name || 'U')}
              style={styles.avatar}
            />
            <View style={styles.profileInfo}>
              {editMode ? (
                <TextInput
                  label="Full Name"
                  value={formData.full_name}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, full_name: text }))}
                  mode="outlined"
                  style={styles.editInput}
                />
              ) : (
                <Text variant="headlineSmall" style={styles.userName}>
                  {profile?.user.full_name}
                </Text>
              )}
              <Text variant="bodyMedium" style={styles.userRole}>
                {profile?.user.role === 'driver' ? '🚗 Taxi Driver' : '👤 Passenger'}
              </Text>
              <Text variant="bodySmall" style={styles.userEmail}>
                {profile?.user.email}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Statistics */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              📊 Translation Statistics
            </Text>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={styles.statNumber}>
                  {profile?.stats.total_translations || 0}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Total Translations
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={styles.statNumber}>
                  {profile?.stats.languages_used || 0}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Languages Used
                </Text>
              </View>
            </View>
            {profile?.stats.last_translation && (
              <Text variant="bodySmall" style={styles.lastTranslation}>
                Last translation: {formatDate(profile.stats.last_translation)}
              </Text>
            )}
          </Card.Content>
        </Card>

        {/* Language Preference */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              🌍 Preferred Language
            </Text>
            <Text variant="bodyMedium" style={styles.currentLanguage}>
              Current: {profile?.user.language_pref || 'English'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.languageScroll}>
              <View style={styles.languageContainer}>
                {['en', 'zu', 'xh', 'af', 'st'].map((langCode) => (
                  <Chip
                    key={langCode}
                    selected={formData.language_pref === langCode}
                    onPress={() => handleLanguageChange(langCode)}
                    style={styles.languageChip}
                    mode="outlined"
                  >
                    {langCode === 'en' ? 'English' : 
                     langCode === 'zu' ? 'Zulu' :
                     langCode === 'xh' ? 'Xhosa' :
                     langCode === 'af' ? 'Afrikaans' : 'Sotho'}
                  </Chip>
                ))}
              </View>
            </ScrollView>
          </Card.Content>
        </Card>

        {/* Edit Profile Section */}
        {editMode && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                ✏️ Edit Profile
              </Text>
              
              <TextInput
                label="Email"
                value={formData.email}
                onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
                mode="outlined"
                style={styles.editInput}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <View style={styles.editButtons}>
                <Button
                  mode="outlined"
                  onPress={() => {
                    setEditMode(false);
                    setFormData({
                      full_name: profile.user.full_name,
                      email: profile.user.email,
                      language_pref: profile.user.language_pref
                    });
                  }}
                  style={styles.editButton}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleUpdateProfile}
                  loading={updating}
                  disabled={updating}
                  style={styles.editButton}
                >
                  Save Changes
                </Button>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Recent Translation History */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              📝 Recent Translations
            </Text>
            {translationHistory.length === 0 ? (
              <Text style={styles.noHistoryText}>
                No translation history yet. Start translating to see your history here!
              </Text>
            ) : (
              <List.Section>
                {translationHistory.map((item, index) => (
                  <View key={item.message_id}>
                    <List.Item
                      title={item.translated_text}
                      description={item.original_text}
                      left={props => <List.Icon {...props} icon="translate" />}
                      right={props => (
                        <Text {...props} style={styles.historyTime}>
                          {formatDate(item.timestamp)}
                        </Text>
                      )}
                    />
                    {index < translationHistory.length - 1 && <Divider />}
                  </View>
                ))}
              </List.Section>
            )}
          </Card.Content>
        </Card>

        {/* Account Info */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              ℹ️ Account Information
            </Text>
            <View style={styles.accountInfo}>
              <Text style={styles.accountItem}>
                <Text style={styles.accountLabel}>User ID: </Text>
                {user.user_id}
              </Text>
              <Text style={styles.accountItem}>
                <Text style={styles.accountLabel}>Member since: </Text>
                {profile?.user.created_at ? formatDate(profile.user.created_at) : 'N/A'}
              </Text>
              <Text style={styles.accountItem}>
                <Text style={styles.accountLabel}>Role: </Text>
                {profile?.user.role}
              </Text>
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
    padding: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  card: {
    marginBottom: 10,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: '#2196F3',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontWeight: 'bold',
    color: '#333',
  },
  userRole: {
    color: '#666',
    marginTop: 4,
  },
  userEmail: {
    color: '#888',
    marginTop: 2,
  },
  sectionTitle: {
    marginBottom: 10,
    color: '#333',
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 10,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#666',
    marginTop: 4,
  },
  lastTranslation: {
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  currentLanguage: {
    color: '#666',
    marginBottom: 10,
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
  editInput: {
    marginBottom: 12,
  },
  editButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  editButton: {
    flex: 1,
  },
  noHistoryText: {
    textAlign: 'center',
    color: '#888',
    fontStyle: 'italic',
    marginVertical: 20,
  },
  historyTime: {
    fontSize: 12,
    color: '#888',
  },
  accountInfo: {
    marginTop: 5,
  },
  accountItem: {
    marginBottom: 6,
    color: '#666',
  },
  accountLabel: {
    fontWeight: '500',
    color: '#333',
  },
});

export default ProfileScreen;