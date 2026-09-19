import { DownOutlined, InfoCircleOutlined, UpOutlined } from '@ant-design/icons';
import { Input, Radio, Tooltip } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AZURE_BLOB_AUTH_METHOD_LABEL_KEYS, type Storage } from '../../../../../entity/storages';

interface Props {
  storage: Storage;
  setStorage: (storage: Storage) => void;
  setUnsaved: () => void;
}

export function EditAzureBlobStorageComponent({ storage, setStorage, setUnsaved }: Props) {
  const { t } = useTranslation();
  const hasAdvancedValues =
    !!storage?.azureBlobStorage?.prefix || !!storage?.azureBlobStorage?.endpoint;
  const [showAdvanced, setShowAdvanced] = useState(hasAdvancedValues);

  return (
    <>
      <div className="mb-1 flex w-full flex-col items-start sm:flex-row sm:items-center">
        <div className="mb-1 min-w-[110px] sm:mb-0 sm:pr-2">{t('storages.fields.authMethod')}</div>
        <Radio.Group
          value={storage?.azureBlobStorage?.authMethod || 'ACCOUNT_KEY'}
          onChange={(e) => {
            if (!storage?.azureBlobStorage) return;

            setStorage({
              ...storage,
              azureBlobStorage: {
                ...storage.azureBlobStorage,
                authMethod: e.target.value,
              },
            });
            setUnsaved();
          }}
          size="small"
        >
          <Radio value="ACCOUNT_KEY">{t(AZURE_BLOB_AUTH_METHOD_LABEL_KEYS.ACCOUNT_KEY)}</Radio>
          <Radio value="CONNECTION_STRING">
            {t(AZURE_BLOB_AUTH_METHOD_LABEL_KEYS.CONNECTION_STRING)}
          </Radio>
        </Radio.Group>
      </div>

      {storage?.azureBlobStorage?.authMethod === 'CONNECTION_STRING' && (
        <div className="mb-1 flex w-full flex-col items-start sm:flex-row sm:items-center">
          <div className="mb-1 min-w-[110px] sm:mb-0 sm:pr-2">
            {t('storages.fields.connection')}
          </div>
          <div className="flex items-center">
            <Input.Password
              value={storage?.azureBlobStorage?.connectionString || ''}
              onChange={(e) => {
                if (!storage?.azureBlobStorage) return;

                setStorage({
                  ...storage,
                  azureBlobStorage: {
                    ...storage.azureBlobStorage,
                    connectionString: e.target.value.trim(),
                  },
                });
                setUnsaved();
              }}
              size="small"
              className="w-full max-w-[250px]"
              // eslint-disable-next-line i18next/no-literal-string -- connection string format example
              placeholder="DefaultEndpointsProtocol=https;AccountName=..."
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
            />

            <Tooltip
              className="cursor-pointer"
              title={t('storages.edit.azureBlob.connectionStringTooltip')}
            >
              <InfoCircleOutlined className="ml-2" style={{ color: 'gray' }} />
            </Tooltip>
          </div>
        </div>
      )}

      {storage?.azureBlobStorage?.authMethod === 'ACCOUNT_KEY' && (
        <>
          <div className="mb-1 flex w-full flex-col items-start sm:flex-row sm:items-center">
            <div className="mb-1 min-w-[110px] sm:mb-0 sm:pr-2">
              {t('storages.fields.accountName')}
            </div>
            <Input
              value={storage?.azureBlobStorage?.accountName || ''}
              onChange={(e) => {
                if (!storage?.azureBlobStorage) return;

                setStorage({
                  ...storage,
                  azureBlobStorage: {
                    ...storage.azureBlobStorage,
                    accountName: e.target.value.trim(),
                  },
                });
                setUnsaved();
              }}
              size="small"
              className="w-full max-w-[250px]"
              // eslint-disable-next-line i18next/no-literal-string -- example account name
              placeholder="mystorageaccount"
            />
          </div>

          <div className="mb-1 flex w-full flex-col items-start sm:flex-row sm:items-center">
            <div className="mb-1 min-w-[110px] sm:mb-0 sm:pr-2">
              {t('storages.fields.accountKey')}
            </div>
            <Input.Password
              value={storage?.azureBlobStorage?.accountKey || ''}
              onChange={(e) => {
                if (!storage?.azureBlobStorage) return;

                setStorage({
                  ...storage,
                  azureBlobStorage: {
                    ...storage.azureBlobStorage,
                    accountKey: e.target.value.trim(),
                  },
                });
                setUnsaved();
              }}
              size="small"
              className="w-full max-w-[250px]"
              // eslint-disable-next-line i18next/no-literal-string -- example key value
              placeholder="your-account-key"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
            />
          </div>
        </>
      )}

      <div className="mb-1 flex w-full flex-col items-start sm:flex-row sm:items-center">
        <div className="mb-1 min-w-[110px] sm:mb-0 sm:pr-2">
          {t('storages.fields.containerName')}
        </div>
        <Input
          value={storage?.azureBlobStorage?.containerName || ''}
          onChange={(e) => {
            if (!storage?.azureBlobStorage) return;

            setStorage({
              ...storage,
              azureBlobStorage: {
                ...storage.azureBlobStorage,
                containerName: e.target.value.trim(),
              },
            });
            setUnsaved();
          }}
          size="small"
          className="w-full max-w-[250px]"
          // eslint-disable-next-line i18next/no-literal-string -- example container name
          placeholder="my-container"
        />
      </div>

      <div className="mt-4 mb-3 flex items-center">
        <div
          className="flex cursor-pointer items-center text-sm text-blue-600 hover:text-blue-800"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <span className="mr-2">{t('storages.edit.advancedSettings')}</span>

          {showAdvanced ? (
            <UpOutlined style={{ fontSize: '12px' }} />
          ) : (
            <DownOutlined style={{ fontSize: '12px' }} />
          )}
        </div>
      </div>

      {showAdvanced && (
        <>
          {storage?.azureBlobStorage?.authMethod === 'ACCOUNT_KEY' && (
            <div className="mb-1 flex w-full flex-col items-start sm:flex-row sm:items-center">
              <div className="mb-1 min-w-[110px] sm:mb-0 sm:pr-2">
                {t('storages.fields.endpoint')}
              </div>
              <div className="flex items-center">
                <Input
                  value={storage?.azureBlobStorage?.endpoint || ''}
                  onChange={(e) => {
                    if (!storage?.azureBlobStorage) return;

                    setStorage({
                      ...storage,
                      azureBlobStorage: {
                        ...storage.azureBlobStorage,
                        endpoint: e.target.value.trim(),
                      },
                    });
                    setUnsaved();
                  }}
                  size="small"
                  className="w-full max-w-[250px]"
                  placeholder={t('storages.edit.optionalPlaceholder', {
                    example: 'https://myaccount.blob.core.windows.net',
                  })}
                />

                <Tooltip
                  className="cursor-pointer"
                  title={t('storages.edit.azureBlob.endpointTooltip')}
                >
                  <InfoCircleOutlined className="ml-2" style={{ color: 'gray' }} />
                </Tooltip>
              </div>
            </div>
          )}

          <div className="mb-1 flex w-full flex-col items-start sm:flex-row sm:items-center">
            <div className="mb-1 min-w-[110px] sm:mb-0 sm:pr-2">
              {t('storages.fields.blobPrefix')}
            </div>
            <div className="flex items-center">
              <Input
                value={storage?.azureBlobStorage?.prefix || ''}
                onChange={(e) => {
                  if (!storage?.azureBlobStorage) return;

                  setStorage({
                    ...storage,
                    azureBlobStorage: {
                      ...storage.azureBlobStorage,
                      prefix: e.target.value.trim(),
                    },
                  });
                  setUnsaved();
                }}
                size="small"
                className="w-full max-w-[250px]"
                placeholder={t('storages.edit.optionalPlaceholder', { example: 'my-prefix/' })}
              />

              <Tooltip
                className="cursor-pointer"
                title={t('storages.edit.azureBlob.prefixTooltip')}
              >
                <InfoCircleOutlined className="ml-2" style={{ color: 'gray' }} />
              </Tooltip>
            </div>
          </div>
        </>
      )}

      <div className="mb-5" />
    </>
  );
}
