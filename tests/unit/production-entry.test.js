import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const readProjectFile = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('production entry contract', () => {
  it('uses the local Vite module entry without runtime transpilation or CDN frameworks', async () => {
    const html = await readProjectFile('index.html');

    expect(html).toContain('src="/src/main.jsx"');
    expect(html).not.toMatch(/text\/babel|babel\.min\.js/i);
    expect(html).not.toMatch(/react\.development\.js|cdn\.tailwindcss\.com/i);
    expect(html).not.toMatch(/https:\/\/(?:unpkg|cdn\.jsdelivr|www\.gstatic)\.com/i);
  });

  it('keeps the immersive exit control in the migrated application source', async () => {
    const app = await readProjectFile('src/App.jsx');

    expect(app).toContain('data-reader-immersive-exit=');
    expect(app).toContain('exitImmersiveOnEscape');
  });

  it('provides a real build and regression-test pipeline', async () => {
    const packageJson = JSON.parse(await readProjectFile('package.json'));

    expect(packageJson.scripts.build).toContain('vite build');
    expect(packageJson.scripts.test).toContain('test:e2e');
    expect(packageJson.scripts.test).not.toMatch(/No tests configured/i);
  });

  it('keeps mastered vocabulary local, portable, and independent from the default dictionaries', async () => {
    const sources = await Promise.all([
      readProjectFile('src/App.jsx'),
      readProjectFile('src/core/vocabulary.js'),
      readProjectFile('src/components/Paragraph.jsx')
    ]);
    const implementation = sources.join('\n');

    expect(implementation).toContain('vocabularyPreferences');
    expect(implementation).toContain('ignoredLemmas');
    expect(implementation).toContain('portablePreferences');
    expect(implementation).toContain('这个词太简单，不再划线');
    expect(implementation).toContain('masteredLemmaSet?.has(match.word)');
  });
});
