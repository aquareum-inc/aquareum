import type { AgentModel, AppModel, Offering } from "@livepeer/api-client/types";

/**
 * How discovered apps read in menus. Discovery gives only an app name, so names and descriptions are
 * read from it; an app this file doesn't know still gets a sensible line from its shape.
 *
 * Two kinds of thing hide behind app names. Most are capabilities (`text-to-image`: what a job
 * does). Some carry a model in the name (`blueclaw/chat/qwen3.8-27b`: the chat capability served
 * by Qwen3.8 27B), which the engine's spec says should become a capability plus a model. Menus keep
 * them apart: the agent picker lists models, the studio picker lists capabilities.
 */
export interface MenuEntry {
  app: string;
  /** Other apps this row stands for, such as more copies of the same model. */
  also?: string[];
  name: string;
  description: string;
  /** No runner is free right now, so a job would queue. */
  busy: boolean;
}

const KNOWN: Record<string, { name: string; description: string }> = {
  "text-to-video": { name: "Text to video", description: "A shot from a description" },
  "image-to-video": { name: "Image to video", description: "Brings a still image to life" },
  "video-to-video": { name: "Video to video", description: "Restyles footage you already have" },
  "text-to-image": { name: "Text to image", description: "A still from a description" },
  "image-edit": { name: "Image edit", description: "Changes part of an image and keeps the rest" },
  "image-to-3d": { name: "Image to 3D", description: "A 3D model from a single image" },
  chat: { name: "Chat", description: "Scripts, shot lists and answers" },
  music: { name: "Music", description: "A score written to your brief" },
  "text-to-speech": { name: "Text to speech", description: "Narration in a natural voice" },
  transcription: { name: "Transcription", description: "Speech to timed text" },
  translation: { name: "Translation", description: "Text into another language" },
  "video-understanding": { name: "Video understanding", description: "Watches a video and answers questions about it" },
  "ffmpeg-extract-frame": { name: "Extract a frame", description: "Pulls a still from any moment of a video" },
  "ffmpeg-metadata": { name: "Media details", description: "Reads a file's length, size and format" },
};

