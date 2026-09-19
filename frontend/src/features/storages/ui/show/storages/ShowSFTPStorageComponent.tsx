import { useTranslation } from 'react-i18next';

import type { Storage } from '../../../../../entity/storages';

interface Props {
  storage: Storage;
}

export function ShowSFTPStorageComponent({ storage }: Props) {
  const { t } = useTranslation();

  const authMethodLabel = storage?.sftpStorage?.privateKey
    ? t('storages.sftpAuthMethods.privateKey')
    : t('storages.sftpAuthMethods.password');

  return (
    <>
      <div className="mb-1 flex items-center">
        <div className="min-w-[110px] pr-2">{t('common.fields.host')}</div>
        {storage?.sftpStorage?.host || '-'}
      </div>

      <div className="mb-1 flex items-center">
        <div className="min-w-[110px] pr-2">{t('common.fields.port')}</div>
        {storage?.sftpStorage?.port || '-'}
      </div>

      <div className="mb-1 flex items-center">
        <div className="min-w-[110px] pr-2">{t('common.fields.username')}</div>
        {storage?.sftpStorage?.username || '-'}
      </div>

      <div className="mb-1 flex items-center">
        <div className="min-w-[110px] pr-2">{t('storages.fields.authMethod')}</div>
        {authMethodLabel}
      </div>

      <div className="mb-1 flex items-center">
        <div className="min-w-[110px] pr-2">{t('storages.fields.credentials')}</div>
        {'*************'}
      </div>

      <div className="mb-1 flex items-center">
        <div className="min-w-[110px] pr-2">{t('storages.fields.path')}</div>
        {storage?.sftpStorage?.path || '-'}
      </div>

      {storage?.sftpStorage?.skipHostKeyVerify && (
        <div className="mb-1 flex items-center">
          <div className="min-w-[110px] pr-2">{t('storages.fields.skipHostKey')}</div>
          {t('common.states.enabled')}
        </div>
      )}
    </>
  );
}
