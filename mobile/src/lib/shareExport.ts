import { File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import type { ExportData } from '../types';
import { shareLocalExport } from './exportData';

export const shareExport = (readData: () => ExportData) => shareLocalExport(readData, {
  isAvailable: isAvailableAsync,
  writeFile: async (filename, content) => {
    const file = new File(Paths.cache, filename);
    file.create();
    file.write(content);
    return file.uri;
  },
  shareFile: (uri) => shareAsync(uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: 'Export fitness data',
  }),
});
