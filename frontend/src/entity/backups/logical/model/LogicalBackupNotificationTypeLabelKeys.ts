import type { TranslationKey } from '../../../../shared/i18n';
import { LogicalBackupNotificationType } from './LogicalBackupNotificationType';

export const LOGICAL_BACKUP_NOTIFICATION_TYPE_LABEL_KEYS: Record<
  LogicalBackupNotificationType,
  TranslationKey
> = {
  [LogicalBackupNotificationType.BackupSuccess]: 'backups.logical.notificationTypes.backupSuccess',
  [LogicalBackupNotificationType.BackupFailed]: 'backups.logical.notificationTypes.backupFailed',
};
