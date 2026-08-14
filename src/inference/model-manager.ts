import * as FileSystem from 'expo-file-system/legacy';
import type { ModelState } from '../domain/types.ts';
import { modelManifest } from './model-manifest.ts';

const rootDirectory = `${FileSystem.documentDirectory ?? ''}models/`;

type Listener = (states: ModelState[]) => void;

export class ModelManager {
  private states: ModelState[] = modelManifest.map((model) => ({
    ...model, installed: false, downloadProgress: 0, downloading: false
  }));
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.states);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.states = [...this.states];
    this.listeners.forEach((listener) => listener(this.states));
  }

  async initialize(): Promise<ModelState[]> {
    if (!FileSystem.documentDirectory) {
      this.states = this.states.map((state) => ({ ...state, error: 'Device document storage is unavailable.' }));
      this.emit();
      return this.states;
    }
    await FileSystem.makeDirectoryAsync(rootDirectory, { intermediates: true });
    this.states = await Promise.all(this.states.map(async (state) => {
      const localUri = `${rootDirectory}${state.filename}`;
      const info = await FileSystem.getInfoAsync(localUri);
      return { ...state, installed: info.exists, localUri: info.exists ? localUri : undefined, downloadProgress: info.exists ? 1 : 0 };
    }));
    this.emit();
    return this.states;
  }

  list(): ModelState[] { return this.states; }
  get(id: string): ModelState | undefined { return this.states.find((state) => state.id === id); }
  getVad(): ModelState | undefined { return this.states.find((state) => state.role === 'vad'); }

  async install(id: string): Promise<void> {
    const target = this.get(id);
    if (!target || target.downloading || target.installed) return;
    if (!FileSystem.documentDirectory) throw new Error('Device document storage is unavailable.');
    await FileSystem.makeDirectoryAsync(rootDirectory, { intermediates: true });
    const localUri = `${rootDirectory}${target.filename}`;
    this.update(id, { downloading: true, error: undefined, downloadProgress: 0 });
    const download = FileSystem.createDownloadResumable(target.url, localUri, {}, (progress) => {
      const expected = progress.totalBytesExpectedToWrite || target.approximateBytes;
      this.update(id, { downloadProgress: expected ? progress.totalBytesWritten / expected : 0 });
    });
    try {
      const result = await download.downloadAsync();
      if (!result?.uri) throw new Error('The model download did not return a local file.');
      this.update(id, { installed: true, localUri: result.uri, downloading: false, downloadProgress: 1 });
    } catch (error) {
      await FileSystem.deleteAsync(localUri, { idempotent: true });
      this.update(id, { downloading: false, downloadProgress: 0, error: error instanceof Error ? error.message : 'Model download failed.' });
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const target = this.get(id);
    if (!target?.localUri) return;
    await FileSystem.deleteAsync(target.localUri, { idempotent: true });
    this.update(id, { installed: false, localUri: undefined, downloadProgress: 0, error: undefined });
  }

  private update(id: string, patch: Partial<ModelState>): void {
    this.states = this.states.map((state) => state.id === id ? { ...state, ...patch } : state);
    this.emit();
  }
}

export const modelManager = new ModelManager();
