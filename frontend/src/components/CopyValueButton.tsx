import { useState } from 'react';
import { Button } from '@gravity-ui/uikit';
import { Copy } from '@gravity-ui/icons';
import { copyToClipboard } from '../utils/clipboard';

type Props = {
  value: string;
  disabled?: boolean;
  title?: string;
};

export default function CopyValueButton({ value, disabled, title = 'Копировать' }: Props) {
  const [done, setDone] = useState(false);

  const handle = async () => {
    if (!value || disabled) return;
    await copyToClipboard(value);
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  };

  return (
    <Button size="s" view="flat-secondary" title={title} onClick={handle} disabled={disabled || !value}>
      {done ? '✓' : <Copy width={16} height={16} />}
    </Button>
  );
}
