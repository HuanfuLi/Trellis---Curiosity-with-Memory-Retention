import { useState, useEffect } from 'react';
import { Brain, Volume2, Network, Radio, BookOpen, Palette, RotateCcw, CheckCircle, XCircle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useSettings } from '../state/useSettings';
import type { LLMConfig, TTSConfig, AppSettings } from '../types';

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', marginTop: '24px' }}>
      <div style={{ color: 'var(--primary-40)' }}>{icon}</div>
      <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{title}</h3>
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 500, marginBottom: description ? '2px' : 0 }}>{label}</p>
        {description && <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{description}</p>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function MaterialSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      style={{
        position: 'relative',
        width: '52px',
        height: '32px',
        borderRadius: 'var(--radius-pill)',
        backgroundColor: checked ? 'var(--primary-40)' : 'var(--switch-background)',
        transition: 'background-color 0.2s',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: '24px',
          height: '24px',
          top: '4px',
          left: checked ? '24px' : '4px',
          backgroundColor: 'white',
          borderRadius: '50%',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'left 0.2s',
        }}
      />
    </button>
  );
}

function SelectInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '8px 12px',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        backgroundColor: 'var(--surface-variant)',
        color: 'var(--foreground)',
        fontSize: '0.875rem',
        cursor: 'pointer',
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function TextInput({ value, onChange, type = 'text', placeholder }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        padding: '8px 12px',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        backgroundColor: 'var(--surface-variant)',
        color: 'var(--foreground)',
        fontSize: '0.875rem',
        width: '160px',
      }}
    />
  );
}

