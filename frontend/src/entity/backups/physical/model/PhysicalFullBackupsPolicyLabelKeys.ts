import type { TranslationKey } from '../../../../shared/i18n';
import { PhysicalFullBackupsPolicy } from './PhysicalFullBackupsPolicy';

export const PHYSICAL_FULL_BACKUPS_POLICY_LABEL_KEYS: Record<
  PhysicalFullBackupsPolicy,
  TranslationKey
> = {
  [PhysicalFullBackupsPolicy.LAST_N]: 'backups.physical.fullBackupsPolicies.lastN',
  [PhysicalFullBackupsPolicy.GFS]: 'backups.physical.fullBackupsPolicies.gfs',
};
