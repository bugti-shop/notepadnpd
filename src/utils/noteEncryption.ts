// Simple XOR-based encryption for note content
// This provides obfuscation for hidden notes

import { getSetting, setSetting, removeSetting } from '@/utils/settingsStorage';

const ENCRYPTION_KEY_PREFIX = 'npd_enc_';

// Generate a random encryption key
const generateKey = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
};

// In-memory cache for encryption keys
const keyCache: Map<string, string> = new Map();

// Get or create encryption key for a note
export const getEncryptionKey = async (noteId: string): Promise<string> => {
  // Check cache first
  if (keyCache.has(noteId)) {
    return keyCache.get(noteId)!;
  }

  const storedKey = await getSetting<string | null>(`${ENCRYPTION_KEY_PREFIX}${noteId}`, null);
  if (storedKey) {
    keyCache.set(noteId, storedKey);
    return storedKey;
  }
  
  const newKey = generateKey();
  await setSetting(`${ENCRYPTION_KEY_PREFIX}${noteId}`, newKey);
  keyCache.set(noteId, newKey);
  return newKey;
};

// Synchronous version using cache (for hot paths)
export const getEncryptionKeySync = (noteId: string): string | null => {
  return keyCache.get(noteId) || null;
};

// XOR encrypt/decrypt (same operation for both)
const xorCrypt = (text: string, key: string): string => {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
};

// Encrypt note content
export const encryptContent = async (content: string, noteId: string): Promise<string> => {
  const key = await getEncryptionKey(noteId);
  const encrypted = xorCrypt(content, key);
  // Base64 encode for safe storage
  return btoa(unescape(encodeURIComponent(encrypted)));
};

// Decrypt note content
export const decryptContent = async (encryptedContent: string, noteId: string): Promise<string> => {
  try {
    const key = await getEncryptionKey(noteId);
    const decoded = decodeURIComponent(escape(atob(encryptedContent)));
    return xorCrypt(decoded, key);
  } catch {
    // If decryption fails, return original (might be unencrypted)
    return encryptedContent;
  }
};

// Check if content appears to be encrypted (base64)
export const isEncrypted = (content: string): boolean => {
  try {
    atob(content);
    return content.length > 0 && /^[A-Za-z0-9+/=]+$/.test(content);
  } catch {
    return false;
  }
};

// Remove encryption key when note is unhidden
export const removeEncryptionKey = async (noteId: string): Promise<void> => {
  keyCache.delete(noteId);
  await removeSetting(`${ENCRYPTION_KEY_PREFIX}${noteId}`);
};
