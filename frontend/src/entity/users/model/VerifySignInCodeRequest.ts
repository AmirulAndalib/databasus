export interface VerifySignInCodeRequest {
  pendingSignInId: string;
  code: string;
  cloudflareTurnstileToken?: string;
}
