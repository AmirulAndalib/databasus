import type { TranslationKey } from '../../../shared/i18n';
import { NotificationType } from './NotificationType';

export const NOTIFICATION_TYPE_LABEL_KEYS: Record<NotificationType, TranslationKey> = {
  [NotificationType.ALL]: 'notifiers.notificationTypes.all',
  [NotificationType.BACKUP_SUCCESS]: 'notifiers.notificationTypes.backupSuccess',
  [NotificationType.BACKUP_FAILED]: 'notifiers.notificationTypes.backupFailed',
  [NotificationType.HEALTHCHECK_SUCCESS]: 'notifiers.notificationTypes.healthcheckSuccess',
  [NotificationType.HEALTHCHECK_FAILED]: 'notifiers.notificationTypes.healthcheckFailed',
  [NotificationType.VERIFICATION_SUCCESS]: 'notifiers.notificationTypes.verificationSuccess',
  [NotificationType.VERIFICATION_FAILED]: 'notifiers.notificationTypes.verificationFailed',
};
