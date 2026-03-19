import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface AuthScreenProps {
  onAuthenticated: () => void;
  navigation: any;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated, navigation }) => {
  const authenticateWithPIN = async () => {
    const storedPin = await SecureStore.getItemAsync('user_pin');
    if (!storedPin) {
      Alert.alert('No PIN Set', 'You have not set up a PIN yet. Please go to Settings → Change PIN to create one.');
      return;
    }
    navigation.navigate('PINEntry', {
      onSuccess: () => {
        saveAuthenticationState();
        onAuthenticated();
      }
    });
  };

  const createNewWallet = () => {
    navigation.navigate('WalletSetup');
  };

  const restoreWallet = () => {
    navigation.navigate('WalletRestore');
  };

  const saveAuthenticationState = async () => {
    try {
      await SecureStore.setItemAsync('last_auth', Date.now().toString());
    } catch (error) {
      console.error('Failed to save auth state:', error);
    }
  };

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Logo and Title */}
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <Image
              source={require('../../assets/icon.png')}
              style={{ width: 80, height: 80 }}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.title}>AURA<Text style={styles.titleAccent}>50</Text></Text>
          <Text style={styles.subtitle}>World's First Mobile-Native Blockchain</Text>
        </View>

        {/* Authentication Options */}
        <View style={styles.authContainer}>
          <Text style={styles.authTitle}>Secure Access</Text>

          {/* PIN Authentication */}
          <TouchableOpacity
            style={styles.authButton}
            onPress={authenticateWithPIN}
          >
            <View style={styles.authButtonContent}>
              <Ionicons name="keypad" size={24} color="#667eea" />
              <Text style={styles.authButtonText}>Enter PIN</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Wallet Management */}
        <View style={styles.walletContainer}>
          <Text style={styles.walletTitle}>Wallet Management</Text>

          <TouchableOpacity
            style={styles.walletButton}
            onPress={createNewWallet}
          >
            <View style={styles.walletButtonContent}>
              <Ionicons name="add-circle" size={20} color="#27AE60" />
              <Text style={styles.walletButtonText}>Create New Wallet</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.walletButton}
            onPress={restoreWallet}
          >
            <View style={styles.walletButtonContent}>
              <Ionicons name="download" size={20} color="#3498DB" />
              <Text style={styles.walletButtonText}>Restore from Backup</Text>
            </View>
          </TouchableOpacity>

        </View>

        {/* Security Features */}
        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Built Different</Text>

          <View style={styles.feature}>
            <Ionicons name="cloud-offline" size={16} color="#27AE60" />
            <Text style={styles.featureText}>Offline-capable wallet</Text>
          </View>

          <View style={styles.feature}>
            <Ionicons name="cellular" size={16} color="#27AE60" />
            <Text style={styles.featureText}>Runs on 2G networks</Text>
          </View>

        <View style={styles.feature}>
            <Ionicons name="finger-print" size={16} color="#27AE60" />
            <Text style={styles.featureText}>Only for Mobiles</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Powered by Super Compression
          </Text>
          <Text style={styles.footerSubtext}>
            Designed for the next billion mobile users
          </Text>
        </View>
      </ScrollView>

    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    marginBottom: 16,
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 8,
    marginBottom: 8,
    textShadowColor: 'rgba(255, 220, 100, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  titleAccent: {
    color: '#F1C40F',
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.75)',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  authContainer: {
    marginVertical: 32,
  },
  authTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 24,
  },
  authButton: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  authButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginLeft: 12,
  },
  walletContainer: {
    marginVertical: 16,
  },
  walletTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  walletButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  walletButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  walletButtonText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 8,
  },
  featuresContainer: {
    marginVertical: 16,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    justifyContent: 'center',
  },
  featureText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  footerSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 4,
  },
});
