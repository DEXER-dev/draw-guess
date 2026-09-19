import fs from 'node:fs/promises';
import { PNG } from 'pngjs';

const outputPath = process.argv[2] || 'public/assets/pen-skins/fire-kylin.png';
const WIDTH = 1254;
const HEIGHT = 1254;
const png = new PNG({ width: WIDTH, height: HEIGHT });

const angle = -0.52;
const cos = Math.cos(angle);
const sin = Math.sin(angle);
const origin = [120, 850];
const transform = (x, y) => [origin[0] + x * cos - y * sin, origin[1] + x * sin + y * cos];

const rgba = (color, alpha = 255) => [color[0], color[1], color[2], alpha];
const blendPixel = (x, y, color) => {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  const index = (Math.round(y) * WIDTH + Math.round(x)) * 4;
  const sourceAlpha = (color[3] ?? 255) / 255;
  const destinationAlpha = png.data[index + 3] / 255;
  const outAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
  if (outAlpha <= 0) return;
  for (let channel = 0; channel < 3; channel += 1) {
    png.data[index + channel] = Math.round((color[channel] * sourceAlpha + png.data[index + channel] * destinationAlpha * (1 - sourceAlpha)) / outAlpha);
  }
  png.data[index + 3] = Math.round(outAlpha * 255);
};

const stampCircle = (cx, cy, radius, color) => {
  const minX = Math.floor(cx - radius);
  const maxX = Math.ceil(cx + radius);
  const minY = Math.floor(cy - radius);
  const maxY = Math.ceil(cy + radius);
  const radiusSquared = radius * radius;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radiusSquared) blendPixel(x, y, color);
    }
  }
};

const drawLine = (x1, y1, x2, y2, width, color) => {
  const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1)));
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    stampCircle(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, width / 2, color);
  }
};

const polygon = (localPoints, color) => {
  const points = localPoints.map(([x, y]) => transform(x, y));
  const minY = Math.max(0, Math.floor(Math.min(...points.map(([, y]) => y))));
  const maxY = Math.min(HEIGHT - 1, Math.ceil(Math.max(...points.map(([, y]) => y))));
  for (let y = minY; y <= maxY; y += 1) {
    const intersections = [];
    for (let i = 0; i < points.length; i += 1) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) intersections.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i + 1 < intersections.length; i += 2) {
      const start = Math.ceil(intersections[i]);
      const end = Math.floor(intersections[i + 1]);
      for (let x = start; x <= end; x += 1) blendPixel(x, y, color);
    }
  }
};

const localLine = (x1, y1, x2, y2, width, color) => {
  const [aX, aY] = transform(x1, y1);
  const [bX, bY] = transform(x2, y2);
  drawLine(aX, aY, bX, bY, width, color);
};

const localCircle = (x, y, radius, color) => {
  const [cx, cy] = transform(x, y);
  stampCircle(cx, cy, radius, color);
};

const outline = (points, width = 16, color = [7, 8, 13, 255]) => {
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = transform(...points[i]);
    const [x2, y2] = transform(...points[(i + 1) % points.length]);
    drawLine(x1, y1, x2, y2, width, color);
  }
};

const dark = [16, 17, 24, 255];
const black = [7, 8, 13, 255];
const steel = [102, 105, 111, 255];
const steelLight = [212, 177, 91, 255];
const gold = [190, 118, 24, 255];
const goldBright = [255, 207, 76, 255];
const wood = [91, 31, 27, 255];
const woodLight = [150, 57, 35, 255];
const crimson = [117, 16, 28, 255];
const crimsonBright = [240, 57, 40, 255];
const ember = [255, 116, 35, 255];
const emberSoft = [255, 81, 28, 70];

// A small halo around the qilin head keeps the silhouette readable without
// baking a continuous trail into the asset.
localLine(560, -94, 780, -92, 76, [236, 52, 27, 18]);

