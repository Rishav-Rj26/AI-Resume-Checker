const { computeDiff, serializeResumeSections } = require("../src/services/diffService");

describe("Version Diffing Engine", () => {
  const versionA = {
    label: "V1",
    parsedSections: {
      basics: {
        name: "Taylor Swift",
        title: "Staff Software Engineer",
        email: "taylor@example.com",
        phone: "555-0100",
      },
      summary: "Experienced engineer building distributed systems.",
      experience: [
        {
          role: "Engineer",
          company: "CloudTech",
          period: "2022 - Present",
          bullets: [
            "Worked on the backend microservices.",
            "Helped improve database query latency.",
          ],
        },
      ],
      skills: ["Node.js", "Express", "MongoDB"],
    },
  };

  const versionB = {
    label: "V2",
    parsedSections: {
      basics: {
        name: "Taylor Swift",
        title: "Staff Software Engineer",
        email: "taylor@example.com",
        phone: "555-0100",
      },
      summary: "Experienced engineer building distributed systems.",
      experience: [
        {
          role: "Engineer",
          company: "CloudTech",
          period: "2022 - Present",
          bullets: [
            "Architected high-throughput backend microservices handling 10M requests daily.",
            "Spearheaded database indexing optimization, slashing p99 latency by 55%.",
          ],
        },
      ],
      skills: ["Node.js", "Express", "MongoDB", "Redis", "Docker"],
    },
  };

  it("should serialize resume sections into structured plain text", () => {
    const text = serializeResumeSections(versionA.parsedSections);
    expect(text).toContain("Taylor Swift");
    expect(text).toContain("CloudTech");
    expect(text).toContain("Worked on the backend microservices.");
    expect(text).toContain("Node.js, Express, MongoDB");
  });

  it("should compute word diffs accurately identifying added and removed content", () => {
    const diff = computeDiff(versionA, versionB, "words");
    expect(diff.stats).toBeDefined();
    expect(diff.stats.added).toBeGreaterThan(0);
    expect(diff.stats.removed).toBeGreaterThan(0);
    expect(Array.isArray(diff.parts)).toBe(true);

    const hasAddedPart = diff.parts.some((p) => p.added === true);
    const hasRemovedPart = diff.parts.some((p) => p.removed === true);
    expect(hasAddedPart).toBe(true);
    expect(hasRemovedPart).toBe(true);
  });

  it("should compute line diffs when requested", () => {
    const diff = computeDiff(versionA, versionB, "lines");
    expect(diff.stats).toBeDefined();
    expect(Array.isArray(diff.parts)).toBe(true);
    expect(diff.stats.added).toBeGreaterThan(0);
  });
});
