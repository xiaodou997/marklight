import { describe, expect, it } from 'vitest';
import type { ThemeColors } from '../../themes/types';
import { normalizeSettings } from '../settings';

function createColors(overrides: Partial<ThemeColors> = {}): ThemeColors {
  return {
    primaryColor: '#111111',
    primaryHover: '#222222',
    primaryLight: '#333333',
    bgColor: '#ffffff',
    bgSecondary: '#fafafa',
    textColor: '#000000',
    textSecondary: '#444444',
    mutedColor: '#666666',
    borderColor: '#dddddd',
    borderLight: '#eeeeee',
    sidebarBg: '#f7f7f7',
    sidebarHover: '#f0f0f0',
    codeBg: '#f5f5f5',
    codeBorder: '#d0d0d0',
    hoverBg: '#f8f8f8',
    activeBg: '#ebebeb',
    selectedBg: '#e0e0e0',
    quoteBg: '#f4f4f4',
    tagBg: '#ededed',
    tagColor: '#123456',
    successColor: '#16a34a',
    successBg: '#dcfce7',
    warningColor: '#d97706',
    warningBg: '#fef3c7',
    errorColor: '#dc2626',
    errorBg: '#fee2e2',
    infoColor: '#2563eb',
    infoBg: '#dbeafe',
    shadowSm: '0 1px 2px rgba(0,0,0,0.05)',
    shadowMd: '0 4px 6px rgba(0,0,0,0.1)',
    shadowLg: '0 10px 15px rgba(0,0,0,0.1)',
    shadowXl: '0 20px 25px rgba(0,0,0,0.15)',
    radiusSm: '4px',
    radiusMd: '8px',
    radiusLg: '12px',
    radiusXl: '16px',
    modalBg: '#ffffff',
    modalBorder: '#dddddd',
    modalOverlay: 'rgba(0,0,0,0.4)',
    modalShadow: '0 25px 50px rgba(0,0,0,0.2)',
    inputBg: '#ffffff',
    inputBorder: '#dddddd',
    inputFocusBorder: '#2563eb',
    inputFocusShadow: '0 0 0 3px rgba(37,99,235,0.15)',
    inputPlaceholder: '#9ca3af',
    btnPrimaryBg: '#2563eb',
    btnPrimaryHover: '#1d4ed8',
    btnPrimaryText: '#ffffff',
    btnSecondaryBg: '#f3f4f6',
    btnSecondaryHover: '#e5e7eb',
    btnSecondaryText: '#111827',
    btnGhostBg: 'transparent',
    btnGhostHover: '#f3f4f6',
    popoverBg: '#ffffff',
    popoverBorder: '#dddddd',
    popoverShadow: '0 10px 15px rgba(0,0,0,0.1)',
    calloutNote: '#2563eb',
    calloutNoteBg: '#dbeafe',
    calloutTip: '#059669',
    calloutTipBg: '#d1fae5',
    calloutWarning: '#d97706',
    calloutWarningBg: '#fef3c7',
    calloutDanger: '#dc2626',
    calloutDangerBg: '#fee2e2',
    calloutSuccess: '#16a34a',
    calloutSuccessBg: '#dcfce7',
    calloutQuote: '#6b7280',
    calloutQuoteBg: '#f3f4f6',
    ...overrides,
  };
}

describe('normalizeSettings', () => {
  it('fills missing fields with defaults', () => {
    const normalized = normalizeSettings();

    expect(normalized.activeThemeId).toBe('default-light');
    expect(normalized.autoSave).toBe(false);
    expect(normalized.showLineNumbers).toBe(false);
    expect(normalized.configVersion).toBe(5);
  });

  it('preserves current-format stored themes and updates config version', () => {
    const normalized = normalizeSettings({
      activeThemeId: 'custom-42',
      customThemes: [
        {
          id: 'custom-42',
          name: 'My Theme',
          type: 'custom',
          appearance: 'dark',
          colors: createColors({ bgColor: '#111827' }),
        },
      ],
      configVersion: 1,
    });

    expect(normalized.activeThemeId).toBe('custom-42');
    expect(normalized.customThemes[0]).toMatchObject({
      id: 'custom-42',
      appearance: 'dark',
    });
    expect(normalized.configVersion).toBe(5);
  });
});
