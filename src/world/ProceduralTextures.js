import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, SRGBColorSpace } from 'three';

const textureCache = new Map();

function hashNoise(x, y, seed) {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function configureTexture(texture, repeat = 1, anisotropy = 4, color = false) {
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = anisotropy;
  if (color) texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeCanvas(size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function applyPixelNoise(ctx, size, seed, amount = .15) {
  const image = ctx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const variation = 1 + (hashNoise(x * .9, y * .9, seed) - .5) * amount;
      image.data[index] = Math.min(255, Math.max(0, image.data[index] * variation));
      image.data[index + 1] = Math.min(255, Math.max(0, image.data[index + 1] * variation));
      image.data[index + 2] = Math.min(255, Math.max(0, image.data[index + 2] * variation));
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

function drawNormalDetail(ctx, size, seed, strength = 2.3) {
  const image = ctx.createImageData(size, size);
  const sample = (sampleX, sampleY) => {
    let value = 0;
    let amplitude = 1;
    let frequency = .035;
    for (let octave = 0; octave < 3; octave += 1) {
      value += hashNoise(sampleX * frequency, sampleY * frequency, seed + octave * 7.13) * amplitude;
      amplitude *= .5;
      frequency *= 2.1;
    }
    return value;
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const left = sample(x - 1, y);
      const right = sample(x + 1, y);
      const down = sample(x, y - 1);
      const up = sample(x, y + 1);
      const index = (y * size + x) * 4;
      image.data[index] = Math.min(255, Math.max(0, 128 - (right - left) * 255 * strength));
      image.data[index + 1] = Math.min(255, Math.max(0, 128 - (up - down) * 255 * strength));
      image.data[index + 2] = 255;
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

function paintPattern(ctx, kind, size, base, seed) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  if (kind === 'concrete') {
    ctx.strokeStyle = 'rgba(20,28,27,.45)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i += 1) {
      const startX = hashNoise(i, 2, seed) * size;
      ctx.beginPath();
      ctx.moveTo(startX, 0);
      ctx.lineTo(startX + (hashNoise(i, 4, seed) - .5) * 18, size);
      ctx.stroke();
    }
  } else if (kind === 'metal') {
    ctx.fillStyle = 'rgba(210,225,220,.08)';
    for (let y = 0; y < size; y += 6) ctx.fillRect(0, y, size, 1);
    ctx.strokeStyle = 'rgba(0,0,0,.24)';
    for (let i = 0; i < 22; i += 1) {
      const x = hashNoise(i, 1, seed) * size;
      ctx.beginPath(); ctx.moveTo(x, hashNoise(i, 2, seed) * size); ctx.lineTo(x + 8, hashNoise(i, 3, seed) * size); ctx.stroke();
    }
  } else if (kind === 'tile') {
    ctx.strokeStyle = 'rgba(20,24,23,.55)';
    ctx.lineWidth = 3;
    for (let p = 0; p <= size; p += 32) { ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(214,224,215,.12)';
    ctx.lineWidth = 1;
    for (let p = 3; p < size; p += 32) { ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke(); }
  } else if (kind === 'paint') {
    ctx.fillStyle = 'rgba(207,224,212,.08)';
    for (let i = 0; i < 9; i += 1) { ctx.fillRect(hashNoise(i, 5, seed) * size, 0, 2, size); }
    ctx.fillStyle = 'rgba(13,24,22,.28)';
    ctx.fillRect(0, size * .76, size, 3);
  } else if (kind === 'glass') {
    ctx.strokeStyle = 'rgba(223,255,244,.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i += 1) { ctx.beginPath(); ctx.moveTo(hashNoise(i, 1, seed) * size, 0); ctx.lineTo(hashNoise(i, 2, seed) * size, size); ctx.stroke(); }
  } else if (kind === 'wood') {
    ctx.strokeStyle = 'rgba(72,37,21,.45)';
    for (let y = 5; y < size; y += 13) { ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(size * .3, y - 4, size * .7, y + 4, size, y - 2); ctx.stroke(); }
  } else if (kind === 'fabric') {
    ctx.strokeStyle = 'rgba(228,244,232,.07)';
    for (let p = 0; p < size; p += 4) { ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke(); }
  }

  applyPixelNoise(ctx, size, seed, kind === 'glass' ? .06 : kind === 'metal' ? .2 : .16);
}

function makeMaps(name, options) {
  if (textureCache.has(name)) return textureCache.get(name);
  const size = 128;
  const colorCanvas = makeCanvas(size);
  const detailCanvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);
  const normalCanvas = makeCanvas(size);
  const colorContext = colorCanvas.getContext('2d');
  const detailContext = detailCanvas.getContext('2d');
  const roughContext = roughCanvas.getContext('2d');
  const normalContext = normalCanvas.getContext('2d');
  paintPattern(colorContext, options.kind, size, options.base, options.seed);
  detailContext.fillStyle = '#d9dedb';
  detailContext.fillRect(0, 0, size, size);
  applyPixelNoise(detailContext, size, options.seed + 2, .12);
  roughContext.fillStyle = `rgb(${Math.round(options.roughness * 255)}, ${Math.round(options.roughness * 255)}, ${Math.round(options.roughness * 255)})`;
  roughContext.fillRect(0, 0, size, size);
  applyPixelNoise(roughContext, size, options.seed + 4, .18);
  normalContext.fillStyle = '#8080ff';
  normalContext.fillRect(0, 0, size, size);
  drawNormalDetail(normalContext, size, options.seed + 9, options.kind === 'metal' ? 1.7 : 2.35);

  const maps = {
    map: configureTexture(new CanvasTexture(colorCanvas), options.repeat, options.anisotropy, true),
    detailMap: configureTexture(new CanvasTexture(detailCanvas), options.repeat, options.anisotropy, true),
    roughnessMap: configureTexture(new CanvasTexture(roughCanvas), options.repeat, options.anisotropy),
    normalMap: configureTexture(new CanvasTexture(normalCanvas), options.repeat, options.anisotropy),
  };
  maps.normalMap.colorSpace = NoColorSpace;
  textureCache.set(name, maps);
  return maps;
}

export function createProceduralTextures(renderer) {
  const anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 4;
  const definitions = {
    concrete: { kind: 'concrete', base: '#4f5a57', roughness: .88, repeat: 3, seed: 11 },
    metal: { kind: 'metal', base: '#34423f', roughness: .42, repeat: 2, seed: 18 },
    tile: { kind: 'tile', base: '#68736d', roughness: .78, repeat: 4, seed: 29 },
    paint: { kind: 'paint', base: '#263b35', roughness: .61, repeat: 2, seed: 37 },
    glass: { kind: 'glass', base: '#769893', roughness: .12, repeat: 2, seed: 46 },
    wet: { kind: 'concrete', base: '#273a38', roughness: .2, repeat: 4, seed: 53 },
    wood: { kind: 'wood', base: '#6d4b31', roughness: .76, repeat: 3, seed: 64 },
    fabric: { kind: 'fabric', base: '#303a37', roughness: .94, repeat: 4, seed: 71 },
    rubber: { kind: 'fabric', base: '#151c1b', roughness: .9, repeat: 3, seed: 82 },
  };
  const result = {};
  for (const [name, definition] of Object.entries(definitions)) {
    result[name] = makeMaps(name, { ...definition, anisotropy });
    result[name].map.anisotropy = Math.min(anisotropy, 8);
    result[name].detailMap.anisotropy = Math.min(anisotropy, 8);
    result[name].roughnessMap.anisotropy = Math.min(anisotropy, 8);
    result[name].normalMap.anisotropy = Math.min(anisotropy, 8);
  }
  return result;
}

export function disposeProceduralTextures() {
  for (const maps of textureCache.values()) Object.values(maps).forEach((texture) => texture.dispose());
  textureCache.clear();
}
