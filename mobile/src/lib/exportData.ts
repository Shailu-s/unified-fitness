import type { ExportData } from '../types';

interface ExportPlatform {
  isAvailable: () => Promise<boolean>;
  writeFile: (filename: string, content: string) => Promise<string>;
  shareFile: (uri: string) => Promise<void>;
}

export function makeExportDocument(data: ExportData, date = new Date()): string {
  return JSON.stringify({
    format: 'unified-fitness',
    version: 1,
    exportedAt: date.toISOString(),
    profile: data.profile,
    meals: data.meals,
    ...(data.drafts?.length ? { drafts: data.drafts } : {}),
    ...(data.voice?.length ? { voice: data.voice } : {}),
  }, null, 2);
}

export async function shareLocalExport(readData: () => ExportData, platform: ExportPlatform, date = new Date()) {
  if (!await platform.isAvailable()) throw new Error('Sharing is not available on this device.');
  const content = makeExportDocument(readData(), date);
  const filename = `unified-fitness-${date.toISOString().replace(/[.:]/g, '-')}.json`;
  const uri = await platform.writeFile(filename, content);
  await platform.shareFile(uri);
}
