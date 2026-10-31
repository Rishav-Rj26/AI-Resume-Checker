const { heuristicAnalyzeResume } = require("../src/services/geminiService");

describe("ATS Scoring & Diagnostics Engine", () => {
  const sampleSections = {
    basics: {
      name: "Morgan Freeman",
      title: "Senior Backend Developer",
      email: "morgan@example.com",
      phone: "(555) 321-4321",
      links: [{ label: "github.com/morgan", url: "https://github.com/morgan" }],
    },
    summary:
      "Backend developer with 6 years experience building scalable web applications and microservices.",
    experience: [
      {
        role: "Senior Backend Developer",
        company: "Nexus Systems",
        period: "2021 - Present",
        bullets: [
          "Worked on payments processing API.",
          "Responsible for database schema design.",
          "Helped with deployment scripts.",
        ],
      },
    ],
    skills: ["Node.js", "Express", "PostgreSQL", "Docker", "Git", "REST APIs"],
  };

  it("should calculate comprehensive ATS score between 0 and 100", () => {
    const analysis = heuristicAnalyzeResume(sampleSections, "", "Senior Backend Developer");
    expect(analysis.atsScore).toBeGreaterThanOrEqual(0);
    expect(analysis.atsScore).toBeLessThanOrEqual(100);
    expect(typeof analysis.summary).toBe("string");
    expect(analysis.summary.length).toBeGreaterThan(20);
  });

  it("should provide 5-pillar score breakdown matching UI expectations", () => {
    const analysis = heuristicAnalyzeResume(sampleSections, "", "Senior Backend Developer");
    expect(analysis.scoreBreakdown.length).toBe(5);

    const labels = analysis.scoreBreakdown.map((b) => b.label);
    expect(labels).toContain("Keywords");
    expect(labels).toContain("Format");
    expect(labels).toContain("Impact");
    expect(labels).toContain("Readability");
    expect(labels).toContain("Action verbs");

    analysis.scoreBreakdown.forEach((pillar) => {
      expect(pillar.value).toBeGreaterThanOrEqual(0);
      expect(pillar.value).toBeLessThanOrEqual(100);
    });
  });

  it("should diagnose weak action verbs and quantify outcomes", () => {
    const analysis = heuristicAnalyzeResume(sampleSections, "", "Senior Backend Developer");
    expect(analysis.issues.length).toBeGreaterThan(0);

    const hasVerbIssue = analysis.issues.some((i) =>
      i.title.toLowerCase().includes("verb") || i.fix.toLowerCase().includes("verb")
    );
    expect(hasVerbIssue).toBe(true);
  });

  it("should generate bullet rewrites applying the Google X-Y-Z formula", () => {
    const analysis = heuristicAnalyzeResume(sampleSections, "", "Senior Backend Developer");
    expect(analysis.bulletRewrites.length).toBeGreaterThan(0);

    const firstRewrite = analysis.bulletRewrites[0];
    expect(firstRewrite._id).toBeDefined();
    expect(firstRewrite.original).toBeDefined();
    expect(firstRewrite.rewritten).toBeDefined();
    expect(firstRewrite.rationale).toBeDefined();
    expect(firstRewrite.rewritten.length).toBeGreaterThan(firstRewrite.original.length);
  });
});

