import { DatePicker, Select } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

import {
  type BackupsFilters,
  LOGICAL_BACKUP_STATUS_LABEL_KEYS,
  LogicalBackupStatus,
} from '../../../../entity/backups/logical';

interface Props {
  filters: BackupsFilters;
  onFiltersChange: (filters: BackupsFilters) => void;
}

const FILTERABLE_STATUSES = [
  LogicalBackupStatus.IN_PROGRESS,
  LogicalBackupStatus.COMPLETED,
  LogicalBackupStatus.FAILED,
  LogicalBackupStatus.CANCELED,
];

export const LogicalBackupsFiltersPanelComponent = ({ filters, onFiltersChange }: Props) => {
  const { t } = useTranslation();

  const handleStatusChange = (statuses: string[]) => {
    onFiltersChange({ ...filters, statuses: statuses.length > 0 ? statuses : undefined });
  };

  const handleBeforeDateChange = (date: Dayjs | null) => {
    onFiltersChange({
      ...filters,
      beforeDate: date ? date.toISOString() : undefined,
    });
  };

  const statusOptions = FILTERABLE_STATUSES.map((status) => ({
    label: t(LOGICAL_BACKUP_STATUS_LABEL_KEYS[status]),
    value: status,
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="min-w-[90px] pr-2 text-sm text-gray-500 dark:text-gray-400">
          {t('common.fields.status')}
        </span>
        <Select
          mode="multiple"
          value={filters.statuses ?? []}
          onChange={handleStatusChange}
          options={statusOptions}
          placeholder={t('backups.filters.allStatuses')}
          size="small"
          variant="filled"
          className="w-[200px] [&_.ant-select-selector]:!rounded-md"
          allowClear
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="min-w-[90px] pr-2 text-sm text-gray-500 dark:text-gray-400">
          {t('backups.filters.before')}
        </span>
        <DatePicker
          value={filters.beforeDate ? dayjs(filters.beforeDate) : null}
          onChange={handleBeforeDateChange}
          size="small"
          variant="filled"
          className="w-[200px] !rounded-md"
          allowClear
        />
      </div>
    </div>
  );
};
