import { describe, expect, it } from 'vitest';

import { readSignInOutcome } from './readSignInOutcome';

describe('readSignInOutcome', () => {
  it('reads a finished sign-in from a body carrying a token', () => {
    const outcome = readSignInOutcome({ userId: 'user-1', email: 'a@example.com', token: 'jwt' });

    expect(outcome.isCompleted).toBe(true);
    expect(outcome.isCompleted && outcome.signIn.token).toBe('jwt');
  });

  it('reads a pending sign-in from a body carrying an identifier', () => {
    const outcome = readSignInOutcome({ pendingSignInId: 'pending-1', email: 'a@example.com' });

    expect(outcome.isCompleted).toBe(false);
    expect(!outcome.isCompleted && outcome.pendingSignIn.pendingSignInId).toBe('pending-1');
  });

  it('refuses a body carrying neither', () => {
    expect(() => readSignInOutcome({ email: 'a@example.com' })).toThrow();
  });
});
