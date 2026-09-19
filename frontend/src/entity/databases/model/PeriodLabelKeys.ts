import type { TranslationKey } from '../../../shared/i18n';
import { Period } from './Period';

export const PERIOD_LABEL_KEYS: Record<Period, TranslationKey> = {
  [Period.DAY]: 'intervals.periods.day',
  [Period.WEEK]: 'intervals.periods.week',
  [Period.MONTH]: 'intervals.periods.month',
  [Period.THREE_MONTH]: 'intervals.periods.threeMonths',
  [Period.SIX_MONTH]: 'intervals.periods.sixMonths',
  [Period.YEAR]: 'intervals.periods.year',
  [Period.TWO_YEARS]: 'intervals.periods.twoYears',
  [Period.THREE_YEARS]: 'intervals.periods.threeYears',
  [Period.FOUR_YEARS]: 'intervals.periods.fourYears',
  [Period.FIVE_YEARS]: 'intervals.periods.fiveYears',
  [Period.FOREVER]: 'intervals.periods.forever',
};
