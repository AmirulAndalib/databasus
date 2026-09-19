import { useTranslation } from 'react-i18next';

import { AZURE_BLOB_AUTH_METHOD_LABEL_KEYS, type Storage } from '../../../../../entity/storages';

interface Props {
  storage: Storage;
}

export function ShowAzureBlobStorageComponent({ storage }: Props) {
  const { t } = useTranslation();

  return (
    <>
      <div className="mb-1 flex items-center">
        <div className="min-w-[110px] pr-2">{t('storages.fields.authMethod')}</div>
        {t(
          AZURE_BLOB_AUTH_METHOD_LABEL_KEYS[storage?.azureBlobStorage?.authMethod ?? 'ACCOUNT_KEY'],
        )}
      </div>

      {storage?.azureBlobStorage?.authMethod === 'CONNECTION_STRING' && (
        <div className="mb-1 flex items-center">
          <div className="min-w-[110px] pr-2">{t('storages.fields.connectionString')}</div>
          {'*************'}
        </div>
      )}

      {storage?.azureBlobStorage?.authMethod === 'ACCOUNT_KEY' && (
        <>
          <div className="mb-1 flex items-center">
            <div className="min-w-[110px] pr-2">{t('storages.fields.accountName')}</div>
            {storage?.azureBlobStorage?.accountName || '-'}
          </div>

          <div className="mb-1 flex items-center">
            <div className="min-w-[110px] pr-2">{t('storages.fields.accountKey')}</div>
            {'*************'}
          </div>

          <div className="mb-1 flex items-center">
            <div className="min-w-[110px] pr-2">{t('storages.fields.endpoint')}</div>
            {storage?.azureBlobStorage?.endpoint || '-'}
          </div>
        </>
      )}

      <div className="mb-1 flex items-center">
        <div className="min-w-[110px] pr-2">{t('storages.fields.containerName')}</div>
        {storage?.azureBlobStorage?.containerName || '-'}
      </div>

      {storage?.azureBlobStorage?.prefix && (
        <div className="mb-1 flex items-center">
          <div className="min-w-[110px] pr-2">{t('storages.fields.prefix')}</div>
          {storage.azureBlobStorage.prefix}
        </div>
      )}
    </>
  );
}
