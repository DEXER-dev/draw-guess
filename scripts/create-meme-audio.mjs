import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('public/assets/meme-packs/audio');
const SR = 44100;
fs.mkdirSync(outDir, { recursive: true });

const clamp = (v) => Math.max(-1, Math.min(1, v));
const env = (t, length, attack = 0.01, release = 0.2) => {
  const a = Math.min(1, t / attack);
  const r = Math.min(1, (length - t) / release);
  return Math.max(0, Math.min(a, r));
};
const seededNoise = (seed = 1) => {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return (state / 0xffffffff) * 2 - 1;
  };
};
const render = (length, fn) => {
  const data = new Float32Array(Math.ceil(length * SR));
  for (let i = 0; i < data.length; i++) data[i] = clamp(fn(i / SR, length));
  return data;
};
const writeWav = (fileName, samples) => {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write('WAVE', 8); buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(SR, 24);
  buffer.writeUInt32LE(SR * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) buffer.writeInt16LE(Math.round(clamp(samples[i]) * 32767), 44 + i * 2);
  fs.writeFileSync(path.join(outDir, fileName), buffer);
};

const boomNoise = seededNoise(42);
const boom = render(0.9, (t, L) => {
  const low = Math.sin(2 * Math.PI * (72 - 32 * t / L) * t) * Math.exp(-4.2 * t);
  const mid = Math.sin(2 * Math.PI * (145 - 80 * t / L) * t) * Math.exp(-8 * t) * 0.36;
  const n = boomNoise();
  const click = n * Math.exp(-42 * t) * 0.24;
  return (low + mid + click) * env(t, L, 0.002, 0.3) * 0.95;
});
writeWav('impact-boom-01.wav', boom);

const deadpan = render(0.78, (t, L) => {
  const f = 265 - 155 * (t / L);
  const tone = Math.sign(Math.sin(2 * Math.PI * f * t)) * 0.38;
  const sub = Math.sin(2 * Math.PI * f * 0.5 * t) * 0.18;
  return (tone + sub) * env(t, L, 0.008, 0.22);
});
writeWav('deadpan-drop-01.wav', deadpan);

const horn = render(0.82, (t, L) => {
  const vibrato = 3 * Math.sin(2 * Math.PI * 5.5 * t);
  const f = 232 + vibrato;
  const tone = Math.sin(2 * Math.PI * f * t) * 0.48 + Math.sin(2 * Math.PI * f * 1.25 * t) * 0.28 + Math.sin(2 * Math.PI * f * 1.5 * t) * 0.16;
  return tone * env(t, L, 0.045, 0.2);
});
writeWav('party-horn-01.wav', horn);

const fail = render(0.66, (t, L) => {
  const f = 205 - 125 * (t / L);
  const tone = Math.sign(Math.sin(2 * Math.PI * f * t)) * 0.42 + Math.sin(2 * Math.PI * f * 2 * t) * 0.16;
  return tone * env(t, L, 0.008, 0.16);
});
writeWav('fail-buzzer-01.wav', fail);

const surprise = render(0.7, (t, L) => {
  const f = 180 + 620 * Math.pow(t / L, 1.15);
  const tone = Math.sin(2 * Math.PI * f * t) * 0.44 + Math.sin(2 * Math.PI * f * 2.01 * t) * 0.18;
  const sparkle = Math.sin(2 * Math.PI * 1680 * t) * Math.exp(-8 * t) * 0.15;
  return (tone + sparkle) * env(t, L, 0.01, 0.17);
});
writeWav('surprise-rise-01.wav', surprise);

const notes = [261.63, 329.63, 392, 523.25];
const fanfare = render(1.15, (t, L) => {
  let value = 0;
  const slots = [0, 0.23, 0.46, 0.72];
  for (let i = 0; i < slots.length; i++) {
    const local = t - slots[i];
    if (local < 0 || local > 0.48) continue;
    const f = notes[i];
    value += (Math.sin(2 * Math.PI * f * local) * 0.34 + Math.sin(2 * Math.PI * f * 2 * local) * 0.12) * env(local, 0.48, 0.012, 0.22);
  }
  const sparkle = Math.sin(2 * Math.PI * 1800 * t) * Math.exp(-4.5 * t) * 0.1;
  return value + sparkle;
});
writeWav('victory-fanfare-01.wav', fanfare);

console.log(`created 6 WAV files in ${outDir}`);
