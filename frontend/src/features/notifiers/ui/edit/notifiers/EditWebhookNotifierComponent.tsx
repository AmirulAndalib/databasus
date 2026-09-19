import { DeleteOutlined, InfoCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Input, Select, Tooltip } from 'antd';
import { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import type { Notifier, WebhookHeader } from '../../../../../entity/notifiers';
import {
  NOTIFICATION_TYPE_LABEL_KEYS,
  NotificationType,
  WebhookMethod,
} from '../../../../../entity/notifiers';
import type { TranslationKey } from '../../../../../shared/i18n';
import { DEFAULT_ACCEPT_NOTIFICATION_TYPES } from '../../../lib/defaultAcceptNotificationTypes';
import {
  EXAMPLE_GET_QUERY,
  getExamplePostBody,
  getExamplePostHeaderLines,
} from '../../../lib/webhookExampleRequest';

interface Props {
  notifier: Notifier;
  setNotifier: (notifier: Notifier) => void;
  setUnsaved: () => void;
}

// eslint-disable-next-line i18next/no-literal-string -- JSON template with the backend's variables
const DEFAULT_BODY_TEMPLATE = `{
  "heading": "{{heading}}",
  "message": "{{message}}"
}`;

function validateJsonTemplate(template: string): TranslationKey | null {
  if (!template.trim()) {
    return null; // Empty is valid (will use default)
  }

  // Replace placeholders with valid JSON strings before parsing
  const testJson = template.replace(/\{\{heading\}\}/g, 'test').replace(/\{\{message\}\}/g, 'test');

  try {
    JSON.parse(testJson);
    return null;
  } catch (e) {
    if (e instanceof SyntaxError) {
      return 'notifiers.webhook.bodyTemplate.invalidJsonFormat';
    }
    return 'notifiers.webhook.bodyTemplate.invalidJson';
  }
}

export function EditWebhookNotifierComponent({ notifier, setNotifier, setUnsaved }: Props) {
  const { t } = useTranslation();
  const headers = notifier?.webhookNotifier?.headers || [];
  const bodyTemplate = notifier?.webhookNotifier?.bodyTemplate || '';

  const jsonErrorKey = useMemo(() => validateJsonTemplate(bodyTemplate), [bodyTemplate]);

  const acceptNotificationTypes =
    notifier?.webhookNotifier?.acceptNotificationTypes || DEFAULT_ACCEPT_NOTIFICATION_TYPES;

  const updateWebhookNotifier = (updates: Partial<typeof notifier.webhookNotifier>) => {
    setNotifier({
      ...notifier,
      webhookNotifier: {
        ...(notifier.webhookNotifier || {
          webhookUrl: '',
          webhookMethod: WebhookMethod.POST,
          acceptNotificationTypes: [...DEFAULT_ACCEPT_NOTIFICATION_TYPES],
        }),
        ...updates,
      },
    });
    setUnsaved();
  };

  const changeAcceptNotificationTypes = (selected: NotificationType[]) => {
    const isAllSelected =
      selected.length === 0 || selected[selected.length - 1] === NotificationType.ALL;
    updateWebhookNotifier({
      acceptNotificationTypes: isAllSelected
        ? [NotificationType.ALL]
        : selected.filter((type) => type !== NotificationType.ALL),
    });
  };

  const addHeader = () => {
    updateWebhookNotifier({
      headers: [...headers, { key: '', value: '' }],
    });
  };

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const newHeaders = [...headers];
    newHeaders[index] = { ...newHeaders[index], [field]: value };
    updateWebhookNotifier({ headers: newHeaders });
  };

  const removeHeader = (index: number) => {
    const newHeaders = headers.filter((_, i) => i !== index);
    updateWebhookNotifier({ headers: newHeaders });
  };

  return (
    <>
      <div className="mb-1 flex w-full flex-col items-start sm:flex-row sm:items-center">
        <div className="mb-1 min-w-[150px] sm:mb-0 sm:pr-2">{t('notifiers.fields.webhookUrl')}</div>
        <Input
          value={notifier?.webhookNotifier?.webhookUrl || ''}
          onChange={(e) => {
            updateWebhookNotifier({ webhookUrl: e.target.value.trim() });
          }}
          size="small"
          className="w-full max-w-[250px]"
          placeholder="https://example.com/webhook"
        />
      </div>

      <div className="mt-1 mb-1 flex w-full flex-col items-start sm:flex-row sm:items-center">
        <div className="mb-1 min-w-[150px] sm:mb-0 sm:pr-2">{t('notifiers.webhook.method')}</div>
        <div className="flex items-center">
          <Select
            value={notifier?.webhookNotifier?.webhookMethod || WebhookMethod.POST}
            onChange={(value) => {
              updateWebhookNotifier({ webhookMethod: value });
            }}
            size="small"
            className="w-[100px] max-w-[250px]"
            options={[
              { value: WebhookMethod.POST, label: WebhookMethod.POST },
              { value: WebhookMethod.GET, label: WebhookMethod.GET },
            ]}
          />
        </div>
      </div>

      <div className="mt-1 mb-1 flex w-full flex-col items-start sm:flex-row sm:items-center">
        <div className="mb-1 min-w-[150px] sm:mb-0 sm:pr-2">{t('notifiers.webhook.sendOn')}</div>
        <Select
          mode="multiple"
          value={acceptNotificationTypes}
          onChange={(value) => changeAcceptNotificationTypes(value as NotificationType[])}
          size="small"
          className="w-full max-w-[250px]"
          options={Object.values(NotificationType).map((type) => ({
            label: t(NOTIFICATION_TYPE_LABEL_KEYS[type]),
            value: type,
          }))}
          placeholder={t('notifiers.webhook.sendOnPlaceholder')}
        />
      </div>

      <div className="mt-3 mb-1 flex w-full flex-col items-start">
        <div className="mb-1 flex items-center">
          <span className="min-w-[150px] pr-2">
            {t('notifiers.webhook.customHeaders')}{' '}
            <Tooltip title={t('notifiers.webhook.customHeadersTooltip')}>
              <InfoCircleOutlined className="ml-1" style={{ color: 'gray' }} />
            </Tooltip>
          </span>
        </div>

        {notifier.id && (
          <div className="mb-1 text-xs text-orange-700">
            {t('notifiers.webhook.savedHeadersHidden')}
          </div>
        )}

        <div className="w-full max-w-[500px]">
          {headers.map((header: WebhookHeader, index: number) => (
            <div key={index} className="mb-1 flex items-center gap-2">
              <Input
                value={header.key}
                onChange={(e) => updateHeader(index, 'key', e.target.value)}
                size="small"
                style={{ width: 150, flexShrink: 0 }}
                placeholder={t('notifiers.webhook.headerNamePlaceholder')}
              />
              <Input
                value={header.value}
                onChange={(e) => updateHeader(index, 'value', e.target.value)}
                size="small"
                style={{ flex: 1, minWidth: 0 }}
                placeholder={t('notifiers.webhook.headerValuePlaceholder')}
              />
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => removeHeader(index)}
              />
            </div>
          ))}

          <Button
            type="dashed"
            size="small"
            icon={<PlusOutlined />}
            onClick={addHeader}
            className="mt-1"
          >
            {t('notifiers.webhook.addHeader')}
          </Button>
        </div>
      </div>

      {notifier?.webhookNotifier?.webhookMethod === WebhookMethod.POST && (
        <div className="mt-3 mb-1 flex w-full flex-col items-start">
          <div className="mb-1 flex items-center">
            <span className="min-w-[150px] pr-2">{t('notifiers.webhook.bodyTemplate.title')}</span>
          </div>

          <div className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="mr-4">
              <Trans
                i18nKey="notifiers.webhook.bodyTemplate.headingVariable"
                components={{
                  variable: (
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-700">
                      {'{{heading}}'}
                    </code>
                  ),
                }}
              />
            </span>
            <span>
              <Trans
                i18nKey="notifiers.webhook.bodyTemplate.messageVariable"
                components={{
                  variable: (
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-700">
                      {'{{message}}'}
                    </code>
                  ),
                }}
              />
            </span>
          </div>

          <Input.TextArea
            value={bodyTemplate}
            onChange={(e) => {
              updateWebhookNotifier({ bodyTemplate: e.target.value });
            }}
            className="w-full max-w-[500px] font-mono text-xs"
            rows={6}
            placeholder={DEFAULT_BODY_TEMPLATE}
            status={jsonErrorKey ? 'error' : undefined}
          />
          {jsonErrorKey && <div className="mt-1 text-xs text-red-500">{t(jsonErrorKey)}</div>}
        </div>
      )}

      {notifier?.webhookNotifier?.webhookUrl && (
        <div className="mt-4">
          <div className="mb-1 font-medium">{t('notifiers.webhook.exampleRequest.title')}</div>

          {notifier?.webhookNotifier?.webhookMethod === WebhookMethod.GET && (
            <div className="rounded bg-gray-100 p-2 px-3 text-sm break-all dark:bg-gray-800">
              <div className="font-semibold text-blue-600 dark:text-blue-400">GET</div>
              <div className="mt-1">
                {notifier?.webhookNotifier?.webhookUrl}
                {EXAMPLE_GET_QUERY}
              </div>
              {headers.length > 0 && (
                <div className="mt-2 border-t border-gray-200 pt-2 dark:border-gray-600">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    {t('notifiers.webhook.exampleRequest.headers')}
                  </div>

                  {headers
                    .filter((h) => h.key)
                    .map((h, i) => (
                      <div key={i} className="text-xs">
                        {h.key}: {h.value || t('notifiers.webhook.hiddenHeaderValue')}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {notifier?.webhookNotifier?.webhookMethod === WebhookMethod.POST && (
            <div className="rounded bg-gray-100 p-2 px-3 font-mono text-sm break-words whitespace-pre-wrap dark:bg-gray-800">
              <div className="font-semibold text-blue-600 dark:text-blue-400">
                POST {notifier?.webhookNotifier?.webhookUrl}
              </div>
              <div className="mt-1 text-gray-600 dark:text-gray-400">
                {getExamplePostHeaderLines(headers)}
              </div>
              <div className="mt-2 break-words whitespace-pre-wrap">
                {getExamplePostBody(notifier?.webhookNotifier?.bodyTemplate)}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
