import type { ThemeColors } from '../../themes/types';

export interface ThemeColorGroup {
  name: string;
  keys: (keyof ThemeColors)[];
}