function lastSegment(app: string): string {
  return app.split("/").at(-1) ?? app;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function sentenceCase(text: string): string {
  const words = text.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function fallbackDescription(app: string): string {
  const name = lastSegment(app);
  if (/-understanding$|^transcription$|^translation$|-to-text$|-metadata$|-extract-frame$/.test(name)) return "Reads your media and reports back";
  if (/(^|-)video$/.test(name)) return "Makes video from your request";
  if (/(^|-)3d$/.test(name)) return "Makes a 3D model from your request";
  if (/image|^flux|^sd/.test(name)) return "Makes images from your request";
  if (/speech|music|audio/.test(name)) return "Makes sound from your request";
  return "Writes and answers";
}

/** One entry per app: discovery can list an app once per pricing unit. Busy only if no listing has a runner free. */
function dedupe(entries: MenuEntry[]): MenuEntry[] {
  const seen = new Map<string, MenuEntry>();
  for (const entry of entries) {
    const earlier = seen.get(entry.app);
    seen.set(entry.app, earlier ? { ...earlier, busy: earlier.busy && entry.busy } : entry);
  }
  return [...seen.values()];
}

/** A language model named in an app: `<owner>/chat/<model>`. Plain `chat` names no model. */
const LANGUAGE_MODEL = /(^|\/)chat\/[^/]+$/;

/** "qwen3.8-27b" → "Qwen3.8 27B": words split, first letter up, parameter counts in capitals. */
export function modelName(segment: string): string {
  return sentenceCase(segment).replace(/\b(\d+(?:\.\d+)?)([bmk])\b/gi, (_match, size: string, unit: string) => `${size}${unit.toUpperCase()}`);
}

/** Model names whose id doesn't read well on its own. Keys are the id's last part, lowercased. */
const MODEL_NAMES: Record<string, string> = {
  "sd-turbo": "SD Turbo",
  "ace-step1.5": "ACE-Step 1.5",
};

/**
 * A model's readable name from the id its runners report: "black-forest-labs/FLUX.2-klein-4B" →
 * "FLUX.2 klein 4B", "qwen3.8-27b" → "Qwen3.8 27B". An id that already has capitals keeps them.
 */
export function modelLabel(id: string): string {
  const segment = lastSegment(id);
  const named = MODEL_NAMES[segment.toLowerCase()];
  if (named) return named;
  return /[A-Z]/.test(segment) ? segment.replace(/[_-]+/g, " ").trim() : modelName(segment);
}

/**
 * Some models do one narrow job under a broad capability name. Their rows say what they do, so
 * nobody expects general image editing from a background remover. Keys are model labels, lowercased.
 */
const MODEL_ROLES: Record<string, { name: string; description: string }> = {
  birefnet: { name: "Remove background", description: "Cuts the subject out of an image" },
};

/** The readable name of any discovered app: a language model by its name, a capability by what it does. */
export function appName(app: string, model?: AppModel): string {
  if (LANGUAGE_MODEL.test(app)) return model ? modelLabel(model.model) : modelName(lastSegment(app));
  const role = model ? MODEL_ROLES[modelLabel(model.model).toLowerCase()] : undefined;
  return role?.name ?? (KNOWN[app] ?? KNOWN[lastSegment(app)])?.name ?? sentenceCase(lastSegment(app));
}

/**
 * How an app reads where it did a piece of work, as in the agent's steps: what it is, and the
 * model that did it when known ("Text to image · FLUX.2 klein 4B"). A language model is named once.
 */
export function workLabel(app: string, model?: AppModel): string {
  const name = appName(app, model);
  if (!model || LANGUAGE_MODEL.test(app)) return name;
  return `${name} · ${model.model.split(" or ").map(modelLabel).join(" or ")}`;
}

/** A capability as a menu row, naming the model that does the work when its runners say. */
export function capabilityEntry(offering: Offering, model?: AppModel): MenuEntry {
  const known = KNOWN[offering.app] ?? KNOWN[lastSegment(offering.app)];
  const role = model ? MODEL_ROLES[modelLabel(model.model).toLowerCase()] : undefined;
  const description = role?.description ?? known?.description ?? fallbackDescription(offering.app);
  return {
    app: offering.app,
    name: appName(offering.app, model),
    description: model ? `${description} · ${model.model.split(" or ").map(modelLabel).join(" or ")}` : description,
    busy: offering.ready_count === 0,
  };
}

export function capabilityEntries(offerings: ReadonlyArray<Offering>, models: ReadonlyArray<AppModel> = []): MenuEntry[] {
  const byApp = new Map(models.map((model) => [model.app, model]));
  return dedupe(offerings.map((offering) => capabilityEntry(offering, byApp.get(offering.app))));
}

/** "131072" → "128K context": how much a model can read at once, in the units people quote. */
export function contextLabel(tokens: number): string {
  return tokens >= 1024 ? `${Math.round(tokens / 1024)}K context` : `${tokens} tokens of context`;
}

/** One deployment of a model: an app that serves it. */
interface Deployment {
  app: string;
  name: string;
  context: number | null;
  busy: boolean;
}

/** The copy to send to: one with a runner free, then the most context. */
function better(a: Deployment, b: Deployment): Deployment {
  if (a.busy !== b.busy) return a.busy ? b : a;
  return (b.context ?? 0) > (a.context ?? 0) ? b : a;
}

/**
 * The language models that can run the agent, one row per model. When several apps serve the same
 * model, the row sends to the best of them (`better`) and lists the others in `also`, so choosing a
 * model never means choosing a deployment.
 */
export function agentModelEntries(models: ReadonlyArray<AgentModel>): MenuEntry[] {
  const groups = new Map<string, Deployment[]>();
  for (const model of models) {
    const name = modelLabel(model.model);
    const group = groups.get(name.toLowerCase()) ?? [];
    group.push({ app: model.app, name, context: model.context_tokens, busy: model.busy });
    groups.set(name.toLowerCase(), group);
  }
  return [...groups.values()].map((group) => {
    const best = group.reduce(better);
    const contexts = group.flatMap((entry) => (entry.context === null ? [] : [entry.context]));
    const widest = contexts.length > 0 ? Math.max(...contexts) : null;
    // What sets this model apart. Who runs it is plumbing people don't need to see.
    return {
      app: best.app,
      also: group.filter((entry) => entry.app !== best.app).map((entry) => entry.app),
      name: best.name,
      description: widest ? capitalise(group.length > 1 ? `Up to ${contextLabel(widest)}` : contextLabel(widest)) : "Plans and writes your jobs",
      busy: group.every((entry) => entry.busy),
    };
  });
}
