import { useTranslation } from 'react-i18next';

import { STORAGE_TYPE_LABEL_KEYS, type Storage, StorageType } from '../../../../entity/storages';
import { getStorageLogoFromType } from '../../../../entity/storages/models/getStorageLogoFromType';
import { ShowAzureBlobStorageComponent } from './storages/ShowAzureBlobStorageComponent';
import { ShowFTPStorageComponent } from './storages/ShowFTPStorageComponent';
import { ShowGoogleDriveStorageComponent } from './storages/ShowGoogleDriveStorageComponent';
import { ShowNASStorageComponent } from './storages/ShowNASStorageComponent';
import { ShowRcloneStorageComponent } from './storages/ShowRcloneStorageComponent';
import { ShowS3StorageComponent } from './storages/ShowS3StorageComponent';
import { ShowSFTPStorageComponent } from './storages/ShowSFTPStorageComponent';

interface Props {
  storage?: Storage;
}

export function ShowStorageComponent({ storage }: Props) {
  const { t } = useTranslation();

  if (!storage) return null;

  return (
    <div>
      <div className="mb-1 flex items-center">
        <div className="min-w-[110px] pr-2">{t('common.fields.type')}</div>

        {t(STORAGE_TYPE_LABEL_KEYS[storage.type])}

        <img src={getStorageLogoFromType(storage.type)} alt="" className="ml-1 h-4 w-4" />
      </div>

      <div>
        {storage?.type === StorageType.S3 && <ShowS3StorageComponent storage={storage} />}

        {storage?.type === StorageType.GOOGLE_DRIVE && (
          <ShowGoogleDriveStorageComponent storage={storage} />
        )}

        {storage?.type === StorageType.NAS && <ShowNASStorageComponent storage={storage} />}

        {storage?.type === StorageType.AZURE_BLOB && (
          <ShowAzureBlobStorageComponent storage={storage} />
        )}

        {storage?.type === StorageType.FTP && <ShowFTPStorageComponent storage={storage} />}

        {storage?.type === StorageType.SFTP && <ShowSFTPStorageComponent storage={storage} />}

        {storage?.type === StorageType.RCLONE && <ShowRcloneStorageComponent storage={storage} />}
      </div>
    </div>
  );
}
