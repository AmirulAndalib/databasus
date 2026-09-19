import { useTranslation } from 'react-i18next';

import { type Database } from '../../../../entity/databases';
import { ShowSshTunnelComponent } from './ShowSshTunnelComponent';

interface Props {
  database: Database;
}

export const ShowMongoDbSpecificDataComponent = ({ database }: Props) => {
  const { t } = useTranslation();

  return (
    <div>
      <div className="mb-1 flex w-full items-center">
        <div className="min-w-[150px] pr-2 break-all">{t('common.fields.host')}</div>
        <div>{database.mongodb?.host || ''}</div>
      </div>

      <div className="mb-1 flex w-full items-center">
        <div className="min-w-[150px] pr-2">{t('common.fields.port')}</div>
        <div>{database.mongodb?.port || ''}</div>
      </div>

      <div className="mb-1 flex w-full items-center">
        <div className="min-w-[150px] pr-2">{t('common.fields.username')}</div>
        <div>{database.mongodb?.username || ''}</div>
      </div>

      <div className="mb-1 flex w-full items-center">
        <div className="min-w-[150px] pr-2">{t('common.fields.password')}</div>
        <div>{'*************'}</div>
      </div>

      <div className="mb-1 flex w-full items-center">
        <div className="min-w-[150px] pr-2">{t('databases.fields.databaseName')}</div>
        <div>{database.mongodb?.database || ''}</div>
      </div>

      <div className="mb-1 flex w-full items-center">
        <div className="min-w-[150px] pr-2">{t('databases.fields.useHttps')}</div>
        <div>{database.mongodb?.isHttps ? t('common.answers.yes') : t('common.answers.no')}</div>
      </div>
      <ShowSshTunnelComponent sshTunnel={database.mongodb?.sshTunnel} />

      <div className="mb-1 flex w-full items-center">
        <div className="min-w-[150px] pr-2">{t('databases.fields.cpuCount')}</div>
        <div>{database.mongodb?.cpuCount}</div>
      </div>

      {database.mongodb?.isDirectConnection && (
        <div className="mb-1 flex w-full items-center">
          <div className="min-w-[150px] pr-2">{t('databases.fields.directConnection')}</div>
          <div>{t('common.answers.yes')}</div>
        </div>
      )}

      {database.mongodb?.authDatabase && (
        <div className="mb-1 flex w-full items-center">
          <div className="min-w-[150px] pr-2">{t('databases.fields.authDatabase')}</div>
          <div>{database.mongodb.authDatabase}</div>
        </div>
      )}

      {!!database.mongodb?.excludeCollections?.length && (
        <div className="mb-1 flex w-full items-center">
          <div className="min-w-[150px] pr-2">{t('databases.fields.excludeCollections')}</div>
          <div>{database.mongodb.excludeCollections.join(', ')}</div>
        </div>
      )}
    </div>
  );
};
