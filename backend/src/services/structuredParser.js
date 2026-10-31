const { GoogleGenerativeAI } = require("@google/generative-ai");
const env = require("../config/env");

/**
 * Common tech skills for heuristic fallback extractor
 */
const KNOWN_SKILLS = [
  "JavaScript", "TypeScript", "React", "Next.js", "Vue", "Angular", "HTML", "CSS", "Tailwind",
  "Node.js", "Express", "Python", "Django", "FastAPI", "Java", "Spring", "C#", ".NET", "C++",
  "Go", "Rust", "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "GraphQL", "REST",
  "AWS", "GCP", "Azure", "Docker", "Kubernetes", "CI/CD", "Git", "GitHub", "Linux",
  "Vite", "Webpack", "Jest", "Playwright", "Cypress", "Terraform", "Kafka"
];

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Intelligent regex and heuristic resume parser fallback
 * Ensures upload never crashes if the AI model is temporarily rate-limited.
 */
function heuristicParseResume(rawText) {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = rawText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const githubMatch = rawText.match(/github\.com\/[a-zA-Z0-9_-]+/i);
  const linkedinMatch = rawText.match(/linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);

  const links = [];
  if (githubMatch) links.push({ label: githubMatch[0], url: `https://${githubMatch[0]}` });
  if (linkedinMatch) links.push({ label: linkedinMatch[0], url: `https://${linkedinMatch[0]}` });

  // Infer name and title from top lines
  let name = lines[0] || "Candidate";
  if (name.length > 50) name = name.slice(0, 50);

  let title = "";
  if (lines[1] && !lines[1].includes("@") && !lines[1].match(/\d{3}/)) {
    title = lines[1].slice(0, 80);
  }

  // Extract skills by matching known terms
  const lowerText = rawText.toLowerCase();
  const matchedSkills = KNOWN_SKILLS.filter((s) => {
    const escaped = escapeRegExp(s);
    return new RegExp(`(?:^|[^a-zA-Z0-9+#])${escaped}(?:$|[^a-zA-Z0-9+#])`, "i").test(lowerText);
  });

  // Extract sections roughly based on headings
  const experience = [];
  const education = [];
  const projects = [];

  let currentSection = "";
  let currentExp = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    if (/^(experience|work experience|employment history|work history)/i.test(lower)) {
      currentSection = "experience";
      continue;
    } else if (/^(education|academic background)/i.test(lower)) {
      currentSection = "education";
      continue;
    } else if (/^(projects|personal projects)/i.test(lower)) {
      currentSection = "projects";
      continue;
    } else if (/^(skills|technical skills|technologies)/i.test(lower)) {
      currentSection = "skills";
      continue;
    }

    if (currentSection === "experience") {
      if (/^[•\-\*]/.test(line)) {
        if (!currentExp) {
          currentExp = { role: title || "Engineer", company: "Company", period: "", bullets: [] };
          experience.push(currentExp);
        }
        currentExp.bullets.push(line.replace(/^[•\-\*]\s*/, ""));
      } else if (line.length < 80 && (line.includes("20") || line.includes("19") || line.toLowerCase().includes("present"))) {
        currentExp = { role: line, company: "", period: "", bullets: [] };
        experience.push(currentExp);
      }
    } else if (currentSection === "education") {
      if (/bachelor|master|b\.s|m\.s|degree|university|college/i.test(line)) {
        education.push({ degree: line, school: "", period: "", details: "" });
      }
    }
  }

  if (experience.length === 0) {
    experience.push({
      role: title || "Software Engineer",
      company: "Previous Experience",
      period: "Recent",
      bullets: lines.filter((l) => /^[•\-\*]/.test(l)).slice(0, 5).map((l) => l.replace(/^[•\-\*]\s*/, "")),
    });
  }

  return {
    basics: {
      name,
      title,
      email: emailMatch ? emailMatch[0] : "",
      phone: phoneMatch ? phoneMatch[0] : "",
      location: "",
      links,
    },
    summary: lines.slice(2, 5).join(" ").slice(0, 300),
    experience,
    education: education.length > 0 ? education : [{ degree: "Degree / Diploma", school: "University", period: "" }],
    skills: matchedSkills.length > 0 ? matchedSkills : ["Software Development", "Problem Solving", "Git"],
    projects,
    certifications: [],
    languages: ["English"],
    interests: [],
  };
}

