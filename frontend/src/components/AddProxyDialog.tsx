import { useState, FormEvent, useEffect } from 'react';
import { Dialog, Button, TextInput, Alert, Select } from '@gravity-ui/uikit';
import { createProxy, createProxyTemplate, getProxyTemplates, NodeData, type ProxyTemplateRow } from '../api';

interface Props {
  open: boolean;
  onClose: () => void;
  nodeId?: number;
  nodes?: NodeData[];
  onCreated: () => void;
}

function numToStr(v: unknown): string {
  if (v == null || v === '') return '';
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'string') return v;
  return '';
}

function applyPresetToForm(
  preset: Record<string, unknown>,
  setters: {
    setDomain: (v: string) => void;
    setName: (v: string) => void;
    setNote: (v: string) => void;
    setMaxConnections: (v: string) => void;
    setListenPort: (v: string) => void;
    setVpnSubscription: (v: string) => void;
  }
) {
  if (typeof preset.domain === 'string') setters.setDomain(preset.domain);
  if (typeof preset.name === 'string') setters.setName(preset.name);
  if (typeof preset.note === 'string') setters.setNote(preset.note);
  setters.setMaxConnections(numToStr(preset.maxConnections));
  setters.setListenPort(numToStr(preset.listenPort));
  if (preset.vpnSubscription === '' || preset.vpnSubscription === null) {
    setters.setVpnSubscription('');
  } else if (typeof preset.vpnSubscription === 'string') {
    setters.setVpnSubscription(preset.vpnSubscription);
  }
  if (preset.useVpn === false) {
    setters.setVpnSubscription('');
  }
}

