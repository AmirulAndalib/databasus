import { DownOutlined, UpOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

interface Props {
  isShowAdvanced: boolean;
  onToggle: () => void;
}

export const AdvancedSettingsToggleComponent = ({ isShowAdvanced, onToggle }: Props) => {
  const { t } = useTranslation();

  return (
    <div className="mt-4 mb-1 flex items-center">
      <div
        className="flex cursor-pointer items-center text-sm text-blue-600 hover:text-blue-800"
        onClick={onToggle}
      >
        <span className="mr-2">{t('databases.edit.advancedSettings')}</span>

        {isShowAdvanced ? (
          <UpOutlined style={{ fontSize: '12px' }} />
        ) : (
          <DownOutlined style={{ fontSize: '12px' }} />
        )}
      </div>
    </div>
  );
};