function withTimeout(promise, ms, label = "Operation") {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Calls Gemini to parse raw resume text into structured sections JSON.
 */
async function parseWithGemini(rawText) {
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const candidateModels = Array.from(
    new Set(
      [
        env.GEMINI_MODEL,
        "gemini-flash-latest",
      ].filter(Boolean)
    )
  );

  const prompt = `You are a professional ATS resume parser.
Extract the structured information from the following resume text into valid JSON.
Do NOT output markdown code fences or any text before/after the JSON. Output only raw JSON.

Schema:
{
  "basics": {
    "name": "string (Candidate full name)",
    "title": "string (Current or target job title)",
    "email": "string",
    "phone": "string",
    "location": "string (City, Country/State)",
    "links": [{ "label": "string", "url": "string" }]
  },
  "summary": "string (Professional summary or profile)",
  "experience": [
    {
      "role": "string",
      "company": "string",
      "location": "string",
      "period": "string",
      "bullets": ["string"]
    }
  ],
  "education": [
    {
      "degree": "string",
      "school": "string",
      "location": "string",
      "period": "string",
      "details": "string"
    }
  ],
  "skills": ["string"],
  "projects": [
    {
      "name": "string",
      "tech": ["string"],
      "description": "string",
      "links": [{ "label": "string", "url": "string" }]
    }
  ],
  "certifications": [
    {
      "name": "string",
      "year": "string",
      "issuer": "string"
    }
  ],
  "languages": ["string"],
  "interests": ["string"]
}

Resume Text:
${rawText.slice(0, 10000)}
`;

  let lastError = null;

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });

      const response = await withTimeout(
        model.generateContent(prompt),
        5000,
        `Gemini parsing (${modelName})`
      );
      const text = response.response.text();

      // Clean potential markdown wrappers
      const cleaned = text.replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
      const parsed = JSON.parse(cleaned);

      if (parsed && typeof parsed === "object") {
        return normalizeParsedSections(parsed);
      }
    } catch (err) {
      lastError = err;
      console.warn(`[Gemini Parser] Model ${modelName} error: ${err.message?.slice(0, 100)}`);
    }
  }

  throw lastError || new Error("Failed to parse resume with AI");
}

/**
 * Ensures all required keys exist and have valid types.
 */
function normalizeParsedSections(data) {
  const b = data.basics || {};
  return {
    basics: {
      name: (b.name || "").trim(),
      title: (b.title || "").trim(),
      email: (b.email || "").trim(),
      phone: (b.phone || "").trim(),
      location: (b.location || "").trim(),
      links: Array.isArray(b.links) ? b.links : [],
    },
    summary: typeof data.summary === "string" ? data.summary.trim() : "",
    experience: Array.isArray(data.experience)
      ? data.experience.map((e) => ({
          role: (e.role || "").trim(),
          company: (e.company || "").trim(),
          location: (e.location || "").trim(),
          period: (e.period || "").trim(),
          bullets: Array.isArray(e.bullets) ? e.bullets.map((x) => String(x).trim()) : [],
        }))
      : [],
    education: Array.isArray(data.education)
      ? data.education.map((ed) => ({
          degree: (ed.degree || "").trim(),
          school: (ed.school || "").trim(),
          location: (ed.location || "").trim(),
          period: (ed.period || "").trim(),
          details: (ed.details || "").trim(),
        }))
      : [],
    skills: Array.isArray(data.skills) ? data.skills.map((s) => String(s).trim()) : [],
    projects: Array.isArray(data.projects)
      ? data.projects.map((p) => ({
          name: (p.name || "").trim(),
          tech: Array.isArray(p.tech) ? p.tech.map((t) => String(t).trim()) : [],
          description: (p.description || p.summary || "").trim(),
          links: Array.isArray(p.links) ? p.links : [],
        }))
      : [],
    certifications: Array.isArray(data.certifications)
      ? data.certifications.map((c) => ({
          name: (c.name || "").trim(),
          year: c.year ? String(c.year) : "",
          issuer: (c.issuer || "").trim(),
        }))
      : [],
    languages: Array.isArray(data.languages) ? data.languages.map((l) => String(l).trim()) : [],
    interests: Array.isArray(data.interests) ? data.interests.map((i) => String(i).trim()) : [],
  };
}

/**
 * Main parser entry point: attempts Gemini first, falls back gracefully to heuristic parsing.
 */
async function parseResumeSections(rawText) {
  try {
    return await parseWithGemini(rawText);
  } catch (err) {
    console.warn("[Structured Parser] Falling back to heuristic extractor:", err.message);
    return heuristicParseResume(rawText);
  }
}

module.exports = {
  parseResumeSections,
  heuristicParseResume,
  normalizeParsedSections,
};
