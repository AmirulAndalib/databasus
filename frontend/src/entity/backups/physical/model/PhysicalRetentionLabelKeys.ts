import type { TranslationKey } from '../../../../shared/i18n';
import { PhysicalRetention } from './PhysicalRetention';

export const PHYSICAL_RETENTION_LABEL_KEYS: Record<PhysicalRetention, TranslationKey> = {
  [PhysicalRetention.CHAINS]: 'backups.physical.retentions.chains',
  [PhysicalRetention.FULL_BACKUPS]: 'backups.physical.retentions.fullBackups',
  [PhysicalRetention.CHAINS_AND_FULL_BACKUPS]: 'backups.physical.retentions.chainsAndFullBackups',
};
