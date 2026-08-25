import { describe, expect, it } from "vitest";
import { channelEpoch, type ChannelItem } from "@/data/channel";
import { toChannelBodies, validateChannelItems } from "../channel";
import { planetScopeId, solarSystemScopeId } from "../galaxy";

const SYSTEM = solarSystemScopeId("channel");

const published: ChannelItem = {
  id: "first-build-log",
  title: "First build log",
  arm: "devlogs",
  publishedAt: "2026-03-04",
  runtimeSeconds: 640,
  url: "https://example.test/first-build-log",
};

const idea: ChannelItem = {
  id: "someday-teardown",
  title: "Someday: a teardown",
  arm: "tutorials",
  publishedAt: "2026-04-01",
};

describe("toChannelBodies", () => {
  it("makes a published item a moon, parented to its arm's planet", () => {
    const [body] = toChannelBodies([published], SYSTEM);
    expect(body.kind).toBe("moon");
    expect(body.parent).toBe(planetScopeId("devlogs"));
    expect(body.links.live).toBe(published.url);
  });

  it("makes an unpublished item a dwarf planet, parented to the system", () => {
    const [body] = toChannelBodies([idea], SYSTEM);
    expect(body.kind).toBe("dwarfPlanet");
    expect(body.parent).toBe(SYSTEM);
    expect(body.links.live).toBeUndefined();
  });

  it("carries runtime through so magnitude can read it", () => {
    expect(toChannelBodies([published], SYSTEM)[0].runtimeSeconds).toBe(640);
  });

  it("ends a trail at the resurfaced date, and at the publish date without one", () => {
    const [plain] = toChannelBodies([published], SYSTEM);
    expect(plain.lastTouchedAt).toBe(published.publishedAt);

    const [revived] = toChannelBodies(
      [{ ...published, resurfacedAt: "2026-06-01" }],
      SYSTEM,
    );
    expect(revived.lastTouchedAt).toBe("2026-06-01");
  });
});

describe("validateChannelItems", () => {
  it("accepts a well-formed set", () => {
    expect(() => validateChannelItems([published, idea])).not.toThrow();
  });

  it("rejects a published item with no runtime", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { runtimeSeconds: _drop, ...noRuntime } = published;
    expect(() => validateChannelItems([noRuntime])).toThrow(/runtimeSeconds/);
  });

  it("rejects an arm the channel does not declare", () => {
    expect(() =>
      validateChannelItems([{ ...idea, arm: "products" }]),
    ).toThrow(/arm "products"/);
  });

  it("rejects a duplicate id", () => {
    expect(() => validateChannelItems([idea, idea])).toThrow(/someday-teardown/);
  });
});

describe("channelEpoch", () => {
  it("is the oldest item's date, so the first item is the origin of time", () => {
    expect(channelEpoch([published, idea])).toBe("2026-03-04");
  });

  it("throws on an empty channel rather than inventing an epoch", () => {
    expect(() => channelEpoch([])).toThrow(/no items/);
  });
});
