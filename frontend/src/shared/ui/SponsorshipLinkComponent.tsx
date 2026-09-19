import { Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';

import { getWebsitePageUrl, useLocale } from '../i18n';

interface Props {
  className: string;
}

export const SponsorshipLinkComponent = ({ className }: Props) => {
  const { t } = useTranslation();
  const { locale } = useLocale();

  return (
    <Tooltip title={t('app.sponsorship.hint')}>
      <a
        className={`!underline !decoration-blue-600 !decoration-2 underline-offset-4 ${className}`}
        href={getWebsitePageUrl('sponsorship', locale)}
        target="_blank"
        rel="noreferrer"
      >
        {t('app.sponsorship.link')}
      </a>
    </Tooltip>
  );
};
