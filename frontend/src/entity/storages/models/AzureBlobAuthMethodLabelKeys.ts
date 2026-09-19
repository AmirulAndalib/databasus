import type { TranslationKey } from '../../../shared/i18n';
import type { AzureBlobAuthMethod } from './AzureBlobStorage';

export const AZURE_BLOB_AUTH_METHOD_LABEL_KEYS: Record<AzureBlobAuthMethod, TranslationKey> = {
  ACCOUNT_KEY: 'storages.azureBlobAuthMethods.accountKey',
  CONNECTION_STRING: 'storages.azureBlobAuthMethods.connectionString',
};
