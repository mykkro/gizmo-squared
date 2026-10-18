import { parseSave, type SaveData } from './storage';

export function downloadSave(data: SaveData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gizmo-save-${data.seed.replace(/[^a-z0-9_-]/gi, '_')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Throws SaveError for anything that isn't a valid current-version save. */
export async function readSaveFile(file: File): Promise<SaveData> {
  return parseSave(await file.text());
}
