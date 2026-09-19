// eslint-disable-next-line i18next/no-literal-string -- locale code
const FALLBACK_LOCALE = 'en';

interface ResolveInitialLocaleInput<L extends string> {
  storedLocale: string | null;
  browserLanguages: readonly string[];
  supportedLocales: readonly L[];
}

// A stored choice wins when it is still supported. Otherwise the browser's preferences are walked
// in order and the first one whose primary subtag we ship is taken, so ["de", "ru"] gives Russian
// rather than English. Region subtags are dropped: zh-TW maps to the single Chinese dictionary and
// pt-PT to the single (Brazilian) Portuguese one.
export const resolveInitialLocale = <L extends string>({
  storedLocale,
  browserLanguages,
  supportedLocales,
}: ResolveInitialLocaleInput<L>): L | typeof FALLBACK_LOCALE => {
  const isSupported = (value: string): value is L => supportedLocales.includes(value as L);

  if (storedLocale && isSupported(storedLocale)) {
    return storedLocale;
  }

  for (const language of browserLanguages) {
    const primarySubtag = language.toLowerCase().split('-')[0];

    if (isSupported(primarySubtag)) {
      return primarySubtag;
    }
  }

  return FALLBACK_LOCALE;
};
