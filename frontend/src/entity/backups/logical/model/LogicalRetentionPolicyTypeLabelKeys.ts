import type { TranslationKey } from '../../../../shared/i18n';
import { LogicalRetentionPolicyType } from './LogicalRetentionPolicyType';

export const LOGICAL_RETENTION_POLICY_TYPE_LABEL_KEYS: Record<
  LogicalRetentionPolicyType,
  TranslationKey
> = {
  [LogicalRetentionPolicyType.GFS]: 'backups.logical.retentionPolicyTypes.gfs',
  [LogicalRetentionPolicyType.TimePeriod]: 'backups.logical.retentionPolicyTypes.timePeriod',
  [LogicalRetentionPolicyType.Count]: 'backups.logical.retentionPolicyTypes.count',
};
