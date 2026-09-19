import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { useTranslation } from 'react-i18next';

import { DICTIONARIES, SUPPORTED_LOCALES, useLocale } from '../i18n';

const GlobeIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </svg>
);

interface Props {
  isSplitStart?: boolean;
}

// Opens on hover like the website's selector; click is kept for touch screens, which have no
// hover. Each language is listed by the name its own dictionary gives it.
export function LanguageSelectorComponent({ isSplitStart = false }: Props) {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();

  const items: MenuProps['items'] = SUPPORTED_LOCALES.map((supportedLocale) => ({
    key: supportedLocale,
    label: <span lang={supportedLocale}>{DICTIONARIES[supportedLocale].language.nativeName}</span>,
    onClick: () => setLocale(supportedLocale),
  }));

  return (
    <Dropdown
      menu={{ items, selectedKeys: [locale] }}
      trigger={['hover', 'click']}
      placement="bottomRight"
    >
      <button
        className={`flex cursor-pointer items-center gap-1.5 border border-gray-200 bg-white px-2.5 py-1 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 ${
          isSplitStart ? 'rounded-l-md' : 'rounded-md'
        }`}
        title={t('app.languageControl.title', {
          language: DICTIONARIES[locale].language.nativeName,
        })}
      >
        <GlobeIcon />
        <span>{locale.toUpperCase()}</span>
      </button>
    </Dropdown>
  );
}
