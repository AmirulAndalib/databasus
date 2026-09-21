import type { PendingSignIn } from '../model/PendingSignIn';
import type { SignInOutcome } from '../model/SignInOutcome';
import type { SignInResponse } from '../model/SignInResponse';

// Only the finished shape carries a token, so the token is what tells the two
// apart. A body carrying neither is a backend the client does not understand,
// and storing nothing is safer than storing an empty token.
export const readSignInOutcome = (response: unknown): SignInOutcome => {
  const body = response as Partial<SignInResponse & PendingSignIn> | null;

  if (body?.token) {
    return { isCompleted: true, signIn: body as SignInResponse };
  }

  if (body?.pendingSignInId) {
    return { isCompleted: false, pendingSignIn: body as PendingSignIn };
  }

  throw new Error('sign-in response carries neither a token nor a pending sign-in');
};
