package org.livepeer.app.home

import android.graphics.RenderEffect
import android.graphics.RuntimeShader
import android.os.Build
import android.os.PowerManager
import androidx.annotation.RequiresApi
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.Alignment
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.asComposeRenderEffect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import org.livepeer.app.design.rememberMotion
import coil3.compose.AsyncImage
import kotlin.math.cos
import kotlin.math.sin

/**
 * The night sky on Home: the instance's photograph with any coloured glow in it taken out, its stars twinkling,
 * and aurora curtains drawn over it in code. A port of the web's `AuroraSky`
 * (packages/user-app/src/home/aurora-sky.tsx) and of iOS's `Aurora.metal`; keep the three in step. `image` is
 * the photograph, `size` the layer in pixels, `density` pixels per dp, `paper` 1 on the light theme.
 */
private const val AURORA = """
uniform shader image;
uniform float2 size;
uniform float density;
uniform float time;
uniform float paper;

const float EXPOSURE = 0.44;
const float SKY_EXPOSURE = 0.36;
const float AURORA_SPEED = 5.0;
const float AURORA_LIGHT = 0.48;
const int STEPS = 16;
const float BASE = 1.0;
const float SPAN = 2.4;
const float NEAR = 0.9;
const float FAR = 6.2;

float hash(float2 p) { return fract(sin(dot(p, float2(41.3, 289.1))) * 45758.5453); }
float hash1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float noise1(float x) { float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(hash1(i), hash1(i + 1.0), f); }

float glow(float3 c) {
  float lum = dot(c, float3(0.299, 0.587, 0.114));
  float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  return smoothstep(0.05, 0.25, sat) * smoothstep(0.05, 0.3, lum);
}

float fold(float x, float depth, float seed, float at) {
  return depth + 0.75 * sin(x * 0.45 + at * 0.035 + seed) + 0.3 * sin(x * 1.2 - at * 0.05 + seed * 1.7) + 0.5 * (noise1(x * 0.7 + at * 0.02 + seed) - 0.5);
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

float3 at(float2 p) { return image.eval(p).rgb; }

half4 main(float2 position) {
  float t = time * AURORA_SPEED;
  float3 base = at(position);

  // Take the photo's own aurora out, leaving its sky and stars.
  float wide = 6.0 * density;
  float3 around = (at(position + float2(wide, 0)) + at(position - float2(wide, 0)) + at(position + float2(0, wide)) + at(position - float2(0, wide))) * 0.25;
  float photoAurora = glow(around);
  float floorLight = min(base.r, min(base.g, base.b));
  float3 plate = mix(base, floorLight * float3(0.55, 0.7, 1.15) * 0.75, smoothstep(0.0, 0.5, photoAurora));

  // Stars twinkle, each on its own rhythm.
  float near = 1.2 * density;
  float3 close = (at(position + float2(near, 0)) + at(position - float2(near, 0)) + at(position + float2(0, near)) + at(position - float2(0, near))) * 0.25;
  float3 sparkle = max(base - close, 0.0);
  float point = smoothstep(0.04, 0.2, dot(sparkle, float3(0.333))) * (1.0 - photoAurora);
  float2 star = floor(position / (1.4 * density));
  float seed = hash(star);
  float rate = 1.2 + 3.0 * hash(star + 5.3);
  float flicker = sin(time * rate + seed * 6.283) * (0.55 + 0.45 * sin(time * rate * 2.7 + seed * 17.0));
  plate += sparkle * point * flicker * 0.45;

  // The aurora: curtains seen from the ground, tilted to sweep up across the sky. Up is up, as in GL.
  float2 p = float2(position.x - 0.5 * size.x, 0.5 * size.y - position.y) / size.y;
  float tilt = 0.32;
  p = float2x2(cos(tilt), sin(tilt), -sin(tilt), cos(tilt)) * p + float2(0.0, 0.05);
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
        light += emission(pos, a, 3.2, 1.3, t);
        light += emission(pos, a, 5.6, 7.9, t) * 0.28;
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
  return half4(half3(color), 1.0);
}
"""

/**
 * The photograph with a live aurora, as the web's `AuroraSky` draws it. Android 13 and later run the shader;
 * earlier versions, "Remove animations" and Battery Saver keep it still: the dimmed photograph on the dark
 * theme, the pale page on the light. It runs only while the app is in front.
 */
@Composable
fun AuroraSky(url: String, dark: Boolean, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val power = remember(context) { context.getSystemService(PowerManager::class.java) }
    var saving by remember { mutableStateOf(power.isPowerSaveMode) }
    DisposableEffect(power) {
        val receiver = object : android.content.BroadcastReceiver() {
            override fun onReceive(context: android.content.Context?, intent: android.content.Intent?) { saving = power.isPowerSaveMode }
        }
        context.registerReceiver(receiver, android.content.IntentFilter(PowerManager.ACTION_POWER_SAVE_MODE_CHANGED))
        onDispose { context.unregisterReceiver(receiver) }
    }
    val moving = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !rememberMotion().reduce && !saving
    if (moving) {
        LiveSky(url, dark, modifier)
    } else if (dark) {
        // The shader's own exposure, so the still reads as the same sky.
        AsyncImage(url, contentDescription = null, contentScale = ContentScale.Crop, colorFilter = ColorFilter.colorMatrix(ColorMatrix().apply { setToScale(0.44f, 0.44f, 0.44f, 1f) }), modifier = modifier)
    }
}

/** How much smaller than the screen the live sky is drawn. */
private const val RESOLUTION = 2f

@RequiresApi(Build.VERSION_CODES.TIRAMISU)
@Composable
private fun LiveSky(url: String, dark: Boolean, modifier: Modifier) {
    val shader = remember { RuntimeShader(AURORA) }
    val density = LocalDensity.current.density
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    var time by remember { mutableFloatStateOf(0f) }
    // Frames only while the app is in front; the sky picks up where it left off.
    LaunchedEffect(lifecycle) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            val resumedAt = time
            val start = withFrameNanos { it }
            while (true) withFrameNanos { frame -> time = resumedAt + (frame - start) / 1_000_000_000f }
        }
    }
    // Drawn at half resolution and scaled up, as the web caps its pixel ratio: soft curtains don't need the
    // detail, and a phone's GPU has better things to do.
    BoxWithConstraints(modifier.clipToBounds()) {
        AsyncImage(
            url,
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .requiredSize(maxWidth / RESOLUTION, maxHeight / RESOLUTION)
                .align(Alignment.TopStart)
                // Outermost: scale the finished sky up to fill the space.
                .graphicsLayer {
                    transformOrigin = TransformOrigin(0f, 0f)
                    scaleX = RESOLUTION
                    scaleY = RESOLUTION
                }
                .graphicsLayer {
                    shader.setFloatUniform("size", size.width, size.height)
                    shader.setFloatUniform("density", density / RESOLUTION)
                    shader.setFloatUniform("time", time)
                    shader.setFloatUniform("paper", if (dark) 0f else 1f)
                    renderEffect = RenderEffect.createRuntimeShaderEffect(shader, "image").asComposeRenderEffect()
                    clip = true
                }
                // Innermost: the photo drifts very slowly behind the sky, as on the web.
                .graphicsLayer {
                    scaleX = 1.06f
                    scaleY = 1.06f
                    translationX = size.width * 0.022f * sin(time * 0.011f)
                    translationY = size.height * 0.022f * cos(time * 0.008f)
                },
        )
    }
}
