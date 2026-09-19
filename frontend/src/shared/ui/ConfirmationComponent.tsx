import { Button, Modal } from 'antd';
import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  onConfirm(): void;
  onDecline(): void;

  // Rendered as React content, never as HTML: a sentence with inline markup is a Trans element.
  description: ReactNode;
  actionButtonColor: 'blue' | 'red';

  actionText: string;
  cancelText?: string;
  hideCancelButton?: boolean;
}

export function ConfirmationComponent({
  onConfirm,
  onDecline,
  description,
  actionButtonColor,
  actionText,
  cancelText,
  hideCancelButton = false,
}: Props): JSX.Element {
  const { t } = useTranslation();

  return (
    <Modal
      title={t('common.confirmation.title')}
      open
      onCancel={() => onDecline()}
      footer={<div />}
    >
      <div>{description}</div>

      <div className="mt-5 flex">
        {!hideCancelButton && (
          <Button
            className="ml-auto"
            onClick={() => onDecline()}
            danger={actionButtonColor !== 'red'}
            type="primary"
          >
            {cancelText || t('common.actions.cancel')}
          </Button>
        )}

        <Button
          className="ml-1"
          onClick={() => onConfirm()}
          danger={actionButtonColor === 'red'}
          type="primary"
        >
          {actionText}
        </Button>
      </div>
    </Modal>
  );
}