// Wood-and-metal stock at the rear of the AK silhouette.
const stock = [[35, -76], [150, -92], [258, -72], [286, -28], [276, 46], [218, 78], [126, 66], [48, 42], [14, 10]];
outline(stock, 18);
polygon(stock, wood);
polygon([[45, -60], [150, -72], [236, -56], [257, -20], [248, 29], [205, 57], [127, 48], [55, 27]], woodLight);
localLine(68, -47, 225, -36, 8, [246, 118, 56, 135]);
localLine(65, 2, 236, 16, 8, [61, 19, 20, 170]);
localLine(95, 42, 214, 50, 7, [220, 81, 47, 120]);

// Receiver, with a dark center and the gold hero-weapon spine.
const receiver = [[236, -72], [532, -82], [600, -52], [604, 58], [546, 76], [248, 67], [216, 31], [218, -36]];
outline(receiver, 18);
polygon(receiver, dark);
polygon([[246, -57], [516, -64], [563, -42], [558, -18], [247, -8]], [36, 36, 43, 255]);
polygon([[247, 9], [555, 2], [562, 44], [537, 57], [258, 51]], [12, 13, 20, 255]);
polygon([[267, -65], [514, -71], [548, -54], [536, -39], [273, -32]], gold);
localLine(278, -52, 512, -57, 7, goldBright);
localLine(279, 51, 516, 46, 6, [79, 42, 19, 255]);

// Pistol grip, angled into the pen body.
const grip = [[279, 36], [387, 37], [430, 160], [394, 212], [326, 198], [299, 112]];
outline(grip, 17);
polygon(grip, black);
polygon([[294, 50], [371, 51], [406, 153], [381, 190], [341, 180], [316, 104]], crimson);
for (let y = 72; y <= 160; y += 25) localLine(315, y, 395, y + 10, 6, [224, 63, 40, 190]);
polygon([[291, 42], [382, 42], [392, 62], [299, 60]], gold);

// Ejection port and rear sight make the receiver read as an AK rather than a generic sci-fi body.
polygon([[403, -49], [497, -51], [515, -30], [500, -12], [414, -14]], black);
polygon([[416, -42], [489, -43], [499, -32], [487, -24], [421, -25]], [82, 27, 27, 255]);
localLine(421, -37, 485, -38, 5, crimsonBright);
polygon([[494, -60], [529, -58], [536, -80], [550, -83], [551, -51], [512, -48]], black);
localLine(503, -54, 533, -55, 5, goldBright);

// Curved magazine: red enamel with gold ribs.
const magazine = [[439, 37], [548, 45], [589, 105], [582, 222], [547, 291], [493, 284], [507, 208], [506, 111], [464, 73]];
outline(magazine, 18);
polygon(magazine, crimson);
polygon([[463, 61], [532, 68], [565, 110], [557, 205], [532, 263], [518, 252], [531, 192], [530, 112], [489, 84]], [69, 12, 24, 255]);
for (let y = 82; y <= 250; y += 28) localLine(475 + (y - 82) * 0.08, y, 540 + (y - 82) * 0.04, y + 12, 8, gold);
localLine(472, 69, 551, 77, 8, goldBright);

// AK trigger guard and a small gold trigger below the receiver.
const triggerGuard = [[371, 61], [454, 62], [477, 91], [462, 123], [439, 126], [448, 96], [431, 82], [385, 82]];
outline(triggerGuard, 15);
polygon(triggerGuard, black);
polygon([[401, 79], [430, 81], [448, 96], [440, 111], [431, 101], [434, 92], [414, 88]], gold);
localLine(431, 85, 439, 107, 6, crimsonBright);

// Gold dragon scale inlays across the receiver and fore-end.
for (const [x, y, size] of [[330, -4, 14], [370, -5, 12], [410, -6, 11], [450, -7, 10], [616, -7, 13], [655, -7, 12], [694, -7, 11], [733, -7, 10]]) {
  polygon([[x, y - size], [x + size, y], [x, y + size], [x - size, y]], goldBright);
  localCircle(x, y, Math.max(2, size * 0.28), crimson);
}

