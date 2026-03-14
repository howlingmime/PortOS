import { useState, useEffect } from 'react';
import { Save, Plus, X, Eye, EyeOff, Trash2, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import BrailleSpinner from '../components/BrailleSpinner';
import { getSettings, updateSettings, getTelegramStatus, updateTelegramConfig, deleteTelegramConfig, testTelegram, updateTelegramForwardTypes } from '../services/api';

const NOTIFICATION_TYPES = [
  { key: 'memory_approval', label: 'Memory Approvals' },
  { key: 'task_approval', label: 'Task Approvals' },
  { key: 'code_review', label: 'Code Reviews' },
  { key: 'health_issue', label: 'Health Issues' },
  { key: 'briefing_ready', label: 'Briefings' },
  { key: 'autobiography_prompt', label: 'Autobiography Prompts' },
  { key: 'plan_question', label: 'Plan Questions' }
];

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [destPath, setDestPath] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [cronExpression, setCronExpression] = useState('0 2 * * *');
  const [excludePaths, setExcludePaths] = useState([]);
  const [newExclude, setNewExclude] = useState('');

  // Telegram state
  const [tgToken, setTgToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  const [tgShowToken, setTgShowToken] = useState(false);
  const [tgStatus, setTgStatus] = useState(null);
  const [tgSaving, setTgSaving] = useState(false);
  const [tgTesting, setTgTesting] = useState(false);
  const [tgDisconnecting, setTgDisconnecting] = useState(false);
  const [tgForwardTypes, setTgForwardTypes] = useState([]);

  useEffect(() => {
    Promise.all([
      getSettings(),
      getTelegramStatus().catch(() => null)
    ]).then(([settings, status]) => {
      const backup = settings?.backup || {};
      setDestPath(backup.destPath || '');
      setEnabled(backup.enabled ?? false);
      setCronExpression(backup.cronExpression || '0 2 * * *');
      setExcludePaths(backup.excludePaths || []);

      if (status) {
        setTgStatus(status);
        setTgChatId(settings?.telegram?.chatId || '');
        setTgForwardTypes(status.forwardTypes || []);
      }
    }).catch(() => toast.error('Failed to load settings')).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await updateSettings({ backup: { destPath, enabled, cronExpression, excludePaths } })
      .then(() => toast.success('Settings saved'))
      .catch(() => toast.error('Failed to save settings'))
      .finally(() => setSaving(false));
  };

  const addExclude = () => {
    const trimmed = newExclude.trim();
    if (!trimmed || excludePaths.includes(trimmed)) return;
    setExcludePaths([...excludePaths, trimmed]);
    setNewExclude('');
  };

  const removeExclude = (index) => {
    setExcludePaths(excludePaths.filter((_, i) => i !== index));
  };

  const handleTelegramSave = () => {
    if (!tgToken && !tgStatus?.hasToken) {
      toast.error('Bot token is required');
      return;
    }
    setTgSaving(true);
    updateTelegramConfig({ token: tgToken, chatId: tgChatId })
      .then(status => {
        setTgStatus(status);
        toast.success(tgChatId
          ? 'Telegram connected — check your chat for a test message'
          : 'Bot connected — now message your bot /start to get your Chat ID');
      })
      .catch(() => toast.error('Failed to configure Telegram'))
      .finally(() => setTgSaving(false));
  };

  const handleTelegramTest = () => {
    setTgTesting(true);
    testTelegram()
      .then(() => toast.success('Test message sent'))
      .catch(() => toast.error('Failed to send test message'))
      .finally(() => setTgTesting(false));
  };

  const handleTelegramDisconnect = () => {
    setTgDisconnecting(true);
    deleteTelegramConfig()
      .then(() => {
        setTgStatus(null);
        setTgToken('');
        setTgChatId('');
        setTgForwardTypes([]);
        toast.success('Telegram disconnected');
      })
      .catch(() => toast.error('Failed to disconnect'))
      .finally(() => setTgDisconnecting(false));
  };

  const toggleForwardType = (type) => {
    const updated = tgForwardTypes.includes(type)
      ? tgForwardTypes.filter(t => t !== type)
      : [...tgForwardTypes, type];
    setTgForwardTypes(updated);
    updateTelegramForwardTypes(updated).catch(() => toast.error('Failed to update forward types'));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <BrailleSpinner text="Loading settings" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      <div className="bg-port-card border border-port-border rounded-xl p-6 space-y-5">
        <h2 className="text-lg font-semibold text-white">Backup</h2>

        <div className="space-y-1">
          <label className="block text-sm text-gray-400">Destination Path</label>
          <input
            type="text"
            value={destPath}
            onChange={e => setDestPath(e.target.value)}
            className="w-full bg-port-bg border border-port-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-port-accent"
            placeholder="/path/to/backups"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-400">Enabled</label>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-port-accent' : 'bg-port-border'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        <div className="space-y-1">
          <label className="block text-sm text-gray-400">Schedule (cron)</label>
          <input
            type="text"
            value={cronExpression}
            onChange={e => setCronExpression(e.target.value)}
            className="w-full bg-port-bg border border-port-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-port-accent"
            placeholder="0 2 * * *"
          />
          <p className="text-xs text-gray-500">Default: 2:00 AM daily</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-gray-400">Exclude Paths</label>
          <p className="text-xs text-gray-500">Directories/patterns to skip during backup (relative to data/)</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newExclude}
              onChange={e => setNewExclude(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addExclude()}
              className="flex-1 bg-port-bg border border-port-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-port-accent"
              placeholder="repos/"
            />
            <button
              onClick={addExclude}
              disabled={!newExclude.trim()}
              className="px-3 py-2 bg-port-border hover:bg-port-border/70 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <Plus size={16} />
            </button>
          </div>
          {excludePaths.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {excludePaths.map((path, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-port-bg border border-port-border rounded-lg text-sm text-gray-300">
                  <code className="text-xs">{path}</code>
                  <button onClick={() => removeExclude(i)} className="text-gray-500 hover:text-port-error transition-colors">
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-port-accent hover:bg-port-accent/80 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? <BrailleSpinner /> : <Save size={16} />}
          Save
        </button>
      </div>

      {/* Telegram */}
      <div className="bg-port-card border border-port-border rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Telegram</h2>
          {tgStatus?.connected && (
            <span className="flex items-center gap-2 text-sm text-port-success">
              <span className="w-2 h-2 rounded-full bg-port-success" />
              @{tgStatus.botUsername}
            </span>
          )}
          {tgStatus && !tgStatus.connected && tgStatus.hasToken && (
            <span className="flex items-center gap-2 text-sm text-port-error">
              <span className="w-2 h-2 rounded-full bg-port-error" />
              Disconnected
            </span>
          )}
        </div>

        <div className="space-y-1">
          <label className="block text-sm text-gray-400">Bot Token</label>
          <div className="flex gap-2">
            <input
              type={tgShowToken ? 'text' : 'password'}
              value={tgToken}
              onChange={e => setTgToken(e.target.value)}
              className="flex-1 bg-port-bg border border-port-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-port-accent"
              placeholder={tgStatus?.hasToken ? '••••••••••• (configured)' : 'Paste bot token from @BotFather'}
            />
            <button
              onClick={() => setTgShowToken(!tgShowToken)}
              className="px-3 py-2 bg-port-border hover:bg-port-border/70 text-white rounded-lg transition-colors"
            >
              {tgShowToken ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm text-gray-400">Chat ID</label>
          <input
            type="text"
            value={tgChatId}
            onChange={e => setTgChatId(e.target.value)}
            className="w-full bg-port-bg border border-port-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-port-accent"
            placeholder="Message your bot /start to get your chat ID"
          />
        </div>

        <p className="text-xs text-gray-500">
          1. Message <code>@BotFather</code> on Telegram, send <code>/newbot</code>, copy the token, paste above, click Save.
          2. Message your bot <code>/start</code> — it will reply with your Chat ID.
          3. Paste the Chat ID above and click Save & Test.
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={handleTelegramSave}
            disabled={tgSaving || (!tgToken && !tgStatus?.hasToken)}
            className="flex items-center gap-2 px-4 py-2 bg-port-accent hover:bg-port-accent/80 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {tgSaving ? <BrailleSpinner /> : <Save size={16} />}
            {tgStatus?.connected && tgChatId ? 'Save & Test' : 'Save'}
          </button>
          {tgStatus?.connected && (
            <button
              onClick={handleTelegramTest}
              disabled={tgTesting}
              className="flex items-center gap-2 px-4 py-2 bg-port-border hover:bg-port-border/70 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {tgTesting ? <BrailleSpinner /> : <Send size={16} />}
              Send Test
            </button>
          )}
          {(tgStatus?.hasToken || tgStatus?.hasChatId) && (
            <button
              onClick={handleTelegramDisconnect}
              disabled={tgDisconnecting}
              className="flex items-center gap-2 px-4 py-2 bg-port-error/20 hover:bg-port-error/30 text-port-error text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {tgDisconnecting ? <BrailleSpinner /> : <Trash2 size={16} />}
              Disconnect
            </button>
          )}
        </div>

        {/* Notification type toggles */}
        {tgStatus?.connected && (
          <div className="space-y-2 pt-2 border-t border-port-border">
            <label className="block text-sm text-gray-400">Forward Notification Types</label>
            <p className="text-xs text-gray-500">When all are unchecked, all types are forwarded</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {NOTIFICATION_TYPES.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tgForwardTypes.includes(key)}
                    onChange={() => toggleForwardType(key)}
                    className="rounded border-port-border bg-port-bg text-port-accent focus:ring-port-accent"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
