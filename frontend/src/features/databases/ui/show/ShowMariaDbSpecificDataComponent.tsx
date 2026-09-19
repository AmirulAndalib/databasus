import { useTranslation } from 'react-i18next';

import {
  DATABASE_TYPE_LABEL_KEYS,
  type Database,
  DatabaseType,
  MariadbVersion,
} from '../../../../entity/databases';
import { ShowSshTunnelComponent } from './ShowSshTunnelComponent';

interface Props {
  database: Database;
}

const mariadbVersionLabels: Record<MariadbVersion, string> = {
  [MariadbVersion.MariadbVersion55]: '5.5',
  [MariadbVersion.MariadbVersion101]: '10.1',
  [MariadbVersion.MariadbVersion102]: '10.2',
  [MariadbVersion.MariadbVersion103]: '10.3',
  [MariadbVersion.MariadbVersion104]: '10.4',
  [MariadbVersion.MariadbVersion105]: '10.5',
  [MariadbVersion.MariadbVersion106]: '10.6',
  [MariadbVersion.MariadbVersion1011]: '10.11',
  [MariadbVersion.MariadbVersion114]: '11.4',
  [MariadbVersion.MariadbVersion118]: '11.8',
  [MariadbVersion.MariadbVersion120]: '12.0',
};

export const ShowMariaDbSpecificDataComponent = ({ database }: Props) => {
  const { t } = useTranslation();

  return (
    <div>
      <div className="mb-1 flex w-full items-center">
        <div className="min-w-[150px] pr-2">
          {t('databases.fields.version', {
            engine: t(DATABASE_TYPE_LABEL_KEYS[DatabaseType.MARIADB]),
          })}
        </div>
        <div>{database.mariadb?.version ? mariadbVersionLabels[database.mariadb.version] : ''}</div>
      </div>

      <div className="mb-1 flex w-full items-center">
        <div className="min-w-[150px] pr-2 break-all">{t('common.fields.host')}</div>
        <div>{database.mariadb?.host || ''}</div>
      </div>

      <div className="mb-1 flex w-full items-center">
        <div className="min-w-[150px] pr-2">{t('common.fields.port')}</div>
        <div>{database.mariadb?.port || ''}</div>
      </div>

      <div className="mb-1 flex w-full items-center">
        <div className="min-w-[150px] pr-2">{t('common.fields.username')}</div>
        <div>{database.mariadb?.username || ''}</div>
      </div>

      <div className="mb-1 flex w-full items-center">
        <div className="min-w-[150px] pr-2">{t('common.fields.password')}</div>
        <div>{'*************'}</div>
      </div>

      <div className="mb-1 flex w-full items-center">
        <div className="min-w-[150px] pr-2">{t('databases.fields.databaseName')}</div>
        <div>{database.mariadb?.database || ''}</div>
      </div>

      <div className="mb-1 flex w-full items-center">
        <div className="min-w-[150px] pr-2">{t('databases.fields.useHttps')}</div>
        <div>{database.mariadb?.isHttps ? t('common.answers.yes') : t('common.answers.no')}</div>
      </div>
      <ShowSshTunnelComponent sshTunnel={database.mariadb?.sshTunnel} />

      {database.mariadb?.isExcludeEvents && (
        <div className="mb-1 flex w-full items-center">
          <div className="min-w-[150px] pr-2">{t('databases.fields.excludeEvents')}</div>
          <div>{t('common.answers.yes')}</div>
        </div>
      )}

      {database.mariadb?.isSkipGaleraDisable && (
        <div className="mb-1 flex w-full items-center">
          <div className="min-w-[150px] pr-2">{t('databases.fields.galeraReplication')}</div>
          <div>{t('databases.show.galeraDisableSkipped')}</div>
        </div>
      )}

      {!!database.mariadb?.excludeTables?.length && (
        <div className="mb-1 flex w-full items-center">
          <div className="min-w-[150px] pr-2">{t('databases.fields.excludeTables')}</div>
          <div>{database.mariadb.excludeTables.join(', ')}</div>
        </div>
      )}
    </div>
  );
};
