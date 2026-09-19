import { useTranslation } from 'react-i18next';

import {
  DATABASE_TYPE_LABEL_KEYS,
  type Database,
  DatabaseType,
  MysqlVersion,
} from '../../../../entity/databases';
import { ShowSshTunnelComponent } from './ShowSshTunnelComponent';

interface Props {
  database: Database;
}

const mysqlVersionLabels = {
  [MysqlVersion.MysqlVersion57]: '5.7',
  [MysqlVersion.MysqlVersion80]: '8.0',
  [MysqlVersion.MysqlVersion84]: '8.4',
  [MysqlVersion.MysqlVersion9]: '9',
};

export const ShowMySqlSpecificDataComponent = ({ database }: Props) => {
  const { t } = useTranslation();

  return (
    <div>
      <div className="mb-1 flex w-full items-center">
        <div className="min-w-[150px] pr-2">
          {t('databases.fields.version', {
            engine: t(DATABASE_TYPE_LABEL_KEYS[DatabaseType.MYSQL]),
          })}
        </div>
        <div>{database.mysql?.version ? mysqlVersionLabels[database.mysql.version] : ''}</div>
      </div>

      <div className="mb-1 flex w-full items-center">
        <div className="min-w-[150px] pr-2 break-all">{t('common.fields.host')}</div>
        <div>{database.mysql?.host || ''}</div>
      </div>

      <div className="mb-1 flex w-full items-center">
        <div className="min-w-[150px] pr-2">{t('common.fields.port')}</div>
        <div>{database.mysql?.port || ''}</div>
      </div>

      <div className="mb-1 flex w-full items-center">
        <div className="min-w-[150px] pr-2">{t('common.fields.username')}</div>
        <div>{database.mysql?.username || ''}</div>
      </div>

      <div className="mb-1 flex w-full items-center">
        <div className="min-w-[150px] pr-2">{t('common.fields.password')}</div>
        <div>{'*************'}</div>
      </div>

      <div className="mb-1 flex w-full items-center">
        <div className="min-w-[150px] pr-2">{t('databases.fields.databaseName')}</div>
        <div>{database.mysql?.database || ''}</div>
      </div>

      <div className="mb-1 flex w-full items-center">
        <div className="min-w-[150px] pr-2">{t('databases.fields.useHttps')}</div>
        <div>{database.mysql?.isHttps ? t('common.answers.yes') : t('common.answers.no')}</div>
      </div>
      <ShowSshTunnelComponent sshTunnel={database.mysql?.sshTunnel} />

      {!!database.mysql?.excludeTables?.length && (
        <div className="mb-1 flex w-full items-center">
          <div className="min-w-[150px] pr-2">{t('databases.fields.excludeTables')}</div>
          <div>{database.mysql.excludeTables.join(', ')}</div>
        </div>
      )}
    </div>
  );
};
