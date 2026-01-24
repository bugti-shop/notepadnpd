import { z } from 'zod';
import i18n from '@/i18n';

export const getUserFriendlyError = (error: any): string => {
  const t = i18n.t.bind(i18n);
  const message = error?.message || error?.toString() || t('authErrors.unknownError');
  
  // Common Supabase auth errors
  if (message.includes('Invalid login credentials')) {
    return t('authErrors.invalidCredentials');
  }
  if (message.includes('Email not confirmed')) {
    return t('authErrors.emailNotConfirmed');
  }
  if (message.includes('User already registered')) {
    return t('authErrors.userAlreadyRegistered');
  }
  if (message.includes('Password should be')) {
    return t('authErrors.passwordRequirements');
  }
  if (message.includes('rate limit')) {
    return t('authErrors.rateLimit');
  }
  if (message.includes('network')) {
    return t('authErrors.networkError');
  }
  
  return message;
};

export const getValidationError = (error: z.ZodError): string => {
  const t = i18n.t.bind(i18n);
  const firstError = error.errors[0];
  return firstError?.message || t('authErrors.validationError');
};
