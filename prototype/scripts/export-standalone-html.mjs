import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const projectRoot = process.cwd();
const buildRoot = join(projectRoot, 'dist', 'client');
const outputDirectory = join(projectRoot, 'exports');
const outputPath = join(outputDirectory, 'gift-prototype.html');

const mimeTypes = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    }),
  );
  return files.flat();
}

function toDataUrl(path, contents) {
  const mimeType = mimeTypes[extname(path)];
  if (!mimeType) return null;
  return `data:${mimeType};base64,${contents.toString('base64')}`;
}

let html = await readFile(join(buildRoot, 'index.html'), 'utf8');
const scriptMatch = html.match(/<script[^>]+src="([^"]+)"[^>]*><\/script>/);
const styleMatch = html.match(/<link[^>]+href="([^"]+\.css)"[^>]*>/);

if (!scriptMatch || !styleMatch) {
  throw new Error('Built JavaScript or stylesheet entry was not found.');
}

const scriptPath = join(buildRoot, scriptMatch[1].replace(/^\//, ''));
const stylePath = join(buildRoot, styleMatch[1].replace(/^\//, ''));
let script = await readFile(scriptPath, 'utf8');
let style = await readFile(stylePath, 'utf8');

for (const path of await listFiles(join(buildRoot, 'assets'))) {
  if (path === scriptPath || path === stylePath) continue;
  const contents = await readFile(path);
  const dataUrl = toDataUrl(path, contents);
  if (!dataUrl) continue;
  const publicPath = `/${relative(buildRoot, path).split('\\').join('/')}`;
  script = script.split(publicPath).join(dataUrl);
  style = style.split(publicPath).join(dataUrl);
}

script = script.replaceAll('</script', '<\\/script');
html = html
  .replace('<html lang="en">', '<html lang="ko">')
  .replace(/<title>.*?<\/title>/, '<title>선잘알</title>')
  .replace(scriptMatch[0], () => `<script type="module">${script}</script>`)
  .replace(styleMatch[0], () => `<style>${style}</style>`);

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, html);
console.log(`Standalone HTML created: ${outputPath}`);
