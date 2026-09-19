import { EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';
import { App, Button, Input } from 'antd';
import { type JSX, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { userApi } from '../../../entity/users';
import { translateApiError } from '../../../shared/i18n';

interface AdminPasswordComponentProps {
  onPasswordSet?: () => void;
}

export function AdminPasswordComponent({
  onPasswordSet,
}: AdminPasswordComponentProps): JSX.Element {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  const [isLoading, setLoading] = useState(false);

  const [passwordError, setPasswordError] = useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = useState(false);

  const [adminPasswordError, setAdminPasswordError] = useState<unknown>();

  const validateFields = (): boolean => {
    if (!password) {
      setPasswordError(true);
      return false;
    }

    if (password.length < 8) {
      setPasswordError(true);
      message.error(t('users.validation.passwordTooShort', { minLength: 8 }));
      return false;
    }
    setPasswordError(false);

    if (!confirmPassword) {
      setConfirmPasswordError(true);
      return false;
    }
    if (password !== confirmPassword) {
      setConfirmPasswordError(true);
      return false;
    }
    setConfirmPasswordError(false);

    return true;
  };

  const onSetPassword = async () => {
    setAdminPasswordError(undefined);

    if (validateFields()) {
      setLoading(true);

      try {
        await userApi.setAdminPassword({
          password,
        });

        // Automatically sign in as admin after setting password
        await userApi.signIn({
          // eslint-disable-next-line i18next/no-literal-string -- login of the built-in admin account
          email: 'admin',
          password,
        });

        // Notify parent component that password was set successfully
        onPasswordSet?.();
      } catch (e) {
        setAdminPasswordError(e);
      }
    }

    setLoading(false);
  };

  return (
    <div className="w-full max-w-[300px]">
      <div className="mb-5 text-center text-2xl font-bold">{t('users.adminPassword.title')}</div>

      <div className="mx-auto mb-4 max-w-[250px] text-center text-sm text-gray-600 dark:text-gray-400">
        {t('users.adminPassword.description')}
      </div>

      <div className="my-1 text-xs font-semibold">{t('users.fields.email')}</div>
      <Input value="admin" disabled />

      <div className="my-1 text-xs font-semibold">{t('common.fields.password')}</div>
      <Input.Password
        placeholder="********"
        value={password}
        onChange={(e) => {
          setPasswordError(false);
          setPassword(e.currentTarget.value);
        }}
        status={passwordError ? 'error' : undefined}
        iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
        visibilityToggle={{ visible: passwordVisible, onVisibleChange: setPasswordVisible }}
        autoComplete="new-password"
      />

      <div className="my-1 text-xs font-semibold">{t('users.fields.confirmPassword')}</div>
      <Input.Password
        placeholder="********"
        value={confirmPassword}
        status={confirmPasswordError ? 'error' : undefined}
        onChange={(e) => {
          setConfirmPasswordError(false);
          setConfirmPassword(e.currentTarget.value);
        }}
        iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
        autoComplete="new-password"
        visibilityToggle={{
          visible: confirmPasswordVisible,
          onVisibleChange: setConfirmPasswordVisible,
        }}
      />

      <div className="mt-3" />

      <Button
        disabled={isLoading}
        loading={isLoading}
        className="w-full"
        onClick={() => {
          onSetPassword();
        }}
        type="primary"
      >
        {t('users.adminPassword.submit')}
      </Button>

      {adminPasswordError !== undefined && (
        <div className="mt-3 flex justify-center text-center text-sm text-red-600">
          {translateApiError(adminPasswordError, t)}
        </div>
      )}
    </div>
  );
}
