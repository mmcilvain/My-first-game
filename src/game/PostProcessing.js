import { LinearFilter, Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2, WebGLRenderTarget } from 'three';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D tDiffuse;
  uniform vec2 resolution;
  uniform float time;
  uniform float bloom;
  uniform float vignette;
  uniform float grain;
  uniform float contrast;
  uniform float ao;
  varying vec2 vUv;

  vec3 sampleScene(vec2 uv) { return texture2D(tDiffuse, clamp(uv, 0.001, .999)).rgb; }
  void main() {
    vec2 pixel = 1.0 / resolution;
    vec3 color = sampleScene(vUv);
    if (bloom > .01) {
      vec3 glow = vec3(0.0);
      glow += sampleScene(vUv + vec2(pixel.x * 2.0, 0.0));
      glow += sampleScene(vUv - vec2(pixel.x * 2.0, 0.0));
      glow += sampleScene(vUv + vec2(0.0, pixel.y * 2.0));
      glow += sampleScene(vUv - vec2(0.0, pixel.y * 2.0));
      glow += sampleScene(vUv + pixel * vec2(3.0, 3.0));
      glow += sampleScene(vUv - pixel * vec2(3.0, 3.0));
      glow = max(glow / 6.0 - .54, 0.0) * .48 * bloom;
      color += glow;
    }
    vec2 centered = vUv - .5;
    float edge = smoothstep(.9, .22, dot(centered, centered) * 1.35);
    color *= mix(1.0, edge, vignette);
    if (ao > .01) {
      float contact = texture2D(tDiffuse, vUv + vec2(0.0, pixel.y * 1.5)).r - texture2D(tDiffuse, vUv - vec2(0.0, pixel.y * 1.5)).r;
      color *= 1.0 - max(0.0, -contact) * .12 * ao;
    }
    color = (color - .5) * contrast + .5;
    color *= vec3(1.02, 1.0, .96);
    float sharpen = dot(color - (sampleScene(vUv + vec2(pixel.x, 0.0)) + sampleScene(vUv - vec2(pixel.x, 0.0)) + sampleScene(vUv + vec2(0.0, pixel.y)) + sampleScene(vUv - vec2(0.0, pixel.y))) * .25, vec3(.333));
    color += sharpen * .06;
    float noise = fract(sin(dot(vUv * (time + 1.0), vec2(12.9898,78.233))) * 43758.5453) - .5;
    color += noise * .028 * grain;
    gl_FragColor = vec4(color, 1.0);
  }
`;

export class PostProcessing {
  constructor(renderer, settings = {}) {
    this.renderer = renderer;
    this.settings = { bloom: true, ao: true, grain: true, ...settings };
    this.target = new WebGLRenderTarget(1, 1, { depthBuffer: true, stencilBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter });
    this.target.texture.name = 'BlackoutSceneColor';
    this.scene = new Scene();
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.material = new ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.target.texture },
        resolution: { value: new Vector2(1, 1) },
        time: { value: 0 },
        bloom: { value: 1 },
        vignette: { value: this.settings.mobile ? .12 : .22 },
        grain: { value: .45 },
        contrast: { value: this.settings.mobile ? 1.015 : 1.075 },
        ao: { value: 1 },
      },
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    const plane = new Mesh(new PlaneGeometry(2, 2), this.material);
    this.scene.add(plane);
    this.setSize(1, 1);
  }

  setSize(width, height, scale = 1) {
    const renderWidth = Math.max(1, Math.floor(width * scale));
    const renderHeight = Math.max(1, Math.floor(height * scale));
    this.target.setSize(renderWidth, renderHeight);
    this.material.uniforms.resolution.value.set(renderWidth, renderHeight);
  }

  setSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    this.material.uniforms.bloom.value = this.settings.bloom ? 1 : 0;
    this.material.uniforms.ao.value = this.settings.ao ? 1 : 0;
    this.material.uniforms.grain.value = this.settings.grain ? .45 : 0;
    this.material.uniforms.vignette.value = this.settings.mobile ? .12 : .22;
    this.material.uniforms.contrast.value = this.settings.mobile ? 1.015 : 1.075;
  }

  render(scene, camera, time) {
    this.material.uniforms.time.value = time;
    this.renderer.setRenderTarget(this.target);
    this.renderer.clear();
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.target.dispose();
    this.material.dispose();
    this.scene.traverse((object) => object.geometry?.dispose?.());
  }
}
