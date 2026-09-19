import fs from 'node:fs/promises';
import { PNG } from 'pngjs';

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error('用法：node scripts/create-infinity-edge-png.mjs 输入.png 输出.png');
  process.exit(1);
}

const image = PNG.sync.read(await fs.readFile(inputPath));

function rgbToHsl(red, green, blue) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return [0, 0, lightness];
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue;
  if (max === r) hue = 60 * (((g - b) / delta) % 6);
  else if (max === g) hue = 60 * ((b - r) / delta + 2);
  else hue = 60 * ((r - g) / delta + 4);
  if (hue < 0) hue += 360;
  return [hue, saturation, lightness];
}

function mix(original, target, amount) {
  return Math.round(original * (1 - amount) + target * amount);
}

function recolor(red, green, blue) {
  const [hue, saturation, lightness] = rgbToHsl(red, green, blue);
  if (saturation > 0.12 && hue >= 160 && hue <= 285) {
    // The source is a blue windblade. Infinity Edge needs the blue removed
    // entirely so the silhouette reads as silver steel over an obsidian spine.
    if (lightness < 0.22) return [17, 20, 29];
    if (lightness < 0.42) return [50, 59, 73];
    if (lightness < 0.64) return [137, 144, 151];
    return [236, 233, 220];
  }
  if (saturation > 0.16 && (hue < 24 || hue > 332)) {
    return [mix(red, 190, .42), mix(green, 35, .42), mix(blue, 39, .42)];
  }
  return [red, green, blue];
}

for (let y = 0; y < image.height; y += 1) {
  for (let x = 0; x < image.width; x += 1) {
    const i = (y * image.width + x) * 4;
    if (image.data[i + 3] === 0) continue;
    const [red, green, blue] = recolor(image.data[i], image.data[i + 1], image.data[i + 2]);
    image.data[i] = red;
    image.data[i + 1] = green;
    image.data[i + 2] = blue;
  }
}

const setPixel = (x, y, color) => {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const i = (y * image.width + x) * 4;
  image.data[i] = color[0];
  image.data[i + 1] = color[1];
  image.data[i + 2] = color[2];
  image.data[i + 3] = 255;
};

const stampCircle = (cx, cy, radius, color) => {
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) setPixel(x, y, color);
    }
  }
};

const drawLine = (x1, y1, x2, y2, width, color) => {
  const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1));
  for (let step = 0; step <= steps; step += 1) {
    const t = steps === 0 ? 0 : step / steps;
    stampCircle(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, width / 2, color);
  }
};

const drawDiamond = (cx, cy, radius, fill, edge) => {
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      const distance = Math.abs(x - cx) + Math.abs(y - cy);
      if (distance <= radius) setPixel(x, y, distance >= radius - 6 ? edge : fill);
    }
  }
};

// The existing windblade has the desired lower-left nib / upper-right blade framing.
// Add only attached details so this remains one coherent pen silhouette.
const gold = [238, 186, 55, 255];
const goldBright = [255, 241, 159, 255];
const ruby = [205, 37, 45, 255];
const rubyBright = [255, 135, 105, 255];
drawLine(756, 532, 1100, 218, 9, gold);
drawLine(770, 523, 1090, 231, 3, goldBright);
drawDiamond(760, 523, 36, ruby, goldBright);
drawDiamond(751, 514, 10, rubyBright, rubyBright);
for (const [x, y, size] of [[832, 456, 12], [898, 396, 11], [963, 337, 10], [1024, 282, 9]]) {
  drawDiamond(x, y, size, goldBright, gold);
}

await fs.writeFile(outputPath, PNG.sync.write(image));
console.log(JSON.stringify({ inputPath, outputPath, size: [image.width, image.height], recolored: true, attachedDetails: 6 }));
