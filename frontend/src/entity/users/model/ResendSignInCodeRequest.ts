export interface ResendSignInCodeRequest {
  pendingSignInId: string;
  cloudflareTurnstileToken?: string;
}
