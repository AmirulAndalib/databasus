import { describe, expect, it } from 'vitest';

import { resolveInitialLocale } from './resolveInitialLocale';

const ALL_LOCALES = ['en', 'ru', 'es', 'pt', 'zh', 'fr'];

describe('resolveInitialLocale', () => {
  it('takes the highest-ranked supported browser language', () => {
    expect(
      resolveInitialLocale({
        storedLocale: null,
        browserLanguages: ['de', 'ru'],
        supportedLocales: ['en', 'ru'],
      }),
    ).toBe('ru');
  });

  it('falls back to English when no browser language is supported', () => {
    expect(
      resolveInitialLocale({
        storedLocale: null,
        browserLanguages: ['de-DE', 'it'],
        supportedLocales: ['en', 'ru'],
      }),
    ).toBe('en');
  });

  it('falls back to English for an empty browser list', () => {
    expect(
      resolveInitialLocale({ storedLocale: null, browserLanguages: [], supportedLocales: ['en'] }),
    ).toBe('en');
  });

  it.each([
    ['zh-TW', 'zh'],
    ['zh-HK', 'zh'],
    ['zh-CN', 'zh'],
    ['pt-PT', 'pt'],
    ['pt-BR', 'pt'],
    ['es-419', 'es'],
    ['FR-ca', 'fr'],
  ])('maps the regional variant %s to %s', (browserLanguage, resolvedLocale) => {
    expect(
      resolveInitialLocale({
        storedLocale: null,
        browserLanguages: [browserLanguage],
        supportedLocales: ALL_LOCALES,
      }),
    ).toBe(resolvedLocale);
  });

  it('lets a stored supported choice outrank the browser preference', () => {
    expect(
      resolveInitialLocale({
        storedLocale: 'en',
        browserLanguages: ['es'],
        supportedLocales: ALL_LOCALES,
      }),
    ).toBe('en');
  });

  it('ignores a stored value that is not supported', () => {
    expect(
      resolveInitialLocale({
        storedLocale: 'de',
        browserLanguages: ['ru'],
        supportedLocales: ['en', 'ru'],
      }),
    ).toBe('ru');
  });
});
