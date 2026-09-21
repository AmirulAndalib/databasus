import type { UsersSettings } from './UsersSettings';

// The instance answers with its own judgement about the mail server, which the
// settings screen needs and no request may set.
export interface UsersSettingsResponse extends UsersSettings {
  isEmailConfigured: boolean;
}
