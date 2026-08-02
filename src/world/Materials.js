import { DoubleSide, FrontSide, LineBasicMaterial, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, Vector2 } from 'three';
import { createProceduralTextures } from './ProceduralTextures.js';

export function createMaterialLibrary(renderer) {
  const textures = createProceduralTextures(renderer);
  const make = (textureName, options = {}) => {
    const hasTint = options.color !== undefined;
    return new MeshStandardMaterial({
      color: options.color ?? 0xffffff,
      // A dark color map multiplied by a dark tint collapses to near-black in linear lighting.
      // Tinted materials use a neutral detail map instead of multiplying two dark albedos.
      map: hasTint ? textures[textureName].detailMap : textures[textureName].map,
      roughnessMap: textures[textureName].roughnessMap,
      normalMap: textures[textureName].normalMap,
      normalScale: new Vector2(options.normalScale ?? .18, options.normalScale ?? .18),
      roughness: options.roughness ?? .7,
      metalness: options.metalness ?? 0,
      transparent: options.transparent ?? false,
      opacity: options.opacity ?? 1,
      side: options.side ?? FrontSide,
    });
  };

  const glass = new MeshPhysicalMaterial({
    color: 0x87d6cc, map: textures.glass.detailMap, normalMap: textures.glass.normalMap,
    normalScale: new Vector2(.035, .035), roughness: .14, metalness: .08,
    transmission: .18, thickness: .08, transparent: true, opacity: .42,
    clearcoat: .65, clearcoatRoughness: .12, side: DoubleSide,
  });
  const wet = new MeshPhysicalMaterial({
    color: 0x486d68, map: textures.wet.detailMap, roughnessMap: textures.wet.roughnessMap, normalMap: textures.wet.normalMap,
    normalScale: new Vector2(.24, .24), roughness: .16, metalness: .28,
    clearcoat: .72, clearcoatRoughness: .11,
  });
  const materials = {
    concrete: make('concrete', { roughness: .92, normalScale: .28 }),
    concreteDark: make('concrete', { color: 0x697572, roughness: .95, normalScale: .24 }),
    metal: make('metal', { metalness: .72, roughness: .37, normalScale: .08 }),
    metalDark: make('metal', { color: 0x5b7068, metalness: .82, roughness: .32, normalScale: .08 }),
    tile: make('tile', { roughness: .78, normalScale: .18 }),
    militaryPaint: make('paint', { color: 0x718d78, roughness: .68, normalScale: .16 }),
    militaryDark: make('paint', { color: 0x405a50, roughness: .74, normalScale: .15 }),
    glass,
    glassFrame: make('metal', { color: 0x314943, metalness: .6, roughness: .39, normalScale: .08 }),
    wet,
    wood: make('wood', { roughness: .81, normalScale: .22 }),
    fabric: make('fabric', { roughness: .96, normalScale: .22 }),
    rubber: make('rubber', { roughness: .93, normalScale: .15 }),
    warning: make('paint', { color: 0xd17d32, roughness: .5, metalness: .16, normalScale: .12 }),
    hazard: make('paint', { color: 0xa53b2e, roughness: .62, metalness: .08, normalScale: .14 }),
    rust: make('metal', { color: 0x774132, roughness: .64, metalness: .52, normalScale: .12 }),
    trim: make('metal', { color: 0x8ca69c, roughness: .3, metalness: .78, normalScale: .06 }),
    edge: new LineBasicMaterial({ color: 0x71958a, transparent: true, opacity: .34 }),
    panel: make('paint', { color: 0x2d4941, roughness: .54, metalness: .46, normalScale: .1 }),
    screen: new MeshStandardMaterial({ color: 0x9effe3, emissive: 0x28b895, emissiveIntensity: 2.4, roughness: .24, metalness: .08 }),
    cyan: new MeshStandardMaterial({ color: 0x76e8c6, emissive: 0x164d3f, emissiveIntensity: 1.8, roughness: .3, metalness: .15 }),
    amber: new MeshStandardMaterial({ color: 0xffb24d, emissive: 0x80300b, emissiveIntensity: 1.5, roughness: .3 }),
    cyanHot: new MeshStandardMaterial({ color: 0xb7fff0, emissive: 0x2bdbc0, emissiveIntensity: 3.1, roughness: .2, metalness: .08 }),
    amberHot: new MeshStandardMaterial({ color: 0xffd28a, emissive: 0xff6a15, emissiveIntensity: 2.7, roughness: .24, metalness: .06 }),
    puddle: new MeshPhysicalMaterial({ color: 0x152c2e, roughness: .09, metalness: .34, clearcoat: 1, clearcoatRoughness: .08, transparent: true, opacity: .82, depthWrite: false }),
    black: new MeshStandardMaterial({ color: 0x182220, roughness: .65, metalness: .35 }),
    target: make('paint', { color: 0xb99776, roughness: .82, normalScale: .2 }),
    targetAccent: make('paint', { color: 0xb64436, roughness: .62, metalness: .05, normalScale: .12 }),
    decal: new MeshBasicMaterial({ color: 0x111c19, transparent: true, opacity: .72, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
  };
  materials._textures = textures;
  materials.dispose = () => Object.values(materials).forEach((material) => material?.dispose?.());
  return materials;
}
