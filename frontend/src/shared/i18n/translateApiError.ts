import type { TFunction } from 'i18next';

import { API_ERROR_CODES, ApiError } from '../api';
import { StringUtils } from '../lib/StringUtils';
import type { TranslationKey } from './TranslationKey';

// Error codes with a translated message. Backend codes are added here as the backend starts
// sending them; until then the backend's own message is shown.
const API_ERROR_CODE_KEYS: Record<string, TranslationKey> = {
  [API_ERROR_CODES.networkUnreachable]: 'errors.networkUnreachable',
  [API_ERROR_CODES.requestFailed]: 'errors.requestFailed',
};

// The one way an error reaches the screen. The message of anything that is not an ApiError comes
// from the browser or a library, never from the backend, so it is not shown.
export const translateApiError = (error: unknown, t: TFunction): string => {
  if (!(error instanceof ApiError)) {
    return t('errors.unknown');
  }

  const codeKey = error.code ? API_ERROR_CODE_KEYS[error.code] : undefined;
  if (codeKey) {
    return t(codeKey, { status: error.status ?? '' });
  }

  // Backend messages start in lower case ("user is already a member")
  return error.message ? StringUtils.capitalizeFirstLetter(error.message) : t('errors.unknown');
};
