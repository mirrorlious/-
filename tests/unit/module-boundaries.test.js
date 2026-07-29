import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const modules = [
  'src/App.jsx',
  'src/core/api-config.js',
  'src/core/article-bundle.js',
  'src/core/pdf-text.js',
  'src/core/persistence.js',
  'src/core/vocabulary.js',
  'src/services/ai.js',
  'src/components/MindMap.jsx',
  'src/components/Paragraph.jsx',
  'src/components/PdfReader.jsx',
  'src/components/PracticePanels.jsx',
  'src/components/ReaderContent.jsx'
];

const modulePath = (relativePath) => path.join(root, relativePath);

describe('stage 2 module boundaries', () => {
  it('keeps application orchestration below the agreed size ceiling', async () => {
    const app = await readFile(modulePath('src/App.jsx'), 'utf8');

    expect(Buffer.byteLength(app)).toBeLessThan(230_000);
    expect(app).not.toContain('const callLLM =');
    expect(app).not.toContain('const Paragraph =');
    expect(app).not.toContain('const openReaderDb =');
  });

  it('keeps extracted domain and view modules present and bounded', async () => {
    const sizes = await Promise.all(modules.slice(1).map(async (file) => ({
      file,
      size: (await stat(modulePath(file))).size
    })));

    expect(sizes.every(({ size }) => size < 60_000)).toBe(true);
  });

  it('does not introduce circular relative imports', async () => {
    const graph = new Map();

    for (const file of modules) {
      const source = await readFile(modulePath(file), 'utf8');
      const dependencies = Array.from(source.matchAll(/from\s+['"](\.[^'"]+)['"]/g))
        .map((match) => {
          const resolved = path
            .relative(root, path.resolve(path.dirname(modulePath(file)), match[1]))
            .replaceAll('\\', '/');
          return resolved;
        })
        .filter((dependency) => modules.includes(dependency));
      graph.set(file, dependencies);
    }

    const visited = new Set();
    const active = new Set();
    const visit = (file) => {
      if (active.has(file)) throw new Error(`Circular import detected at ${file}`);
      if (visited.has(file)) return;
      active.add(file);
      for (const dependency of graph.get(file) || []) visit(dependency);
      active.delete(file);
      visited.add(file);
    };

    for (const file of modules) visit(file);
    expect(visited.size).toBe(modules.length);
  });
});
