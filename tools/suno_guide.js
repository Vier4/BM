#!/usr/bin/env node
/*
 * Делает инструкцию «как записать песни групп BM в Suno»:
 * music/bands/КАК_ЗАПИСАТЬ_ПЕСНИ.md и пустые папки для mp3.
 * Запуск: node tools/suno_guide.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/bands-data.js'), 'utf8'), ctx);
const bands = ctx.window.BM_BANDS;

// Раздел без строк = повтор раздела с тем же названием (Suno нужен полный текст)
function expand(text) {
  const blocks = [];
  let cur = null;
  for (const line of text.split('\n')) {
    const h = line.match(/^\[(.+)\]\s*$/);
    if (h) { cur = { name: h[1], lines: [] }; blocks.push(cur); continue; }
    if (cur && line.trim()) cur.lines.push(line);
  }
  const seen = {};
  for (const b of blocks) {
    if (b.lines.length) seen[b.name] = b.lines;
    else if (seen[b.name]) b.lines = seen[b.name];
  }
  return blocks.map(b => `[${b.name}]\n${b.lines.join('\n')}`).join('\n\n');
}

let md = `# Как записать песни групп BM

Все группы, песни и тексты ниже — © BM.

1. Откройте [suno.com](https://suno.com) и включите режим **Custom**.
2. Для каждой песни скопируйте:
   - **Style of Music** — строку «Стиль»;
   - **Lyrics** — текст песни целиком (вместе с [Verse], [Chorus] и т. д.);
   - **Title** — название.
3. Выберите лучший из двух вариантов, скачайте **MP3**.
4. Сохраните файл точно по пути, указанному у песни. BM сам найдёт его,
   и вместо пометки «скоро» песня начнёт играть.

> Права на песни, созданные в Suno, принадлежат вам только на **платном** тарифе
> (Pro или Premier) — песни с бесплатного тарифа использовать нельзя.

`;

for (const b of bands) {
  md += `\n---\n\n## ${b.name} — ${b.genre}, ${b.city}\n\n`;
  b.songs.forEach((s, i) => {
    const file = `music/bands/${b.id}/${s.id}.mp3`;
    fs.mkdirSync(path.join(root, 'music/bands', b.id), { recursive: true });
    md += `### ${i + 1}. ${s.title}\n\n`;
    md += `**Файл:** \`${file}\`\n\n`;
    md += `**Стиль:**\n\n\`\`\`\n${b.style}, ${s.style}\n\`\`\`\n\n`;
    md += `**Текст:**\n\n\`\`\`\n${expand(s.lyrics)}\n\`\`\`\n\n`;
  });
}

const out = path.join(root, 'music/bands/КАК_ЗАПИСАТЬ_ПЕСНИ.md');
fs.writeFileSync(out, md);
console.log('Готово:', path.relative(root, out), '—', bands.reduce((n, b) => n + b.songs.length, 0), 'песен');
