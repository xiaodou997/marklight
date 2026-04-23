import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, getIsDarkMode, getPresetTheme, importTheme } from '../manager';

const toggleMock = vi.fn();
const setPropertyMock = vi.fn();

beforeEach(() => {
  toggleMock.mockReset();
  setPropertyMock.mockReset();
  vi.stubGlobal('document', {
    documentElement: {
      classList: {
        toggle: toggleMock,
      },
      style: {
        setProperty: setPropertyMock,
      },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('theme manager', () => {
  it('applies dark themes through a single appearance flag', () => {
    const theme = getPresetTheme('default-dark');
    expect(theme).toBeTruthy();

    applyTheme(theme!);

    expect(toggleMock).toHaveBeenCalledWith('dark', true);
    expect(setPropertyMock).toHaveBeenCalledWith('--bg-color', theme!.colors.bgColor);
    expect(getIsDarkMode()).toBe(true);
  });

  it('applies light themes without the dark class', () => {
    const theme = getPresetTheme('default-light');
    expect(theme).toBeTruthy();

    applyTheme(theme!);

    expect(toggleMock).toHaveBeenCalledWith('dark', false);
    expect(getIsDarkMode()).toBe(false);
  });

  it('imports legacy theme files as a single appearance theme', () => {
    const imported = importTheme(
      JSON.stringify({
        id: 'legacy-demo',
        name: 'Legacy Demo',
        type: 'custom',
        light: getPresetTheme('default-light')!.colors,
        dark: getPresetTheme('default-dark')!.colors,
      }),
      'dark',
    );

    expect(imported).toMatchObject({
      id: 'legacy-demo',
      name: 'Legacy Demo',
      type: 'custom',
      appearance: 'dark',
      colors: getPresetTheme('default-dark')!.colors,
    });
  });
});