export default function AddProxyDialog({ open, onClose, nodeId, nodes, onCreated }: Props) {
  const [selectedNodeId, setSelectedNodeId] = useState<string>(nodeId ? nodeId.toString() : '');
  const [domain, setDomain] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [maxConnections, setMaxConnections] = useState('');
  const [listenPort, setListenPort] = useState('');
  const [vpnSubscription, setVpnSubscription] = useState('');
  const [templateId, setTemplateId] = useState<string>('');
  const [templates, setTemplates] = useState<ProxyTemplateRow[]>([]);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    getProxyTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, [open]);

  useEffect(() => {
    if (!templateId) return;
    const t = templates.find((x) => String(x.id) === templateId);
    if (!t?.preset || typeof t.preset !== 'object') return;
    applyPresetToForm(t.preset as Record<string, unknown>, {
      setDomain,
      setName,
      setNote,
      setMaxConnections,
      setListenPort,
      setVpnSubscription,
    });
  }, [templateId, templates]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const targetNodeId = nodeId || parseInt(selectedNodeId, 10);
    if (!targetNodeId) {
      setError('Выберите ноду');
      return;
    }

    setLoading(true);

    try {
      await createProxy(targetNodeId, {
        domain: domain || undefined,
        name: name || undefined,
        note: note || undefined,
        maxConnections: maxConnections ? parseInt(maxConnections, 10) : undefined,
        listenPort: listenPort ? parseInt(listenPort, 10) : undefined,
        vpnSubscription: vpnSubscription || undefined,
      });
      setDomain('');
      setName('');
      setNote('');
      setMaxConnections('');
      setListenPort('');
      setVpnSubscription('');
      setTemplateId('');
      setSaveTemplateName('');
      setSelectedNodeId(nodeId ? nodeId.toString() : '');
      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    const n = saveTemplateName.trim();
    if (!n) {
      setError('Укажите имя шаблона');
      return;
    }
    setSavingTemplate(true);
    setError('');
    try {
      const preset: Record<string, unknown> = {
        domain: domain || undefined,
        name: name || undefined,
        note: note || undefined,
        maxConnections: maxConnections ? parseInt(maxConnections, 10) : undefined,
        listenPort: listenPort ? parseInt(listenPort, 10) : undefined,
        vpnSubscription: vpnSubscription || undefined,
        useVpn: Boolean(vpnSubscription?.trim()),
      };
      const row = await createProxyTemplate(n, preset);
      setTemplates((prev) => [row, ...prev]);
      setSaveTemplateName('');
    } catch (err: any) {
      setError(err.message || 'Не удалось сохранить шаблон');
    } finally {
      setSavingTemplate(false);
    }
  };

  const templateOptions = [
    { value: '', content: 'Без шаблона' },
    ...templates.map((t) => ({ value: String(t.id), content: t.name })),
  ];

  return (
    <Dialog open={open} onClose={onClose} size="m">
      <Dialog.Header caption="Добавить прокси" />
      <Dialog.Body>
        <form onSubmit={handleSubmit} id="add-proxy-form">
          {error && (
            <div style={{ marginBottom: 16 }}>
              <Alert theme="danger" message={error} />
            </div>
          )}
          {!nodeId && nodes && (
            <div className="dialog-field">
              <label>Нода *</label>
              <Select
                value={selectedNodeId ? [selectedNodeId] : []}
                onUpdate={(val) => setSelectedNodeId(val[0] || '')}
                placeholder="Выберите ноду"
                width="max"
                options={nodes.map((n) => ({ value: n.id.toString(), content: `${n.name} (${n.ip})` }))}
              />
            </div>
          )}
          <div className="dialog-field">
            <label>Шаблон (пресет)</label>
            <Select
              value={templateId ? [templateId] : ['']}
              onUpdate={(val) => setTemplateId(val[0] ?? '')}
              placeholder="Выберите шаблон"
              width="max"
              options={templateOptions}
            />
            <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--g-color-text-secondary)' }}>
              Подставляет лимиты, порт, VPN и поля из сохранённого пресета. Шаблоны можно удалить в «Настройки».
            </p>
          </div>
          <div className="dialog-field">
            <label>Название (необязательно)</label>
            <TextInput value={name} onUpdate={setName} placeholder="Мой прокси" size="l" />
          </div>
          <div className="dialog-field">
            <label>Заметка (необязательно)</label>
            <TextInput value={note} onUpdate={setNote} placeholder="Описание" size="l" />
          </div>
          <div className="dialog-field">
            <label>Fake TLS домен (необязательно, из пула)</label>
            <TextInput value={domain} onUpdate={setDomain} placeholder="напр. www.google.com" size="l" />
          </div>
          <div className="dialog-field">
            <label>Лимит подключений (0 = без лимита)</label>
            <TextInput value={maxConnections} onUpdate={setMaxConnections} placeholder="0" size="l" type="number" />
          </div>
          <div className="dialog-field">
            <label>Собственный порт прослушивания (пусто = SNI на 443)</label>
            <TextInput value={listenPort} onUpdate={setListenPort} placeholder="напр. 8443" size="l" type="number" />
          </div>
          <div className="dialog-field">
            <label>VPN подписка — VLESS URL (необязательно)</label>
            <TextInput value={vpnSubscription} onUpdate={setVpnSubscription} placeholder="https://..." size="l" />
          </div>
          <div className="dialog-field" style={{ borderTop: '1px solid var(--g-color-line-generic)', paddingTop: 12 }}>
            <label>Сохранить текущие поля как шаблон</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextInput
                value={saveTemplateName}
                onUpdate={setSaveTemplateName}
                placeholder="Имя шаблона"
                size="l"
              />
              <Button type="button" view="outlined" loading={savingTemplate} onClick={handleSaveTemplate}>
                Сохранить шаблон
              </Button>
            </div>
          </div>
        </form>
      </Dialog.Body>
      <Dialog.Footer
        onClickButtonApply={handleSubmit as any}
        onClickButtonCancel={onClose}
        textButtonApply="Создать"
        textButtonCancel="Отмена"
        loading={loading}
      />
    </Dialog>
  );
}
