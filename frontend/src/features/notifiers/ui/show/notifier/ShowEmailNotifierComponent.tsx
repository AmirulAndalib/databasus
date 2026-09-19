import { useTranslation } from 'react-i18next';

import type { Notifier } from '../../../../../entity/notifiers';

interface Props {
  notifier: Notifier;
}

export function ShowEmailNotifierComponent({ notifier }: Props) {
  const { t } = useTranslation();

  return (
    <>
      <div className="mb-1 flex items-center">
        <div className="min-w-[110px] pr-2">{t('notifiers.email.targetEmail')}</div>
        {notifier?.emailNotifier?.targetEmail}
      </div>

      <div className="mb-1 flex items-center">
        <div className="min-w-[110px] pr-2">{t('notifiers.email.smtpHost')}</div>
        {notifier?.emailNotifier?.smtpHost}
      </div>

      <div className="mb-1 flex items-center">
        <div className="min-w-[110px] pr-2">{t('notifiers.email.smtpPort')}</div>
        {notifier?.emailNotifier?.smtpPort}
      </div>

      <div className="mb-1 flex items-center">
        <div className="min-w-[110px] pr-2">{t('notifiers.email.smtpUser')}</div>
        {notifier?.emailNotifier?.smtpUser}
      </div>

      <div className="mb-1 flex items-center">
        <div className="min-w-[110px] pr-2">{t('notifiers.email.smtpPassword')}</div>
        {'*************'}
      </div>

      <div className="mb-1 flex items-center">
        <div className="min-w-[110px] pr-2">{t('notifiers.email.from')}</div>
        {notifier?.emailNotifier?.from || t('notifiers.email.fromAuto')}
      </div>

      {notifier?.emailNotifier?.isInsecureSkipVerify && (
        <div className="mb-1 flex items-center">
          <div className="min-w-[110px] pr-2">{t('notifiers.fields.skipTls')}</div>
          {t('common.states.enabled')}
        </div>
      )}
    </>
  );
}
