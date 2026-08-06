import fs from 'node:fs';
import path from 'node:path';

export interface Settings {
  telegram: { enabled: boolean; botToken: string; chatId: string };
  discord: { enabled: boolean; webhookUrl: string };
  customWebhook: { enabled: boolean; url: string; secret: string };
  monitor: { intervalSeconds: number; running: boolean };
  payos: {
    enabled: boolean;
    clientId: string;
    apiKey: string;
    checksumKey: string;
    cancelUrl: string;
    returnUrl: string;
  };
  connection: {
    coreBankApiUrl: string;
    botWebhookUrl: string;
  };
}

const SETTINGS_PATH = path.join(process.cwd(), 'data', 'corebank-settings.json');

const DEFAULT_SETTINGS: Settings = {
  telegram: { enabled: false, botToken: '', chatId: '' },
  discord: { enabled: false, webhookUrl: '' },
  customWebhook: { enabled: false, url: '', secret: '' },
  monitor: { intervalSeconds: 60, running: false },
  payos: {
    enabled: false,
    clientId: '',
    apiKey: '',
    checksumKey: '',
    cancelUrl: '',
    returnUrl: '',
  },
  connection: {
    coreBankApiUrl: '',
    botWebhookUrl: '',
  },
};

export const getSettings = (): Settings => {
  if (!fs.existsSync(SETTINGS_PATH)) return { ...DEFAULT_SETTINGS };
  try {
    const data = fs.readFileSync(SETTINGS_PATH, 'utf-8');
    const parsed = JSON.parse(data) as Partial<Settings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      payos: { ...DEFAULT_SETTINGS.payos, ...(parsed.payos || {}) },
      connection: { ...DEFAULT_SETTINGS.connection, ...(parsed.connection || {}) },
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

export const saveSettings = (newSettings: Partial<Settings>) => {
  const current = getSettings();
  const updated = {
    ...current,
    ...newSettings,
    payos: { ...current.payos, ...(newSettings.payos || {}) },
    connection: { ...current.connection, ...(newSettings.connection || {}) },
  };
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(updated, null, 2), 'utf-8');
};
