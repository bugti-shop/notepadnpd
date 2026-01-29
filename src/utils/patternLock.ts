// Pattern Lock utilities for individual note protection
// Uses IndexedDB for secure storage with PBKDF2 hashing

import { getSetting, setSetting, removeSetting } from './settingsStorage';

// Storage keys
const getPatternKey = (noteId: string) => `npd_pattern_lock_${noteId}`;
const getPatternSaltKey = (noteId: string) => `npd_pattern_salt_${noteId}`;
const getPatternQuestionKey = (noteId: string) => `npd_pattern_question_${noteId}`;
const getPatternAnswerKey = (noteId: string) => `npd_pattern_answer_${noteId}`;
const getPatternAnswerSaltKey = (noteId: string) => `npd_pattern_answer_salt_${noteId}`;

// Generate a random salt
const generateSalt = (): string => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// Convert ArrayBuffer to hex string
const bufferToHex = (buffer: ArrayBuffer): string => {
  return Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
};

// Hash pattern using Web Crypto API with PBKDF2
const hashPatternAsync = async (pattern: string, salt: string): Promise<string> => {
  try {
    const encoder = new TextEncoder();
    const patternData = encoder.encode(pattern);
    const saltData = encoder.encode(salt);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      patternData,
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltData,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );

    return bufferToHex(derivedBits);
  } catch (error) {
    console.error('Error hashing pattern:', error);
    // Fallback hash for environments without Web Crypto API
    let hash = 0;
    const input = pattern + salt;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'fallback_' + Math.abs(hash).toString(36);
  }
};

// Hash pattern securely
export const hashPattern = async (pattern: number[]): Promise<{ hash: string; salt: string }> => {
  const patternString = pattern.join('-');
  const salt = generateSalt();
  const hash = await hashPatternAsync(patternString, salt);
  return { hash, salt };
};

// Verify pattern against stored hash
export const verifyPattern = async (pattern: number[], storedHash: string, salt: string): Promise<boolean> => {
  const patternString = pattern.join('-');
  const hash = await hashPatternAsync(patternString, salt);
  return hash === storedHash;
};

// Pattern Lock state for a note
export interface PatternLockState {
  hasPattern: boolean;
  hasSecurityQuestion: boolean;
}

// Get pattern lock state for a note
export const getPatternLockState = async (noteId: string): Promise<PatternLockState> => {
  const patternHash = await getSetting<string | null>(getPatternKey(noteId), null);
  const securityQuestion = await getSetting<string | null>(getPatternQuestionKey(noteId), null);
  
  return {
    hasPattern: !!patternHash,
    hasSecurityQuestion: !!securityQuestion,
  };
};

// Check if a note has pattern lock enabled
export const hasPatternLock = async (noteId: string): Promise<boolean> => {
  const patternHash = await getSetting<string | null>(getPatternKey(noteId), null);
  return !!patternHash;
};

// Set pattern lock for a note
export const setPatternLock = async (
  noteId: string,
  pattern: number[],
  securityQuestion: string,
  securityAnswer: string
): Promise<void> => {
  // Hash and store the pattern
  const { hash: patternHash, salt: patternSalt } = await hashPattern(pattern);
  await setSetting(getPatternKey(noteId), patternHash);
  await setSetting(getPatternSaltKey(noteId), patternSalt);
  
  // Hash and store the security answer
  const normalizedAnswer = securityAnswer.toLowerCase().trim();
  const { hash: answerHash, salt: answerSalt } = await hashPattern([...normalizedAnswer].map(c => c.charCodeAt(0)));
  await setSetting(getPatternQuestionKey(noteId), securityQuestion);
  await setSetting(getPatternAnswerKey(noteId), answerHash);
  await setSetting(getPatternAnswerSaltKey(noteId), answerSalt);
};

// Verify pattern for a note
export const verifyPatternLock = async (noteId: string, pattern: number[]): Promise<boolean> => {
  const storedHash = await getSetting<string | null>(getPatternKey(noteId), null);
  const storedSalt = await getSetting<string | null>(getPatternSaltKey(noteId), null);
  
  if (!storedHash || !storedSalt) return false;
  
  return verifyPattern(pattern, storedHash, storedSalt);
};

// Get security question for a note
export const getPatternSecurityQuestion = async (noteId: string): Promise<string | null> => {
  return getSetting<string | null>(getPatternQuestionKey(noteId), null);
};

// Verify security answer for pattern recovery
export const verifyPatternSecurityAnswer = async (noteId: string, answer: string): Promise<boolean> => {
  const storedHash = await getSetting<string | null>(getPatternAnswerKey(noteId), null);
  const storedSalt = await getSetting<string | null>(getPatternAnswerSaltKey(noteId), null);
  
  if (!storedHash || !storedSalt) return false;
  
  const normalizedAnswer = answer.toLowerCase().trim();
  const answerPattern = [...normalizedAnswer].map(c => c.charCodeAt(0));
  return verifyPattern(answerPattern, storedHash, storedSalt);
};

// Reset pattern lock (after security question verification)
export const resetPatternLock = async (
  noteId: string,
  newPattern: number[],
  securityQuestion: string,
  securityAnswer: string
): Promise<void> => {
  // Reuse setPatternLock for resetting
  await setPatternLock(noteId, newPattern, securityQuestion, securityAnswer);
};

// Remove pattern lock from a note
export const removePatternLock = async (noteId: string): Promise<void> => {
  await removeSetting(getPatternKey(noteId));
  await removeSetting(getPatternSaltKey(noteId));
  await removeSetting(getPatternQuestionKey(noteId));
  await removeSetting(getPatternAnswerKey(noteId));
  await removeSetting(getPatternAnswerSaltKey(noteId));
};

// Security questions for pattern recovery
export const PATTERN_SECURITY_QUESTIONS = [
  "What is your mother's maiden name?",
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your favorite movie?",
  "What was the name of your elementary school?",
  "What is your favorite food?",
  "What is the name of your best childhood friend?",
  "What was your childhood nickname?",
];
