import { useTranslation } from 'react-i18next';

import type { Storage } from '../../../../../entity/storages';

interface Props {
  storage: Storage;
}

export function ShowFTPStorageComponent({ storage }: Props) {
  const { t } = useTranslation();

  return (
    <>
      <div className="mb-1 flex items-center">
        <div className="min-w-[110px] pr-2">{t('common.fields.host')}</div>
        {storage?.ftpStorage?.host || '-'}
      </div>

      <div className="mb-1 flex items-center">
        <div className="min-w-[110px] pr-2">{t('common.fields.port')}</div>
        {storage?.ftpStorage?.port || '-'}
      </div>

      <div className="mb-1 flex items-center">
        <div className="min-w-[110px] pr-2">{t('common.fields.username')}</div>
        {storage?.ftpStorage?.username || '-'}
      </div>

      <div className="mb-1 flex items-center">
        <div className="min-w-[110px] pr-2">{t('common.fields.password')}</div>
        {'*************'}
      </div>

      <div className="mb-1 flex items-center">
        <div className="min-w-[110px] pr-2">{t('storages.fields.path')}</div>
        {storage?.ftpStorage?.path || '-'}
      </div>

      <div className="mb-1 flex items-center">
        <div className="min-w-[110px] pr-2">{t('storages.fields.useSslTls')}</div>
        {storage?.ftpStorage?.useSsl ? t('common.answers.yes') : t('common.answers.no')}
      </div>

      {storage?.ftpStorage?.useSsl && storage?.ftpStorage?.skipTlsVerify && (
        <div className="mb-1 flex items-center">
          <div className="min-w-[110px] pr-2">{t('storages.fields.skipTls')}</div>
          {t('common.states.enabled')}
        </div>
      )}
    </>
  );
}
