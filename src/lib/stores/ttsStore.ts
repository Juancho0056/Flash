import { writable } from 'svelte/store';

export interface TTSSettings {
  autoPlay: boolean;
  defaultLang: string;
  // voice?: string; // Future enhancement: allow selecting a specific voice
  // rate?: number;  // Future enhancement: control speech rate
  // pitch?: number; // Future enhancement: control speech pitch
}

const TTS_SETTINGS_STORAGE_KEY = 'tts_settings';

function loadTTSSettings(): TTSSettings {
  if (typeof window === 'undefined') {
    // SSR Guard: Return defaults
    return { autoPlay: false, defaultLang: 'en-US' };
  }

  const storedSettingsJson = localStorage.getItem(TTS_SETTINGS_STORAGE_KEY);
  if (storedSettingsJson) {
    try {
      const parsedSettings = JSON.parse(storedSettingsJson);
      // Merge with defaults to ensure all properties are present
      return {
        autoPlay: parsedSettings.autoPlay || false,
        defaultLang: parsedSettings.defaultLang || 'en-US',
      };
    } catch (e) {
      console.error('Error parsing TTS settings from localStorage:', e);
      localStorage.removeItem(TTS_SETTINGS_STORAGE_KEY); // Clear corrupted data
      // Fallback to defaults
      return { autoPlay: false, defaultLang: 'en-US' };
    }
  }
  // No settings found in localStorage, return defaults
  return { autoPlay: false, defaultLang: 'en-US' };
}

const initialState: TTSSettings = loadTTSSettings();

export const ttsSettings = writable<TTSSettings>(initialState);

// Function to update and save TTS settings
export function updateTTSSettings(newSettings: Partial<TTSSettings>) {
  ttsSettings.update(currentSettings => {
    const updatedSettings = { ...currentSettings, ...newSettings };
    if (typeof window !== 'undefined') {
      localStorage.setItem(TTS_SETTINGS_STORAGE_KEY, JSON.stringify(updatedSettings));
    }
    return updatedSettings;
  });
}

// Example usage for updating a specific setting:
// updateTTSSettings({ autoPlay: true });
// updateTTSSettings({ defaultLang: 'es-ES' });
