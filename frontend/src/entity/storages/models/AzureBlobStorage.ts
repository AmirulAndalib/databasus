export type AzureBlobAuthMethod = 'CONNECTION_STRING' | 'ACCOUNT_KEY';

export interface AzureBlobStorage {
  authMethod: AzureBlobAuthMethod;
  connectionString: string;
  accountName: string;
  accountKey: string;
  containerName: string;
  endpoint?: string;
  prefix?: string;
}
