"use client";

import { ShaderStill } from "./shader-still";

/**
 * A photograph brought gently to life: the frame drifts very slowly, the photo's coloured light
 * ripples and breathes, and stars twinkle, while dark sky stays put.
 */
export interface LivingStillProps {
  src: string;
  className?: string;
}

const FRAGMENT = `
precision highp float;
uniform sampler2D image;
uniform vec2 resolution;
uniform vec2 imageSize;
uniform float time;

const float EXPOSURE = 0.74;
const float AURORA_SPEED = 0.4;
const float AURORA_LIGHT = 0.72;

float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

// How much of a pixel is coloured light (the aurora) rather than white stars or dark sky.
float glow(vec3 c) {
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  return smoothstep(0.06, 0.3, sat) * smoothstep(0.06, 0.35, lum);
}

void main() {
  vec2 frag = gl_FragCoord.xy / resolution;
  frag.y = 1.0 - frag.y;

  // Cover the canvas like object-fit: cover, a little larger so the frame can drift.
  float canvasAspect = resolution.x / resolution.y;
  float imageAspect = imageSize.x / imageSize.y;
  vec2 scale = canvasAspect > imageAspect ? vec2(1.0, imageAspect / canvasAspect) : vec2(canvasAspect / imageAspect, 1.0);
  scale /= 1.06;
  vec2 drift = 0.022 * vec2(sin(time * 0.011), cos(time * 0.008));
  vec2 uv = 0.5 + (frag - 0.5) * scale + drift;

  vec3 base = texture2D(image, uv).rgb;
  // Judge the glow from a softened sample, so single stars inside the aurora aren't singled out.
  vec2 px = 6.0 / imageSize;
  vec3 soft = (texture2D(image, uv + vec2(px.x, 0.0)).rgb + texture2D(image, uv - vec2(px.x, 0.0)).rgb
             + texture2D(image, uv + vec2(0.0, px.y)).rgb + texture2D(image, uv - vec2(0.0, px.y)).rgb) * 0.25;
  float mask = glow(soft);

  // The aurora keeps its own, slower clock.
  float at = time * AURORA_SPEED;

  // Curtains sway: slow waves travel sideways along the light, bending it as they pass, and a
  // finer flow keeps it from ever settling.
  float sway = sin(uv.x * 7.0 - at * 0.55 + sin(uv.y * 3.0 + at * 0.2) * 1.5) * 0.018
             + (noise(uv * vec2(4.0, 1.5) + vec2(at * 0.18, 0.0)) - 0.5) * 0.03;
  float lift = (noise(uv * vec2(3.0, 2.0) - vec2(0.0, at * 0.12)) - 0.5) * 0.012;
  vec2 flow = vec2(sway, lift) * mask;
  vec3 moved = texture2D(image, uv + flow).rgb;

  // Rays brighten and fade as they slide along, and broad patches swell and ebb.
  float rays = 0.7 + 0.6 * noise(vec2(uv.x * 26.0 + at * 0.9, uv.y * 0.8 + at * 0.15));
  float breathe = 0.75 + 0.5 * noise(vec2(uv.x * 2.5 - at * 0.18, at * 0.06));
  vec3 color = mix(base, moved * rays * breathe * AURORA_LIGHT, mask);

  // Stars twinkle. A star is a small point brighter than the sky just around it; only that
  // sparkle is modulated, so the sky stays put. Each star keeps its own rhythm, taken from where it
  // sits in the photo, and the light flickers irregularly, the way air makes real stars scintillate.
  vec2 near = 2.5 / imageSize;
  vec3 around = (texture2D(image, uv + vec2(near.x, 0.0)).rgb + texture2D(image, uv - vec2(near.x, 0.0)).rgb
               + texture2D(image, uv + vec2(0.0, near.y)).rgb + texture2D(image, uv - vec2(0.0, near.y)).rgb) * 0.25;
  vec3 sparkle = max(base - around, 0.0);
  float point = smoothstep(0.04, 0.2, dot(sparkle, vec3(0.333))) * (1.0 - mask);
  vec2 star = floor(uv * imageSize / 3.0);
  float seed = hash(star);
  float rate = 1.2 + 3.0 * hash(star + 5.3);
  float flicker = sin(time * rate + seed * 6.283) * (0.55 + 0.45 * sin(time * rate * 2.7 + seed * 17.0));
  vec3 tint = vec3(1.0 + 0.15 * sin(time * rate * 1.3 + seed * 9.0), 1.0, 1.0 + 0.15 * cos(time * rate * 1.1 + seed * 4.0));
  color += sparkle * point * flicker * 0.9 * tint;

  // Exposure: the whole picture a step darker, so it sits quietly behind the page.
  color *= EXPOSURE;

  // Dither by half a step so dark gradients never band.
  color += (hash(gl_FragCoord.xy + fract(time)) - 0.5) / 255.0;
  gl_FragColor = vec4(color, 1.0);
}
`;

export function LivingStill({ src, className }: LivingStillProps) {
  return <ShaderStill src={src} fragment={FRAGMENT} stillBrightness={0.74} {...(className ? { className } : {})} />;
}
