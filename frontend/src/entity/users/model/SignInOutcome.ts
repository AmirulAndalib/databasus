import type { PendingSignIn } from './PendingSignIn';
import type { SignInResponse } from './SignInResponse';

// A correct password produces one of these, never both: a finished sign-in when
// the instance asks for one factor, and a pending one when it asks for a code.
export type SignInOutcome =
  | { isCompleted: true; signIn: SignInResponse }
  | { isCompleted: false; pendingSignIn: PendingSignIn };