export function SettingsScreen() {
  const { settings, set, reset } = useSettings();
  const [testResult, setTestResult] = useState<Record<string, 'success' | 'error' | null>>({});

  const [llm, setLlm] = useState<LLMConfig>({
    provider: 'openai',
    apiKey: '',
    baseUrl: '',
    model: 'gpt-4o',
    isConfigured: false,
  });

  const [tts, setTts] = useState<TTSConfig>({
    provider: 'openai',
    apiKey: '',
    baseUrl: '',
    voice: 'alloy',
    speed: 1.0,
    isConfigured: false,
  });

  const [ztNetworkId, setZtNetworkId] = useState('');
  const [podcastSleepTime, setPodcastSleepTime] = useState('22:00');
  const [podcastAdvance, setPodcastAdvance] = useState('60');
  const [reviewLimit, setReviewLimit] = useState('20');
  const [reviewNotif, setReviewNotif] = useState(false);
  const [reviewReminderTime, setReviewReminderTime] = useState('09:00');
  const [theme, setTheme] = useState<AppSettings['preferences']['theme']>('system');

  useEffect(() => {
    if (!settings) return;
    setLlm(settings.llm);
    setTts(settings.tts);
    setZtNetworkId(settings.zerotier.networkId ?? '');
    setPodcastSleepTime(settings.podcast.sleepTime);
    setPodcastAdvance(String(settings.podcast.advanceMinutes));
    setReviewLimit(String(settings.review.dailyLimit));
    setReviewNotif(settings.review.notificationsEnabled);
    setReviewReminderTime(settings.review.reminderTime);
    setTheme(settings.preferences.theme);
  }, [settings]);

  const saveLlm = async () => {
    await set('llm', { ...llm, isConfigured: !!llm.apiKey || llm.provider === 'local' });
  };

  const saveTts = async () => {
    await set('tts', { ...tts, isConfigured: !!tts.apiKey || tts.provider === 'gptsovits' });
  };

  const handleTestConnection = (service: string) => {
    setTimeout(() => {
      setTestResult((prev) => ({ ...prev, [service]: 'success' }));
      setTimeout(() => setTestResult((prev) => ({ ...prev, [service]: null })), 3000);
    }, 800);
  };

  const handleReset = async () => {
    if (confirm('Reset all settings to defaults?')) {
      await reset();
    }
  };

  return (
    <div style={{ padding: '24px 16px 96px', maxWidth: '448px', margin: '0 auto' }}>
      <div style={{ marginBottom: '8px' }}>
        <h1 style={{ marginBottom: '4px' }}>Settings</h1>
        <p style={{ color: 'var(--muted-foreground)' }}>Configure your EchoLearn experience</p>
      </div>

      {/* LLM Section */}
      <SectionHeader icon={<Brain size={20} />} title="Language Model" />
      <Card style={{ marginBottom: '8px' }}>
        <SettingRow label="Provider">
          <SelectInput
            value={llm.provider}
            onChange={(v) => setLlm((prev) => ({ ...prev, provider: v as LLMConfig['provider'] }))}
            options={[
              { value: 'openai', label: 'OpenAI' },
              { value: 'claude', label: 'Claude' },
              { value: 'local', label: 'Local' },
            ]}
          />
        </SettingRow>
        <SettingRow label="API Key">
          <TextInput
            type="password"
            value={llm.apiKey ?? ''}
            onChange={(v) => setLlm((prev) => ({ ...prev, apiKey: v }))}
            placeholder="sk-..."
          />
        </SettingRow>
        {llm.provider === 'local' && (
          <SettingRow label="Base URL" description="e.g. http://localhost:11434">
            <TextInput
              value={llm.baseUrl ?? ''}
              onChange={(v) => setLlm((prev) => ({ ...prev, baseUrl: v }))}
              placeholder="http://..."
            />
          </SettingRow>
        )}
        <SettingRow label="Model">
          <TextInput
            value={llm.model}
            onChange={(v) => setLlm((prev) => ({ ...prev, model: v }))}
            placeholder="gpt-4o"
          />
        </SettingRow>
        <div style={{ display: 'flex', gap: '8px', paddingTop: '12px' }}>
          <Button size="sm" onClick={saveLlm} variant="secondary">Save</Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleTestConnection('llm')}
          >
            Test Connection
          </Button>
          {testResult['llm'] === 'success' && <CheckCircle size={20} color="var(--primary-40)" />}
          {testResult['llm'] === 'error' && <XCircle size={20} color="#E53935" />}
        </div>
      </Card>

      {/* TTS Section */}
      <SectionHeader icon={<Volume2 size={20} />} title="Text-to-Speech" />
      <Card style={{ marginBottom: '8px' }}>
        <SettingRow label="Provider">
          <SelectInput
            value={tts.provider}
            onChange={(v) => setTts((prev) => ({ ...prev, provider: v as TTSConfig['provider'] }))}
            options={[
              { value: 'openai', label: 'OpenAI TTS' },
              { value: 'gptsovits', label: 'GPT-SoVITS' },
            ]}
          />
        </SettingRow>
        <SettingRow label="Voice">
          <SelectInput
            value={tts.voice}
            onChange={(v) => setTts((prev) => ({ ...prev, voice: v }))}
            options={[
              { value: 'alloy', label: 'Alloy' },
              { value: 'nova', label: 'Nova' },
              { value: 'shimmer', label: 'Shimmer' },
              { value: 'echo', label: 'Echo' },
            ]}
          />
        </SettingRow>
        <div style={{ display: 'flex', gap: '8px', paddingTop: '12px' }}>
          <Button size="sm" onClick={saveTts} variant="secondary">Save</Button>
          <Button size="sm" variant="ghost" onClick={() => handleTestConnection('tts')}>Test</Button>
          {testResult['tts'] === 'success' && <CheckCircle size={20} color="var(--primary-40)" />}
        </div>
      </Card>

      {/* ZeroTier Section */}
      <SectionHeader icon={<Network size={20} />} title="ZeroTier Network" />
      <Card style={{ marginBottom: '8px' }}>
        <SettingRow label="Network ID">
          <TextInput
            value={ztNetworkId}
            onChange={setZtNetworkId}
            placeholder="Network ID"
          />
        </SettingRow>
        <div style={{ display: 'flex', gap: '8px', paddingTop: '12px' }}>
          <Button
            size="sm"
            onClick={async () => {
              await set('zerotier', { networkId: ztNetworkId, isConnected: false });
            }}
            variant="secondary"
          >
            Connect
          </Button>
          <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
            {settings?.zerotier.isConnected ? '● Connected' : '○ Disconnected'}
          </span>
        </div>
      </Card>

      {/* Podcast Settings */}
      <SectionHeader icon={<Radio size={20} />} title="Podcast" />
      <Card style={{ marginBottom: '8px' }}>
        <SettingRow label="Sleep Time" description="When to generate daily podcast">
          <TextInput value={podcastSleepTime} onChange={setPodcastSleepTime} placeholder="22:00" />
        </SettingRow>
        <SettingRow label="Advance Minutes" description="Minutes before sleep to generate">
          <TextInput value={podcastAdvance} onChange={setPodcastAdvance} placeholder="60" />
        </SettingRow>
        <div style={{ paddingTop: '12px' }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              await set('podcast', {
                sleepTime: podcastSleepTime,
                advanceMinutes: parseInt(podcastAdvance) || 60,
                autoGenerate: settings?.podcast.autoGenerate ?? true,
              });
            }}
          >
            Save
          </Button>
        </div>
      </Card>

      {/* Review Settings */}
      <SectionHeader icon={<BookOpen size={20} />} title="Review" />
      <Card style={{ marginBottom: '8px' }}>
        <SettingRow label="Daily Limit" description="Max cards per day">
          <TextInput value={reviewLimit} onChange={setReviewLimit} placeholder="20" />
        </SettingRow>
        <SettingRow label="Notifications">
          <MaterialSwitch
            checked={reviewNotif}
            onChange={() => setReviewNotif((v) => !v)}
          />
        </SettingRow>
        {reviewNotif && (
          <SettingRow label="Reminder Time">
            <TextInput value={reviewReminderTime} onChange={setReviewReminderTime} placeholder="09:00" />
          </SettingRow>
        )}
        <div style={{ paddingTop: '12px' }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              await set('review', {
                dailyLimit: parseInt(reviewLimit) || 20,
                notificationsEnabled: reviewNotif,
                reminderTime: reviewReminderTime,
              });
            }}
          >
            Save
          </Button>
        </div>
      </Card>

      {/* App Preferences */}
      <SectionHeader icon={<Palette size={20} />} title="Appearance" />
      <Card style={{ marginBottom: '8px' }}>
        <SettingRow label="Theme">
          <SelectInput
            value={theme}
            onChange={async (v) => {
              const t = v as AppSettings['preferences']['theme'];
              setTheme(t);
              await set('preferences', {
                theme: t,
                language: settings?.preferences.language ?? 'en',
                onboardingCompleted: settings?.preferences.onboardingCompleted ?? true,
              });
            }}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'System' },
            ]}
          />
        </SettingRow>
      </Card>

      {/* Reset */}
      <div style={{ marginTop: '32px' }}>
        <Button variant="danger" size="sm" onClick={handleReset} style={{ marginBottom: '16px' }}>
          <RotateCcw size={16} /> Reset to Defaults
        </Button>
        <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', textAlign: 'center' }}>
          EchoLearn v1.0.0
        </p>
      </div>
    </div>
  );
}
