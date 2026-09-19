import type { ParseKeys } from 'i18next';

// A dictionary key held as data, e.g. in a label table or a parser result. It gets the same
// compile-time check as a literal key passed to t().
export type TranslationKey = ParseKeys;
