import { GoogleOutlined } from '@ant-design/icons';
import { Button, message } from 'antd';
import { useTranslation } from 'react-i18next';

import { GOOGLE_CLIENT_ID, getOAuthRedirectUri } from '../../../../constants';

export function GoogleOAuthComponent() {
  const { t } = useTranslation();

  if (!GOOGLE_CLIENT_ID) {
    return null;
  }

  const redirectUri = getOAuthRedirectUri();

  const handleGoogleLogin = () => {
    try {
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state: 'google',
      });

      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

      // Validate URL is properly formed
      new URL(googleAuthUrl);
      window.location.href = googleAuthUrl;
    } catch (error) {
      message.error(t('users.oauth.invalidConfiguration'));
      console.error('Google OAuth URL error:', error);
    }
  };

  return (
    <Button icon={<GoogleOutlined />} onClick={handleGoogleLogin} className="w-full" size="large">
      {t('users.oauth.continueWithGoogle')}
    </Button>
  );
}