// Handguard with red flame channels and a bright gold rail.
const handguard = [[574, -62], [778, -54], [813, -28], [800, 54], [759, 74], [582, 63], [555, 34]];
outline(handguard, 18);
polygon(handguard, black);
polygon([[588, -45], [758, -39], [785, -20], [772, 34], [748, 52], [592, 43]], [45, 29, 29, 255]);
polygon([[602, 30], [671, 24], [639, 2], [735, 1], [700, -21], [772, -18], [762, 34], [748, 51], [610, 41]], crimsonBright);
localLine(583, -52, 764, -45, 11, goldBright);
localLine(600, -38, 756, -33, 4, [255, 245, 167, 255]);

// Barrel and front sight.
const barrel = [[772, -31], [1010, -25], [1028, -12], [1028, 12], [1008, 26], [772, 30]];
outline(barrel, 14);
polygon(barrel, steel);
polygon([[787, -18], [1004, -13], [1011, -4], [790, -1]], [227, 183, 76, 255]);
polygon([[790, 1], [1010, 3], [1008, 16], [790, 17]], [44, 39, 38, 255]);
polygon([[862, -31], [904, -29], [900, -66], [919, -70], [933, -26]], black);
localLine(866, -46, 914, -49, 8, goldBright);

// Qilin head ornament over the fore-end: horn, snout and a glowing eye.
const qilinHead = [[625, -71], [656, -131], [702, -151], [741, -133], [787, -106], [820, -82], [780, -65], [729, -59], [697, -38], [665, -47]];
outline(qilinHead, 15);
polygon(qilinHead, gold);
polygon([[670, -92], [704, -128], [737, -133], [769, -113], [801, -91], [770, -80], [728, -75], [700, -57]], [135, 52, 23, 255]);
polygon([[757, -113], [813, -90], [844, -79], [811, -62], [770, -69]], goldBright);
polygon([[686, -128], [666, -179], [681, -193], [706, -143]], goldBright);
polygon([[716, -134], [729, -186], [746, -195], [747, -131]], gold);
localCircle(742, -105, 14, crimsonBright);
localCircle(745, -108, 5, [255, 226, 131, 255]);
polygon([[806, -81], [852, -70], [831, -56], [789, -60]], steelLight);

// Muzzle brake stays cylindrical so the item reads as an AK; a short clear nib
// projects from its center so it still behaves as a drawing pen.
const muzzle = [[986, -35], [1032, -34], [1051, -24], [1051, 24], [1032, 34], [986, 35]];
outline(muzzle, 14);
polygon(muzzle, gold);
polygon([[997, -20], [1027, -19], [1038, -11], [1038, 11], [1027, 19], [997, 20]], [60, 23, 24, 255]);
localLine(999, -18, 1030, -17, 6, goldBright);
localLine(999, 18, 1030, 17, 5, [112, 52, 20, 255]);
localCircle(1000, 0, 24, [240, 55, 32, 70]);
polygon([[1034, -12], [1088, 0], [1034, 12]], black);
polygon([[1041, -7], [1088, 0], [1041, 7]], [247, 219, 154, 255]);
polygon([[1050, -3], [1088, 0], [1050, 3]], [255, 250, 228, 255]);

// Small suspended ember shards echo the weapon's fire motif while remaining part of the PNG.
for (const [x, y, size] of [[595, -146, 9], [568, -123, 7], [840, -104, 8], [872, -87, 6]]) {
  polygon([[x, y - size], [x + size * .7, y], [x, y + size], [x - size * .7, y]], ember);
}

await fs.writeFile(outputPath, PNG.sync.write(png));
console.log(JSON.stringify({ outputPath, size: [WIDTH, HEIGHT], theme: 'AK47 Fire Kylin inspired', anchorLocal: [1088, 0] }));
