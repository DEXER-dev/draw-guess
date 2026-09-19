import fs from 'node:fs/promises';
import path from 'node:path';
import { PNG } from 'pngjs';

const [, , inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  console.error('用法：node scripts/prepare-pen-skin.mjs 输入.png 输出.png');
  process.exit(1);
}

const source = PNG.sync.read(await fs.readFile(inputPath));
const { width, height, data } = source;
const visited = new Uint8Array(width * height);
const queue = new Int32Array(width * height);
let head = 0;
let tail = 0;

const pixelIndex = (x, y) => (y * width + x) * 4;
const isBackdrop = (x, y) => {
  const i = pixelIndex(x, y);
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  return min >= 226 && max - min <= 20;
};

const enqueue = (x, y) => {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const cell = y * width + x;
  if (visited[cell] || !isBackdrop(x, y)) return;
  visited[cell] = 1;
  queue[tail++] = cell;
};

for (let x = 0; x < width; x += 1) {
  enqueue(x, 0);
  enqueue(x, height - 1);
}
for (let y = 1; y < height - 1; y += 1) {
  enqueue(0, y);
  enqueue(width - 1, y);
}

const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
while (head < tail) {
  const cell = queue[head++];
  const x = cell % width;
  const y = Math.floor(cell / width);
  for (const [dx, dy] of neighbors) enqueue(x + dx, y + dy);
}

let removed = 0;
for (let cell = 0; cell < visited.length; cell += 1) {
  if (!visited[cell]) continue;
  data[cell * 4 + 3] = 0;
  removed += 1;
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, PNG.sync.write(source));
console.log(JSON.stringify({ inputPath, outputPath, width, height, removedPixels: removed }));
