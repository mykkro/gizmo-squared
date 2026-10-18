export interface MenuHandlers {
  onOpen(): void;
  onClose(): void;
  newWorld(seedText: string): void;
  exportSave(): void;
  importSave(file: File): void;
}

function el<T extends HTMLElement>(doc: Document, id: string): T {
  const e = doc.getElementById(id);
  if (!e) throw new Error(`Missing #${id} in index.html`);
  return e as T;
}

export class Menu {
  private readonly dialog: HTMLDialogElement;
  private readonly seedLabel: HTMLElement;

  constructor(doc: Document, handlers: MenuHandlers, info: { storageAvailable: boolean }) {
    this.dialog = el<HTMLDialogElement>(doc, 'menu');
    this.seedLabel = el(doc, 'menu-seed');
    const seedInput = el<HTMLInputElement>(doc, 'seed-input');
    const importInput = el<HTMLInputElement>(doc, 'import-save');
    el(doc, 'storage-warning').hidden = info.storageAvailable;

    el(doc, 'menu-button').addEventListener('click', () => {
      this.dialog.showModal();
      handlers.onOpen();
    });
    el(doc, 'close-menu').addEventListener('click', () => this.dialog.close());
    this.dialog.addEventListener('close', () => handlers.onClose());

    el(doc, 'new-world').addEventListener('click', () => {
      if (!window.confirm('Start a new world? Your current world will be replaced.')) return;
      handlers.newWorld(seedInput.value.trim());
      seedInput.value = '';
      this.dialog.close();
    });
    el(doc, 'export-save').addEventListener('click', () => handlers.exportSave());
    importInput.addEventListener('change', () => {
      const file = importInput.files?.[0];
      importInput.value = '';
      if (file) {
        handlers.importSave(file);
        this.dialog.close();
      }
    });
  }

  get isOpen(): boolean {
    return this.dialog.open;
  }

  setSeed(seed: string): void {
    this.seedLabel.textContent = `Current world: ${seed}`;
  }
}
