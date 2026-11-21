import "server-only";

import { writeFileSync } from "node:fs";
import path from "node:path";

import { ConfigError, DEFAULT_CONFIG_FILE, loadConfig, validateConfig, type InstanceConfig, type Surface } from "@aquareum/config";
import type { CapabilityStore } from "@aquareum/api-client";
import type { InstanceSettings } from "@aquareum/operator-console";

import { env } from "../env";
import { cleanLogo } from "./logo";
import { instance } from "../instance";

const root = () => path.join(/* turbopackIgnore: true */ process.cwd(), "../..");

export function configFile(): string {
  return path.resolve(/* turbopackIgnore: true */ root(), env("INSTANCE_CONFIG") || DEFAULT_CONFIG_FILE);
}

export function currentSettings(): { settings: InstanceSettings; file: string | null } {
  const config = instance();
  const overrides: Record<string, string | undefined> = { INSTANCE_CONFIG: env("INSTANCE_CONFIG") };
  const { file } = loadConfig({ cwd: root(), env: overrides });
  return {
    file,
    settings: {
      name: config.name,
      domain: config.domain ?? "",
      signUp: config.auth?.signUp ?? "open",
      surfaces: { app: config.surfaces.app, api: config.surfaces.api, mcp: config.surfaces.mcp, mobile: config.surfaces.mobile ?? false },
      characters: config.content?.characters ?? true,
      adultContent: config.content?.adultContent ?? false,
      retainChats: config.privacy?.retainChats ?? false,
      primaryDark: config.theme?.dark?.primary ?? "",
      primaryLight: config.theme?.light?.primary ?? "",
      logoSymbol: config.logo?.symbol ?? "",
      logoWordmark: config.logo?.wordmark ?? "",
      logoTint: config.logo?.tint ?? true,
    },
  };
}

/** Writes the instance config, validated against the schema first. */
export function saveSettings(settings: InstanceSettings): { ok: true } | { ok: false; error: string } {
  const { engine: _engine, ...current } = instance();
  const theme = {
    ...(settings.primaryDark ? { dark: { ...current.theme?.dark, primary: settings.primaryDark } } : {}),
    ...(settings.primaryLight ? { light: { ...current.theme?.light, primary: settings.primaryLight } } : {}),
  };
  const next: InstanceConfig = {
    ...current,
    name: settings.name.trim(),
    // The console stays as the file has it: it can’t be switched off from inside itself.
    surfaces: { ...settings.surfaces, console: current.surfaces.console },
    auth: { ...current.auth, signUp: settings.signUp },
    content: { ...current.content, characters: settings.characters, adultContent: settings.adultContent },
    privacy: { ...current.privacy, retainChats: settings.retainChats },
  };
  if (settings.domain.trim()) next.domain = settings.domain.trim();
  else delete next.domain;
  if (Object.keys(theme).length > 0) next.theme = theme;
  else delete next.theme;
  const symbol = cleanLogo(settings.logoSymbol);
  if (!symbol.ok) return { ok: false, error: `Symbol: ${symbol.error}` };
  const wordmark = cleanLogo(settings.logoWordmark);
  if (!wordmark.ok) return { ok: false, error: `Wordmark: ${wordmark.error}` };
  if (symbol.value || wordmark.value) {
    next.logo = { ...(symbol.value ? { symbol: symbol.value } : {}), ...(wordmark.value ? { wordmark: wordmark.value } : {}), tint: settings.logoTint };
  } else delete next.logo;
  return writeConfig(next);
}

/** Validates a config against the schema and writes it to the instance's config file. */
function writeConfig(next: InstanceConfig): { ok: true } | { ok: false; error: string } {
  // The engine URL comes from the environment; keep what the file already had, if anything.
  const fileEngine = loadConfig({ cwd: root(), env: { INSTANCE_CONFIG: env("INSTANCE_CONFIG") } }).config.engine;
  if (fileEngine) next.engine = fileEngine;
  else delete next.engine;

  try {
    const valid = validateConfig(next);
    writeFileSync(/* turbopackIgnore: true */ configFile(), `${JSON.stringify(valid, null, 2)}\n`);
    return { ok: true };
  } catch (error) {
    if (error instanceof ConfigError) return { ok: false, error: error.issues.map((issue) => `${issue.path || "config"} ${issue.message}`).join("; ") };
    return { ok: false, error: "The config file couldn't be written. In a container it may be mounted read-only." };
  }
}

/**
 * Each capability's settings, kept in the instance config, where users are served and charged from:
 * switched off is an exact entry in capabilities.block, where it appears is capabilities.overrides[app].surfaces,
 * and its markup is pricing.markup.perApp[app]. A change saved here applies on users' next request.
 */
export function configCapabilityStore(): CapabilityStore {
  return {
    read(app) {
      const { capabilities, pricing } = instance();
      return {
        enabled: !(capabilities?.block ?? []).includes(app),
        markup: pricing?.markup?.perApp?.[app] ?? null,
        surfaces: capabilities?.overrides?.[app]?.surfaces ?? null,
      };
    },
    async write(app, patch) {
      if (patch.markup != null && !(patch.markup >= 1)) throw new Error("A markup can't be less than 1.");
      const { engine: _engine, ...current } = instance();
      const next: InstanceConfig = { ...current };
      if (patch.markup !== undefined) {
        const perApp = { ...current.pricing?.markup?.perApp };
        if (patch.markup === null) delete perApp[app];
        else perApp[app] = patch.markup;
        const { perApp: _previous, ...markupRest } = current.pricing?.markup ?? {};
        next.pricing = { ...current.pricing, markup: { ...markupRest, ...(Object.keys(perApp).length > 0 ? { perApp } : {}) } };
      }
      if (patch.enabled !== undefined || patch.surfaces !== undefined) {
        const capabilities = { ...current.capabilities };
        if (patch.enabled !== undefined) {
          const block = (capabilities.block ?? []).filter((rule) => rule !== app);
          capabilities.block = patch.enabled ? block : [...block, app];
        }
        if (patch.surfaces !== undefined) {
          const overrides = { ...capabilities.overrides };
          const { surfaces: _previous, ...rest } = overrides[app] ?? {};
          const surfaces = patch.surfaces?.filter(isSurface);
          const entry = surfaces ? { ...rest, surfaces } : rest;
          if (Object.keys(entry).length > 0) overrides[app] = entry;
          else delete overrides[app];
          capabilities.overrides = overrides;
        }
        next.capabilities = capabilities;
      }
      const result = writeConfig(next);
      if (!result.ok) throw new Error(result.error);
    },
  };
}

const SURFACES: ReadonlyArray<Surface> = ["chat", "studio", "characters", "library", "live"];
const isSurface = (value: string): value is Surface => (SURFACES as ReadonlyArray<string>).includes(value);
