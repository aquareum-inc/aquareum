"use client";

import { cn } from "@aquareum/ui";
import { useEffect, useRef, useState } from "react";

/**
 * A photograph drawn through a fragment shader. The still renders straight away; once WebGL has it,
 * a canvas takes over and runs the shader every frame. Visitors who prefer reduced motion, and
 * browsers without WebGL, keep the still. Pauses when hidden or scrolled away.
 *
 * The shader gets `image` (the photo), `resolution` and `imageSize` in pixels, `time` in seconds,
 * and `paper`: 1 in the light theme, 0 in the dark.
 */
export interface ShaderStillProps {
  src: string;
  fragment: string;
  /** Brightness of the still, matching the shader's exposure. */
  stillBrightness?: number;
  /**
   * Show the still while the canvas starts. Leave on when the shader only animates the photo; turn
   * off when it changes what the photo shows, so the page opens on dark sky and the live picture
   * fades in instead of replacing a different one. The still is shown either way when motion is
   * reduced or WebGL can't run.
   */
  stillWhileLoading?: boolean;
  /** Show the still in the light theme. Off for a night photo that only suits the dark theme. */
  stillInLightTheme?: boolean;
  /**
   * A frame of the shader's own picture, shown in the dark theme while the canvas starts, so the live
   * picture takes over without a step. Used with `stillWhileLoading` off.
   */
  loadingStill?: string;
  className?: string;
}

const VERTEX = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

const MAX_PIXEL_RATIO = 1.5;

export function ShaderStill({ src, fragment: fragmentSource, stillBrightness = 1, stillWhileLoading = true, stillInLightTheme = true, loadingStill, className }: ShaderStillProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotion.matches) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    const vertex = gl && compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = gl && compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl?.createProgram();
    if (!gl || !vertex || !fragment || !program) {
      setFailed(true);
      return;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setFailed(true);
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const resolution = gl.getUniformLocation(program, "resolution");
    const imageSize = gl.getUniformLocation(program, "imageSize");
    const time = gl.getUniformLocation(program, "time");
    const paper = gl.getUniformLocation(program, "paper");
    const texture = gl.createTexture();

    let frame = 0;
    let visible = true;
    let ready = false;
    let cancelled = false;
    const started = performance.now();
    // Start somewhere in the slow cycle, so each visit opens on a different moment.
    const offset = (Date.now() / 1000) % 10_000;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      gl.uniform2f(resolution, width, height);
    };

    const loop = (now: number) => {
      resize();
      gl.uniform1f(time, offset + (now - started) / 1000);
      // 1 in the light theme, so a shader can draw for a pale page instead of a dark one.
      gl.uniform1f(paper, document.documentElement.dataset.theme === "light" ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      frame = requestAnimationFrame(loop);
    };

    const run = () => {
      cancelAnimationFrame(frame);
      if (ready && visible && document.visibilityState === "visible") frame = requestAnimationFrame(loop);
    };

    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (cancelled) return;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
      gl.uniform2f(imageSize, image.naturalWidth, image.naturalHeight);
      ready = true;
      setLive(true);
      run();
    };
    image.src = src;

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      run();
    });
    observer.observe(canvas);
    document.addEventListener("visibilitychange", run);
    const stopForReducedMotion = () => {
      if (!reduceMotion.matches) return;
      cancelAnimationFrame(frame);
      setLive(false);
    };
    reduceMotion.addEventListener("change", stopForReducedMotion);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", run);
      reduceMotion.removeEventListener("change", stopForReducedMotion);
      // Free what this run made but keep the context: the canvas may be mounted again.
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, [src, fragmentSource]);

  return (
    <div className={cn("absolute inset-0", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- the still, shown at once and kept for reduced motion */}
      <img
        src={src}
        alt=""
        fetchPriority="high"
        className={cn(
          "absolute inset-0 size-full scale-[1.06] object-cover",
          !stillWhileLoading && !failed && "opacity-0 motion-reduce:opacity-100",
          !stillInLightTheme && "light:hidden",
        )}
        style={{ filter: `brightness(${stillBrightness})` }}
      />
      {loadingStill && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- painted before the canvas can start
        <img src={loadingStill} alt="" fetchPriority="high" className="absolute inset-0 size-full scale-[1.06] object-cover light:hidden motion-reduce:hidden" />
      ) : null}
      <canvas
        ref={canvasRef}
        className={cn("absolute inset-0 size-full transition-opacity duration-700 ease-out-expo", live ? "opacity-100" : "opacity-0")}
      />
    </div>
  );
}
