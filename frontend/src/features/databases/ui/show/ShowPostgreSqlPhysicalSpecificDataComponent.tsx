import { useTranslation } from 'react-i18next';

import {
  type Database,
  PHYSICAL_DATABASE_BACKUP_TYPE_LABEL_KEYS,
  POSTGRESQL_SHORT_NAME,
  POSTGRES_SSL_MODE_LABEL_KEYS,
  PostgresSslMode,
  PostgresqlVersion,
} from '../../../../entity/databases';
import { ShowSshTunnelComponent } from './ShowSshTunnelComponent';

interface Props {
  database: Database;
}

const postgresqlVersionLabels: Record<string, string> = {
  [PostgresqlVersion.PostgresqlVersion12]: '12',
  [PostgresqlVersion.PostgresqlVersion13]: '13',
  [PostgresqlVersion.PostgresqlVersion14]: '14',
  [PostgresqlVersion.PostgresqlVersion15]: '15',
  [PostgresqlVersion.PostgresqlVersion16]: '16',
  [PostgresqlVersion.PostgresqlVersion17]: '17',
  [PostgresqlVersion.PostgresqlVersion18]: '18',
};

export const ShowPostgreSqlPhysicalSpecificDataComponent = ({ database }: Props) => {
  const { t } = useTranslation();

  return (
    <div>
      <div className="mb-1 flex w-full items-center">
        <div className="min-w-[150px] pr-2">
          {t('databases.fields.version', { engine: POSTGRESQL_SHORT_NAME })}
        </div>
        <div>
          {database.postgresqlPhysical?.version
            ? postgresqlVersionLabels[database.postgresqlPhysical.version]
            : ''}
        </div>
      </div>

      <div className="mb-1 flex w-full items-center">
        <div className="min-w-[150px] pr-2">{t('databases.fields.backupType')}</div>
        <div>
          {database.postgresqlPhysical?.backupType
            ? t(PHYSICAL_DATABASE_BACKUP_TYPE_LABEL_KEYS[database.postgresqlPhysical.backupType])
            : ''}
        </div>
      </div>

      <div className="mb-1 flex w-full items-center">
        <div className="min-w-[150px] pr-2 break-all">{t('common.fields.host')}</div>
        <div>{database.postgresqlPhysical?.host || ''}</div>
      </div>

      <div className="mb-1 flex w-full items-center">
        <div className="min-w-[150px] pr-2">{t('common.fields.port')}</div>
        <div>{database.postgresqlPhysical?.port || ''}</div>
      </div>

      <div className="mb-1 flex w-full items-center">
        <div className="min-w-[150px] pr-2">{t('common.fields.username')}</div>
        <div>{database.postgresqlPhysical?.username || ''}</div>
      </div>

      <div className="mb-1 flex w-full items-center">
        <div className="min-w-[150px] pr-2">{t('common.fields.password')}</div>
        <div>{'*************'}</div>
      </div>

      <div className="mb-1 flex w-full items-center">
        <div className="min-w-[150px] pr-2">{t('databases.fields.sslMode')}</div>
        <div>
          {t(
            POSTGRES_SSL_MODE_LABEL_KEYS[
              database.postgresqlPhysical?.sslMode ?? PostgresSslMode.Disable
            ],
          )}
        </div>
      </div>

      {!!database.postgresqlPhysical?.sslClientCert &&
        database.postgresqlPhysical?.sslMode !== PostgresSslMode.Disable && (
          <div className="mb-1 flex w-full items-center">
            <div className="min-w-[150px] pr-2">{t('databases.fields.clientCertificate')}</div>
            <div>*************</div>
          </div>
        )}

      <ShowSshTunnelComponent sshTunnel={database.postgresqlPhysical?.sshTunnel} />
    </div>
  );
};
