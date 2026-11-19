"use client";

import { ShaderStill } from "./shader-still";

/**
 * A night sky with a live aurora. The photograph gives the sky, its stars and the horizon; any
 * coloured glow in it is taken out, and aurora curtains are drawn over it in code: thin sheets of
 * light folding between two altitudes, seen from the ground and coloured by height. Stars twinkle,
 * each on its own rhythm.
 */
export interface AuroraSkyProps {
  /** The night-sky photograph. */
  src: string;
  /** The opening frame, sky and stars without the aurora, shown in the dark theme while the shader starts. */
  poster?: string | null;
  className?: string;
}

const FRAGMENT = `
precision highp float;
uniform sampler2D image;
uniform vec2 resolution;
uniform vec2 imageSize;
uniform float time;
uniform float paper;

const float EXPOSURE = 0.44;
// The night sky sits darker than the rest; stars keep their brightness against it.
const float SKY_EXPOSURE = 0.36;
const float AURORA_SPEED = 5.0;
const float AURORA_LIGHT = 0.48;
const int STEPS = 24;
const float BASE = 1.0;
const float SPAN = 2.4;
const float NEAR = 0.9;
const float FAR = 6.2;

float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5453); }
float hash1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float noise1(float x) { float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(hash1(i), hash1(i + 1.0), f); }

float glow(vec3 c) {
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  return smoothstep(0.05, 0.25, sat) * smoothstep(0.05, 0.3, lum);
}

float at;

float fold(float x, float depth, float seed) {
  return depth
    + 0.75 * sin(x * 0.45 + at * 0.035 + seed)
    + 0.3 * sin(x * 1.2 - at * 0.05 + seed * 1.7)
    + 0.5 * (noise1(x * 0.7 + at * 0.02 + seed) - 0.5);
}

vec3 emission(vec3 pos, float a, float depth, float seed) {
  float d = abs(pos.z - fold(pos.x, depth, seed));
  if (d > 0.5) return vec3(0.0);
  float sheet = 0.016 / (0.016 + d * d);
  float rays = noise1(pos.x * 6.0 - at * 0.06 + seed) * 0.6 + noise1(pos.x * 17.0 + at * 0.04 + seed) * 0.4;
  rays = 0.4 + 0.6 * rays * rays;
  float patchy = 0.45 + 0.55 * noise1(pos.x * 0.4 - at * 0.03 + seed * 3.1);
  float reach = 0.2 + 0.55 * noise1(pos.x * 2.2 + seed * 2.3);
  float profile = smoothstep(0.0, 0.03, a) * exp(-a / reach) * (1.0 + 2.0 * exp(-a * 22.0));
  vec3 violetFringe = vec3(0.45, 0.32, 1.0);
  vec3 mint = vec3(0.3, 1.0, 0.62);
  vec3 teal = vec3(0.15, 0.6, 0.9);
  vec3 violet = vec3(0.62, 0.3, 0.95);
  vec3 col = mix(violetFringe, mint, smoothstep(0.0, 0.05, a));
  col = mix(col, teal, smoothstep(0.2, 0.45, a));
  col = mix(col, violet, smoothstep(0.4, 0.85, a));
  return col * sheet * rays * patchy * profile;
}

void main() {
  vec2 frag = gl_FragCoord.xy / resolution;
  vec2 tex = vec2(frag.x, 1.0 - frag.y);
  at = time * AURORA_SPEED;

  // The photo, covering the canvas and drifting very slowly.
  float canvasAspect = resolution.x / resolution.y;
  float imageAspect = imageSize.x / imageSize.y;
  vec2 scale = canvasAspect > imageAspect ? vec2(1.0, imageAspect / canvasAspect) : vec2(canvasAspect / imageAspect, 1.0);
  scale /= 1.06;
  vec2 uv = 0.5 + (tex - 0.5) * scale + 0.022 * vec2(sin(time * 0.011), cos(time * 0.008));
  vec3 base = texture2D(image, uv).rgb;

  // Take the photo's own aurora out, leaving its sky and stars.
  vec2 px = 10.0 / imageSize;
  vec3 wide = (texture2D(image, uv + vec2(px.x, 0.0)).rgb + texture2D(image, uv - vec2(px.x, 0.0)).rgb
             + texture2D(image, uv + vec2(0.0, px.y)).rgb + texture2D(image, uv - vec2(0.0, px.y)).rgb) * 0.25;
  float photoAurora = glow(wide);
  // Keep the sky's own texture and the stars inside the light; only the coloured glow goes.
  float floorLight = min(base.r, min(base.g, base.b));
  vec3 sky = floorLight * vec3(0.55, 0.7, 1.15) * 0.75;
  vec3 plate = mix(base, sky, smoothstep(0.0, 0.5, photoAurora));

  // Stars twinkle, each on its own rhythm.
  vec2 near = 2.5 / imageSize;
  vec3 around = (texture2D(image, uv + vec2(near.x, 0.0)).rgb + texture2D(image, uv - vec2(near.x, 0.0)).rgb
               + texture2D(image, uv + vec2(0.0, near.y)).rgb + texture2D(image, uv - vec2(0.0, near.y)).rgb) * 0.25;
  vec3 sparkle = max(base - around, 0.0);
  float point = smoothstep(0.04, 0.2, dot(sparkle, vec3(0.333))) * (1.0 - photoAurora);
  vec2 star = floor(uv * imageSize / 3.0);
  float seed = hash(star);
  float rate = 1.2 + 3.0 * hash(star + 5.3);
  float flicker = sin(time * rate + seed * 6.283) * (0.55 + 0.45 * sin(time * rate * 2.7 + seed * 17.0));
  plate += sparkle * point * flicker * 0.45;

  // The aurora, drawn: curtains seen from the ground, tilted to sweep up across the sky.
  vec2 p = (gl_FragCoord.xy - 0.5 * resolution) / resolution.y;
  float tilt = 0.32;
  p = mat2(cos(tilt), sin(tilt), -sin(tilt), cos(tilt)) * p + vec2(0.0, 0.05);
  vec3 forward = normalize(vec3(0.0, 0.62, 1.0));
  vec3 right = vec3(1.0, 0.0, 0.0);
  vec3 up = cross(forward, right);
  vec3 rd = normalize(forward + p.x * right * 1.1 + p.y * up * 1.1);
  vec3 light = vec3(0.0);
  if (rd.y > 0.02) {
    float lo = max(BASE, NEAR * rd.y / rd.z);
    float hi = min(BASE + SPAN, FAR * rd.y / rd.z);
    if (hi > lo) {
      float jitter = hash(gl_FragCoord.xy * 0.731);
      for (int i = 0; i < STEPS; i++) {
        float h = mix(lo, hi, (float(i) + jitter) / float(STEPS));
        float a = (h - BASE) / SPAN;
        vec3 pos = rd * (h / rd.y);
        light += emission(pos, a, 3.2, 1.3);
        light += emission(pos, a, 5.6, 7.9) * 0.28;
      }
      light *= 11.0 * (hi - lo) / (SPAN * float(STEPS));
    }
  }
  light = 1.0 - exp(-light * 1.6);

  vec3 stars = sparkle * point;
  // Deepen the darks more than the highlights, so space reads near black and the stars still carry.
  vec3 deep = pow(plate, vec3(1.4));
  vec3 night = deep * SKY_EXPOSURE + stars * (EXPOSURE - SKY_EXPOSURE) + light * AURORA_LIGHT;

  // On a pale page there is no night sky: the same aurora tints a light sky, like watercolour on
  // paper, taking away the colours it isn't.
  vec3 daySky = mix(vec3(0.985, 0.985, 0.99), vec3(0.93, 0.95, 0.985), 1.0 - tex.y);
  float amount = max(light.r, max(light.g, light.b));
  vec3 hue = light / max(amount, 0.001);
  vec3 day = daySky - (vec3(1.0) - hue) * amount * 0.38;

  vec3 color = mix(night, day, paper);
  color += (hash(gl_FragCoord.xy + fract(time)) - 0.5) / 255.0;
  gl_FragColor = vec4(color, 1.0);
}
`;

export function AuroraSky({ src, poster, className }: AuroraSkyProps) {
  return <ShaderStill src={src} fragment={FRAGMENT} stillBrightness={0.44} stillWhileLoading={false} stillInLightTheme={false} {...(poster ? { loadingStill: poster } : {})} {...(className ? { className } : {})} />;
}
