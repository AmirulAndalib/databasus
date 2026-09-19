import { useTranslation } from 'react-i18next';

import type { Notifier } from '../../../../../entity/notifiers';

interface Props {
  notifier: Notifier;
}

export function ShowDiscordNotifierComponent({ notifier }: Props) {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex">
        <div className="max-w-[110px] min-w-[110px] pr-3">
          {t('notifiers.discord.channelWebhookUrl')}
        </div>

        <div>{notifier.discordNotifier?.channelWebhookUrl?.slice(0, 10)}*******</div>
      </div>
    </>
  );
}
