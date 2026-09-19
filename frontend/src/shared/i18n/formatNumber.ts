// Groups digits by the selected language rather than the browser's, so numbers agree with the
// words and dates on the same screen. Always full numerals: compact forms such as the Chinese 万
// lose the precision a size or a count needs.
export const formatNumber = (
  value: number,
  languageTag: string,
  options?: Intl.NumberFormatOptions,
): string => new Intl.NumberFormat(languageTag, options).format(value);
