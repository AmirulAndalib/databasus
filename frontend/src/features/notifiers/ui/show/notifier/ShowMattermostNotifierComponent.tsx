import { useTranslation } from 'react-i18next';

import {
  MATTERMOST_DELIVERY_MODE_LABEL_KEYS,
  MattermostDeliveryMode,
  type Notifier,
} from '../../../../../entity/notifiers';

interface Props {
  notifier: Notifier;
}

export function ShowMattermostNotifierComponent({ notifier }: Props) {
  const { t } = useTranslation();
  const mattermostNotifier = notifier.mattermostNotifier;

  if (!mattermostNotifier) return <div />;

  const isWebhookMode = mattermostNotifier.deliveryMode === MattermostDeliveryMode.WEBHOOK;

  return (
    <>
      <div className="flex">
        <div className="max-w-[110px] min-w-[110px] pr-3">
          {t('notifiers.mattermost.connectVia')}
        </div>
        <div>{t(MATTERMOST_DELIVERY_MODE_LABEL_KEYS[mattermostNotifier.deliveryMode])}</div>
      </div>

      {isWebhookMode ? (
        <>
          <div className="flex">
            <div className="max-w-[110px] min-w-[110px] pr-3">
              {t('notifiers.fields.webhookUrl')}
            </div>
            <div className="break-all">
              {mattermostNotifier.webhookUrl
                ? `${mattermostNotifier.webhookUrl}*******`
                : '*******'}
            </div>
          </div>

          {mattermostNotifier.targetChannelName && (
            <div className="flex">
              <div className="max-w-[110px] min-w-[110px] pr-3">
                {t('notifiers.mattermost.channel')}
              </div>
              <div className="break-all">{mattermostNotifier.targetChannelName}</div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex">
            <div className="max-w-[110px] min-w-[110px] pr-3">
              {t('notifiers.mattermost.serverUrl')}
            </div>
            <div className="break-all">{mattermostNotifier.serverUrl}</div>
          </div>

          <div className="flex">
            <div className="max-w-[110px] min-w-[110px] pr-3">
              {t('notifiers.fields.channelId')}
            </div>
            <div className="break-all">{mattermostNotifier.targetChannelId}</div>
          </div>
        </>
      )}
    </>
  );
}
