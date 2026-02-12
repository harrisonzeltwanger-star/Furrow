import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Keys
const TOKEN_KEY = 'hay_portal_token';
const REFRESH_TOKEN_KEY = 'hay_portal_refresh_token';
const USER_KEY = 'hay_portal_user';
const SAVED_SIG_KEY = 'furrow_saved_signature';

// Secure token storage (encrypted)
export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

// User data storage (AsyncStorage - not encrypted but fine for user profile)
export async function getStoredUser<T>(): Promise<T | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setStoredUser<T>(user: T): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function clearUser(): Promise<void> {
  await AsyncStorage.removeItem(USER_KEY);
}

export async function clearAll(): Promise<void> {
  await clearTokens();
  await clearUser();
}

// Signature storage
export interface SavedSignature {
  name: string;
  imageData: string;
}

export async function getSavedSignature(): Promise<SavedSignature | null> {
  const raw = await AsyncStorage.getItem(SAVED_SIG_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.name && parsed.imageData) return parsed;
    return null;
  } catch {
    return null;
  }
}

export async function saveSignature(name: string, imageData: string): Promise<void> {
  await AsyncStorage.setItem(SAVED_SIG_KEY, JSON.stringify({ name, imageData }));
}
