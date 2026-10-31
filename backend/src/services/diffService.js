const Diff = require("diff");

/**
 * Reconstructs clean readable resume text from parsedSections.
 */
function serializeResumeSections(sections) {
  if (!sections || typeof sections !== "object") return "";
  const lines = [];

  // Basics
  if (sections.basics) {
    const { name, title, email, phone, location, links } = sections.basics;
    if (name) lines.push(name);
    if (title) lines.push(title);
    const contact = [email, phone, location].filter(Boolean).join(" | ");
    if (contact) lines.push(contact);
    if (links && links.length) {
      lines.push(links.map((l) => l.url || l.label).join(" | "));
    }
    lines.push("");
  }

  // Summary
  if (sections.summary) {
    lines.push("SUMMARY");
    lines.push(sections.summary);
    lines.push("");
  }

  // Experience
  if (Array.isArray(sections.experience) && sections.experience.length) {
    lines.push("EXPERIENCE");
    sections.experience.forEach((exp) => {
      lines.push(`${exp.role || "Role"} — ${exp.company || "Company"}${exp.period ? ` (${exp.period})` : ""}`);
      (exp.bullets || []).forEach((b) => lines.push(`• ${b}`));
      lines.push("");
    });
  }

  // Education
  if (Array.isArray(sections.education) && sections.education.length) {
    lines.push("EDUCATION");
    sections.education.forEach((edu) => {
      lines.push(`${edu.degree || "Degree"} — ${edu.school || "School"}${edu.period ? ` (${edu.period})` : ""}`);
    });
    lines.push("");
  }

  // Skills
  if (Array.isArray(sections.skills) && sections.skills.length) {
    lines.push("SKILLS");
    lines.push(sections.skills.join(", "));
    lines.push("");
  }

  // Projects
  if (Array.isArray(sections.projects) && sections.projects.length) {
    lines.push("PROJECTS");
    sections.projects.forEach((p) => {
      lines.push(`${p.name || "Project"}${p.tech?.length ? ` [${p.tech.join(", ")}]` : ""}`);
      if (p.description) lines.push(`• ${p.description}`);
    });
    lines.push("");
  }

  return lines.join("\n").trim();
}

/**
 * Generates diff parts and stats between two versions.
 */
function computeDiff(versionA, versionB, mode = "words") {
  const textA =
    (versionA?.parsedSections ? serializeResumeSections(versionA.parsedSections) : versionA?.rawText) || "";
  const textB =
    (versionB?.parsedSections ? serializeResumeSections(versionB.parsedSections) : versionB?.rawText) || "";

  const diffResult =
    mode === "lines"
      ? Diff.diffLines(textA, textB)
      : Diff.diffWords(textA, textB);

  let addedCount = 0;
  let removedCount = 0;

  const parts = diffResult.map((part) => {
    const item = { value: part.value };
    if (part.added) {
      item.added = true;
      addedCount += part.value.length;
    } else if (part.removed) {
      item.removed = true;
      removedCount += part.value.length;
    }
    return item;
  });

  return {
    stats: {
      added: addedCount,
      removed: removedCount,
    },
    parts,
  };
}

module.exports = {
  computeDiff,
  serializeResumeSections,
};

