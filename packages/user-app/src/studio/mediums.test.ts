import type { Offering } from "@aquareum/api-client/types";
import { describe, expect, it } from "vitest";

import { describeStudio, studioModes, withdrawnModes } from "./mediums";

const offering = (app: string): Offering => ({ app, modes: ["single-shot"] }) as unknown as Offering;
const network = ["text-to-video", "image-to-video", "text-to-image", "image-edit", "music"].map(offering);

describe("the studio an instance offers", () => {
  it("offers everything the network has when the operator hasn't changed anything", () => {
    expect(withdrawnModes(network, network)).toEqual([]);
    expect(describeStudio(network).map((medium) => medium.kind)).toEqual(["video", "image", "audio"]);
  });

  it("withdraws a mode the network offers but the instance doesn't", () => {
    const offered = network.filter((entry) => entry.app !== "image-edit");
    expect(withdrawnModes(network, offered)).toEqual(["image:edit"]);
    expect(studioModes("image", ["image:edit"]).map((mode) => mode.value)).toEqual(["create"]);
    const image = describeStudio(network, offered).find((medium) => medium.kind === "image");
    expect(image?.modes.map((mode) => mode.value)).toEqual(["create"]);
  });

  it("keeps a mode the network doesn't offer, shown as unavailable", () => {
    const video = describeStudio(network).find((medium) => medium.kind === "video");
    expect(video?.modes.find((mode) => mode.value === "edit")).toMatchObject({ available: false });
  });

  it("drops a medium with every mode withdrawn", () => {
    const offered = network.filter((entry) => entry.app !== "music");
    const studio = describeStudio(network, offered);
    expect(studio.find((medium) => medium.kind === "audio")?.modes.map((mode) => mode.value)).toEqual(["voice"]);
    const noImages = network.filter((entry) => !["text-to-image", "image-edit"].includes(entry.app));
    expect(describeStudio(network, noImages).map((medium) => medium.kind)).toEqual(["video", "audio"]);
  });
});
