import { useTranslation } from 'react-i18next';

import type { Storage } from '../../../../../entity/storages';

interface Props {
  storage: Storage;
}

export function ShowRcloneStorageComponent({ storage }: Props) {
  const { t } = useTranslation();

  return (
    <>
      <div className="mb-1 flex items-center">
        <div className="min-w-[110px] pr-2">{t('storages.fields.remotePath')}</div>
        {storage?.rcloneStorage?.remotePath || '-'}
      </div>

      <div className="mb-1 flex items-center">
        <div className="min-w-[110px] pr-2">{t('storages.fields.config')}</div>
        {'*************'}
      </div>
    </>
  );
}
