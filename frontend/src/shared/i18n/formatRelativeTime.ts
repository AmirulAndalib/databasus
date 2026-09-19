import dayjs, { type ConfigType } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

// The only place that calls fromNow(). Components read it through useLocale(), so a language
// switch re-renders every relative time on screen instead of leaving it in the old language.
export const formatRelativeTime = (date: ConfigType, dayjsLocale: string): string =>
  dayjs(date).locale(dayjsLocale).fromNow();
