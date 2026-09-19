import { Button, Input } from 'antd';
import { useTranslation } from 'react-i18next';

import type { Storage } from '../../../../../entity/storages';
import type { StorageOauthDto } from '../../../../../entity/storages/models/StorageOauthDto';
import { getWebsitePageUrl, useLocale } from '../../../../../shared/i18n';

interface Props {
  storage: Storage;
  setStorage: (storage: Storage) => void;
  setUnsaved: () => void;
}

export function EditGoogleDriveStorageComponent({ storage, setStorage, setUnsaved }: Props) {
  const { t } = useTranslation();
  const { locale } = useLocale();

  const goToAuthUrl = () => {
    if (!storage?.googleDriveStorage?.clientId || !storage?.googleDriveStorage?.clientSecret) {
      return;
    }

    const redirectUri = `${window.location.origin}/storages/google-oauth`;
    const clientId = storage.googleDriveStorage.clientId;
    const scope = 'https://www.googleapis.com/auth/drive.file';

    const oauthDto: StorageOauthDto = {
      storage: storage,
      authCode: '',
    };

    // eslint-disable-next-line i18next/no-literal-string -- OAuth request URL, not copy
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${
      clientId
    }&redirect_uri=${redirectUri}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent&state=${encodeURIComponent(JSON.stringify(oauthDto))}`;

    window.open(authUrl);
  };

  return (
    <>
      <div className="mb-2 flex items-center">
        <div className="hidden min-w-[110px] sm:block" />

        <div className="text-xs text-blue-600">
          <a
            href={getWebsitePageUrl('storagesGoogleDrive', locale)}
            target="_blank"
            rel="noreferrer"
          >
            {t('storages.edit.googleDrive.guideLink')}
          </a>
        </div>
      </div>

      <div className="mb-1 flex w-full flex-col items-start sm:flex-row sm:items-center">
        <div className="mb-1 min-w-[110px] sm:mb-0 sm:pr-2">{t('storages.fields.clientId')}</div>
        <Input
          value={storage?.googleDriveStorage?.clientId || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            if (!storage?.googleDriveStorage) return;

            setStorage({
              ...storage,
              googleDriveStorage: {
                ...storage.googleDriveStorage,
                clientId: e.target.value.trim(),
              },
            });
            setUnsaved();
          }}
          size="small"
          className="w-full max-w-[250px]"
          // eslint-disable-next-line i18next/no-literal-string -- example client ID
          placeholder="my-client-id"
          disabled={!!storage?.googleDriveStorage?.tokenJson}
        />
      </div>

      <div className="mb-1 flex w-full flex-col items-start sm:flex-row sm:items-center">
        <div className="mb-1 min-w-[110px] sm:mb-0 sm:pr-2">
          {t('storages.fields.clientSecret')}
        </div>
        <Input
          value={storage?.googleDriveStorage?.clientSecret || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            if (!storage?.googleDriveStorage) return;

            setStorage({
              ...storage,
              googleDriveStorage: {
                ...storage.googleDriveStorage,
                clientSecret: e.target.value.trim(),
              },
            });
            setUnsaved();
          }}
          size="small"
          className="w-full max-w-[250px]"
          // eslint-disable-next-line i18next/no-literal-string -- example client secret
          placeholder="my-client-secret"
          disabled={!!storage?.googleDriveStorage?.tokenJson}
        />
      </div>

      {storage?.googleDriveStorage?.tokenJson && (
        <>
          <div className="mb-1 flex w-full flex-col items-start sm:flex-row sm:items-center">
            <div className="mb-1 min-w-[110px] sm:mb-0 sm:pr-2">
              {t('storages.fields.userToken')}
            </div>
            <Input
              value={storage?.googleDriveStorage?.tokenJson || ''}
              disabled
              size="small"
              className="w-full max-w-[250px]"
              // eslint-disable-next-line i18next/no-literal-string -- example token
              placeholder="my-user-token"
            />
          </div>
        </>
      )}

      {!storage?.googleDriveStorage?.tokenJson && (
        <Button
          type="primary"
          disabled={
            !storage?.googleDriveStorage?.clientId || !storage?.googleDriveStorage?.clientSecret
          }
          onClick={goToAuthUrl}
        >
          {t('storages.edit.googleDrive.authorize')}
        </Button>
      )}
    </>
  );
}
