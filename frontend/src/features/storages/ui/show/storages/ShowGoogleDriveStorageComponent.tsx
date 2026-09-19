import { useTranslation } from 'react-i18next';

import type { Storage } from '../../../../../entity/storages';

interface Props {
  storage: Storage;
}

export function ShowGoogleDriveStorageComponent({ storage }: Props) {
  const { t } = useTranslation();

  return (
    <>
      <div className="mb-1 flex items-center">
        <div className="min-w-[110px] pr-2">{t('storages.fields.clientId')}</div>
        {storage?.googleDriveStorage?.clientId
          ? `${storage?.googleDriveStorage?.clientId.slice(0, 10)}***`
          : '-'}
      </div>

      <div className="mb-1 flex items-center">
        <div className="min-w-[110px] pr-2">{t('storages.fields.clientSecret')}</div>
        {`*************`}
      </div>

      <div className="mb-1 flex items-center">
        <div className="min-w-[110px] pr-2">{t('storages.fields.userToken')}</div>
        {`*************`}
      </div>
    </>
  );
}
