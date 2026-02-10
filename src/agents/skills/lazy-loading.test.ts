import type { Skill } from "@mariozechner/pi-coding-agent";
import { describe, expect, it } from "vitest";
import type { SkillEntry } from "./types.js";
import {
  buildCompactSkillIndex,
  buildLazySkillSnapshot,
  resolveLazySkillLoadingConfig,
  resolveSkillContent,
} from "./lazy-loading.js";

function makeSkillEntry(name: string, description: string, content = ""): SkillEntry {
  return {
    skill: {
      name,
      description,
      content,
      filePath: `/skills/${name}/SKILL.md`,
      baseDir: `/skills/${name}`,
    } as Skill,
    frontmatter: {},
    metadata: {},
    invocation: {},
  };
}

describe("resolveLazySkillLoadingConfig", () => {
  it("defaults to disabled", () => {
    expect(resolveLazySkillLoadingConfig().enabled).toBe(false);
    expect(resolveLazySkillLoadingConfig({}).enabled).toBe(false);
  });

  it("respects explicit config", () => {
    expect(
      resolveLazySkillLoadingConfig({
        agents: { defaults: { skills: { lazyLoading: true } } },
      } as never).enabled,
    ).toBe(true);
  });
});

describe("buildCompactSkillIndex", () => {
  it("returns empty string for no skills", () => {
    expect(buildCompactSkillIndex([])).toBe("");
  });

  it("builds compact index with name and description", () => {
    const entries = [
      makeSkillEntry("weather", "Get weather forecasts"),
      makeSkillEntry("github", "Manage GitHub issues and PRs"),
    ];
    const result = buildCompactSkillIndex(entries);
    expect(result).toContain("**weather**: Get weather forecasts");
    expect(result).toContain("**github**: Manage GitHub issues and PRs");
    expect(result).toContain("load_skill");
  });

  it("is significantly smaller than full skill content", () => {
    const longContent = "x".repeat(5000);
    const entries = [
      makeSkillEntry("skill1", "Short description", longContent),
      makeSkillEntry("skill2", "Another skill", longContent),
      makeSkillEntry("skill3", "Third skill", longContent),
    ];
    const compactIndex = buildCompactSkillIndex(entries);
    const fullContent = entries.map((e) => e.skill.content).join("\n");
    expect(compactIndex.length).toBeLessThan(fullContent.length * 0.1);
  });
});

describe("resolveSkillContent", () => {
  const skills: Skill[] = [
    {
      name: "weather",
      description: "Get weather",
      content: "Full weather skill content here...",
      filePath: "/skills/weather/SKILL.md",
      baseDir: "/skills/weather",
    } as Skill,
    {
      name: "github",
      description: "GitHub integration",
      content: "Full GitHub skill content here...",
      filePath: "/skills/github/SKILL.md",
      baseDir: "/skills/github",
    } as Skill,
  ];

  it("returns full content for matching skill", () => {
    const result = resolveSkillContent("weather", skills);
    expect(result.found).toBe(true);
    expect(result.content).toBe("Full weather skill content here...");
  });

  it("is case-insensitive", () => {
    const result = resolveSkillContent("Weather", skills);
    expect(result.found).toBe(true);
  });

  it("returns error for unknown skill", () => {
    const result = resolveSkillContent("unknown", skills);
    expect(result.found).toBe(false);
    expect(result.content).toContain("not found");
    expect(result.content).toContain("weather");
    expect(result.content).toContain("github");
  });

  it("returns error for empty skills", () => {
    const result = resolveSkillContent("test", []);
    expect(result.found).toBe(false);
  });
});

describe("buildLazySkillSnapshot", () => {
  it("creates snapshot with compact prompt", () => {
    const entries = [makeSkillEntry("weather", "Get weather")];
    const resolvedSkills = entries.map((e) => e.skill);
    const snapshot = buildLazySkillSnapshot({
      entries,
      resolvedSkills,
      snapshotVersion: 1,
    });

    expect(snapshot.prompt).toContain("weather");
    expect(snapshot.prompt).toContain("load_skill");
    expect(snapshot.resolvedSkills).toHaveLength(1);
    expect(snapshot.version).toBe(1);
  });
});
