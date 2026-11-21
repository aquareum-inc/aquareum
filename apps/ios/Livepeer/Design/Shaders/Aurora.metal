// The night sky on Home: the instance's photograph with any coloured glow in it taken out, its stars
// twinkling, and aurora curtains drawn over it in code. A port of the web's `AuroraSky`
// (packages/user-app/src/home/aurora-sky.tsx); keep the two in step.

#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>
using namespace metal;

namespace aurora {

constant float EXPOSURE = 0.44;
constant float SKY_EXPOSURE = 0.36;
constant float AURORA_SPEED = 5.0;
constant float AURORA_LIGHT = 0.48;
// Fewer steps than the web's 24: a phone draws more pixels with less to spare.
constant int STEPS = 16;
constant float BASE = 1.0;
constant float SPAN = 2.4;
constant float NEAR = 0.9;
constant float FAR = 6.2;

float hash(float2 p) { return fract(sin(dot(p, float2(41.3, 289.1))) * 45758.5453); }
float hash1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float noise1(float x) { float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(hash1(i), hash1(i + 1.0), f); }

float glow(float3 c) {
    float lum = dot(c, float3(0.299, 0.587, 0.114));
    float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    return smoothstep(0.05, 0.25, sat) * smoothstep(0.05, 0.3, lum);
}

float fold(float x, float depth, float seed, float at) {
    return depth
        + 0.75 * sin(x * 0.45 + at * 0.035 + seed)
        + 0.3 * sin(x * 1.2 - at * 0.05 + seed * 1.7)
        + 0.5 * (noise1(x * 0.7 + at * 0.02 + seed) - 0.5);
}

float3 emission(float3 pos, float a, float depth, float seed, float at) {
    float d = abs(pos.z - fold(pos.x, depth, seed, at));
    if (d > 0.5) return float3(0.0);
    float sheet = 0.016 / (0.016 + d * d);
    float rays = noise1(pos.x * 6.0 - at * 0.06 + seed) * 0.6 + noise1(pos.x * 17.0 + at * 0.04 + seed) * 0.4;
    rays = 0.4 + 0.6 * rays * rays;
    float patchy = 0.45 + 0.55 * noise1(pos.x * 0.4 - at * 0.03 + seed * 3.1);
    float reach = 0.2 + 0.55 * noise1(pos.x * 2.2 + seed * 2.3);
    float profile = smoothstep(0.0, 0.03, a) * exp(-a / reach) * (1.0 + 2.0 * exp(-a * 22.0));
    float3 col = mix(float3(0.45, 0.32, 1.0), float3(0.3, 1.0, 0.62), smoothstep(0.0, 0.05, a));
    col = mix(col, float3(0.15, 0.6, 0.9), smoothstep(0.2, 0.45, a));
    col = mix(col, float3(0.62, 0.3, 0.95), smoothstep(0.4, 0.85, a));
    return col * sheet * rays * patchy * profile;
}

float3 sample(SwiftUI::Layer layer, float2 at) { return float3(layer.sample(at).rgb); }

} // namespace aurora

/// `size` is the layer in points, `time` in seconds, `paper` 1 on the light theme and 0 on the dark.
[[ stitchable ]] half4 auroraSky(float2 position, SwiftUI::Layer layer, float2 size, float time, float paper) {
    using namespace aurora;
    float at = time * AURORA_SPEED;
    float3 base = sample(layer, position);

    // Take the photo's own aurora out, leaving its sky and stars.
    float wide = 6.0;
    float3 around = (sample(layer, position + float2(wide, 0)) + sample(layer, position - float2(wide, 0))
                   + sample(layer, position + float2(0, wide)) + sample(layer, position - float2(0, wide))) * 0.25;
    float photoAurora = glow(around);
    float floorLight = min(base.r, min(base.g, base.b));
    float3 plate = mix(base, floorLight * float3(0.55, 0.7, 1.15) * 0.75, smoothstep(0.0, 0.5, photoAurora));

    // Stars twinkle, each on its own rhythm.
    float near = 1.2;
    float3 close = (sample(layer, position + float2(near, 0)) + sample(layer, position - float2(near, 0))
                  + sample(layer, position + float2(0, near)) + sample(layer, position - float2(0, near))) * 0.25;
    float3 sparkle = max(base - close, 0.0);
    float point = smoothstep(0.04, 0.2, dot(sparkle, float3(0.333))) * (1.0 - photoAurora);
    float2 star = floor(position / 1.4);
    float seed = hash(star);
    float rate = 1.2 + 3.0 * hash(star + 5.3);
    float flicker = sin(time * rate + seed * 6.283) * (0.55 + 0.45 * sin(time * rate * 2.7 + seed * 17.0));
    plate += sparkle * point * flicker * 0.45;

    // The aurora: curtains seen from the ground, tilted to sweep up across the sky. Up is up, as in GL.
    float2 p = float2(position.x - 0.5 * size.x, 0.5 * size.y - position.y) / size.y;
    float tilt = 0.32;
    p = float2x2(float2(cos(tilt), sin(tilt)), float2(-sin(tilt), cos(tilt))) * p + float2(0.0, 0.05);
    float3 forward = normalize(float3(0.0, 0.62, 1.0));
    float3 right = float3(1.0, 0.0, 0.0);
    float3 up = cross(forward, right);
    float3 rd = normalize(forward + p.x * right * 1.1 + p.y * up * 1.1);
    float3 light = float3(0.0);
    if (rd.y > 0.02) {
        float lo = max(BASE, NEAR * rd.y / rd.z);
        float hi = min(BASE + SPAN, FAR * rd.y / rd.z);
        if (hi > lo) {
            float jitter = hash(position * 0.731);
            for (int i = 0; i < STEPS; i++) {
                float h = mix(lo, hi, (float(i) + jitter) / float(STEPS));
                float a = (h - BASE) / SPAN;
                float3 pos = rd * (h / rd.y);
                light += emission(pos, a, 3.2, 1.3, at);
                light += emission(pos, a, 5.6, 7.9, at) * 0.28;
            }
            light *= 11.0 * (hi - lo) / (SPAN * float(STEPS));
        }
    }
    light = 1.0 - exp(-light * 1.6);

    float3 night = pow(plate, float3(1.4)) * SKY_EXPOSURE + sparkle * point * (EXPOSURE - SKY_EXPOSURE) + light * AURORA_LIGHT;

    // On a pale page there is no night sky: the same aurora tints a light sky, like watercolour on paper.
    float3 daySky = mix(float3(0.985, 0.985, 0.99), float3(0.93, 0.95, 0.985), 1.0 - position.y / size.y);
    float amount = max(light.r, max(light.g, light.b));
    float3 day = daySky - (float3(1.0) - light / max(amount, 0.001)) * amount * 0.38;

    float3 color = mix(night, day, paper);
    color += (hash(position + fract(time)) - 0.5) / 255.0;
    return half4(half3(color), 1.0h);
}
