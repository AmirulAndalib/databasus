import { Input } from 'antd';
import { useTranslation } from 'react-i18next';

import type { Notifier } from '../../../../../entity/notifiers';
import { getWebsitePageUrl, useLocale } from '../../../../../shared/i18n';

interface Props {
  notifier: Notifier;
  setNotifier: (notifier: Notifier) => void;
  setUnsaved: () => void;
}

export function EditSlackNotifierComponent({ notifier, setNotifier, setUnsaved }: Props) {
  const { t } = useTranslation();
  const { locale } = useLocale();

  return (
    <>
      <div className="mb-1 max-w-[250px] sm:ml-[150px]" style={{ lineHeight: 1 }}>
        <a
          className="text-xs !text-blue-600"
          href={getWebsitePageUrl('notifiersSlack', locale)}
          target="_blank"
          rel="noreferrer"
        >
          {t('notifiers.slack.howToConnect')}
        </a>
      </div>

      <div className="mb-1 flex w-full flex-col items-start sm:flex-row sm:items-center">
        <div className="mb-1 min-w-[150px] sm:mb-0 sm:pr-2">{t('notifiers.fields.botToken')}</div>
        <Input
          value={notifier?.slackNotifier?.botToken || ''}
          onChange={(e) => {
            if (!notifier?.slackNotifier) return;

            setNotifier({
              ...notifier,
              slackNotifier: {
                ...notifier.slackNotifier,
                botToken: e.target.value.trim(),
              },
            });
            setUnsaved();
          }}
          size="small"
          className="w-full max-w-[250px]"
          // eslint-disable-next-line i18next/no-literal-string -- example token prefix, not copy
          placeholder="xoxb-..."
        />
      </div>

      <div className="mb-1 flex w-full flex-col items-start sm:flex-row sm:items-center">
        <div className="mb-1 min-w-[150px] sm:mb-0 sm:pr-2">
          {t('notifiers.fields.targetChatId')}
        </div>
        <Input
          value={notifier?.slackNotifier?.targetChatId || ''}
          onChange={(e) => {
            if (!notifier?.slackNotifier) return;

            setNotifier({
              ...notifier,
              slackNotifier: {
                ...notifier.slackNotifier,
                targetChatId: e.target.value.trim(),
              },
            });
            setUnsaved();
          }}
          size="small"
          className="w-full max-w-[250px]"
          // eslint-disable-next-line i18next/no-literal-string -- example channel ID
          placeholder="C1234567890"
        />
      </div>
    </>
  );
}
