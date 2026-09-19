import type { TranslationKey } from '../../../../shared/i18n';
import { PhysicalBackupNotificationType } from './PhysicalBackupNotificationType';

export const PHYSICAL_BACKUP_NOTIFICATION_TYPE_LABEL_KEYS: Record<
  PhysicalBackupNotificationType,
  TranslationKey
> = {
  [PhysicalBackupNotificationType.BACKUP_SUCCESS]:
    'backups.physical.notificationTypes.backupSuccess',
  [PhysicalBackupNotificationType.BACKUP_FAILED]: 'backups.physical.notificationTypes.backupFailed',
  [PhysicalBackupNotificationType.CHAIN_BROKEN]: 'backups.physical.notificationTypes.chainBroken',
  [PhysicalBackupNotificationType.WAL_GAP]: 'backups.physical.notificationTypes.walGap',
};
