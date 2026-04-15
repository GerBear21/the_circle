import { useState, useEffect, useCallback } from 'react';

interface SystemSettings {
  [category: string]: {
    [key: string]: any;
  };
}

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async (category?: string) => {
    try {
      setLoading(true);
      setError(null);
      const url = category
        ? `/api/admin/settings?category=${encodeURIComponent(category)}`
        : '/api/admin/settings';
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch settings');
      }
      const data = await res.json();
      setSettings(data.settings || {});
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = useCallback(async (
    items: { category: string; key: string; value: any }[]
  ) => {
    try {
      setSaving(true);
      setError(null);
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: items }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save settings');
      }
      // Refresh after save
      await fetchSettings();
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [fetchSettings]);

  const getSetting = useCallback((category: string, key: string, defaultValue?: any) => {
    return settings[category]?.[key] ?? defaultValue;
  }, [settings]);

  return {
    settings,
    loading,
    error,
    saving,
    fetchSettings,
    saveSettings,
    getSetting,
  };
}
