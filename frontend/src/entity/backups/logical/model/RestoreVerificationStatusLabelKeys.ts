import type { TranslationKey } from '../../../../shared/i18n';
import { RestoreVerificationStatus } from './RestoreVerificationStatus';

// NOT_VERIFIED has no label: a backup that was never restore-verified shows no tag at all.
// It is an explicit null rather than a missing entry, so adding a status still fails the build.
export const RESTORE_VERIFICATION_STATUS_LABEL_KEYS: Record<
  RestoreVerificationStatus,
  TranslationKey | null
> = {
  [RestoreVerificationStatus.NOT_VERIFIED]: null,
  [RestoreVerificationStatus.VERIFIED_SUCCESSFUL]: 'status.restoreVerification.verifiedSuccessful',
  [RestoreVerificationStatus.VERIFICATION_FAILED]: 'status.restoreVerification.verificationFailed',
};
