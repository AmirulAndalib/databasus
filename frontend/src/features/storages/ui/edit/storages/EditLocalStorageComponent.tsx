import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export function EditLocalStorageComponent() {
  const { t } = useTranslation();

  return (
    <>
      <div className="max-w-[360px] text-yellow-600 dark:text-yellow-400">
        <ExclamationCircleOutlined /> {t('storages.edit.local.diskSpaceWarning')}
      </div>

      <div className="mb-5" />
    </>
  );
}
