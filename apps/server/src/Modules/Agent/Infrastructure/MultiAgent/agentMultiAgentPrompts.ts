import type {
  AgentSkillCategory,
  AgentSkillDefinition,
} from "../../../SkillCatalog/Domain/agentSkillTypes.js";
import type { AgentImageRole, AgentIntent } from "../../Domain/agentTypes.js";

type SpecialistMetadata = {
  agentName: string;
  description: string;
  displayName: string;
  toolName: string;
};

type SpecialistDescriptor = SpecialistMetadata & {
  skills: readonly AgentSkillDefinition[];
};

type ChainResult = {
  category: AgentSkillCategory;
  output: string;
};

const SPECIALIST_METADATA: Record<AgentSkillCategory, SpecialistMetadata> = {
  architecture: {
    agentName: "architecture_specialist",
    description:
      "Use for module boundaries, backend layering, directory structure, and design tradeoffs.",
    displayName: "architecture specialist",
    toolName: "architecture_specialist",
  },
  artifact: {
    agentName: "artifact_specialist",
    description:
      "Use for creating concrete workspace files and delivery artifacts such as txt, md, js, py, docx, and xlsx outputs.",
    displayName: "artifact specialist",
    toolName: "artifact_specialist",
  },
  content: {
    agentName: "content_specialist",
    description:
      "Use for article drafting, rewriting, outline generation, and content polish.",
    displayName: "content specialist",
    toolName: "content_specialist",
  },
  delivery: {
    agentName: "delivery_specialist",
    description:
      "Use for milestone planning, phased rollout, task decomposition, and delivery sequencing.",
    displayName: "delivery specialist",
    toolName: "delivery_specialist",
  },
  document: {
    agentName: "document_specialist",
    description:
      "Use for report structure, formal document deliverables, and output formatting strategy.",
    displayName: "document specialist",
    toolName: "document_specialist",
  },
  engineering: {
    agentName: "engineering_specialist",
    description:
      "Use for code implementation, debugging, API work, and hands-on engineering guidance.",
    displayName: "engineering specialist",
    toolName: "engineering_specialist",
  },
  location: {
    agentName: "location_specialist",
    description:
      "Use for map search, geocoding, route planning, nearby POI lookup, district lookup, and other location-oriented tasks.",
    displayName: "location specialist",
    toolName: "location_specialist",
  },
  project: {
    agentName: "project_specialist",
    description:
      "Use for project context, runtime capabilities, stack facts, and environment-oriented questions.",
    displayName: "project specialist",
    toolName: "project_specialist",
  },
  quality: {
    agentName: "quality_specialist",
    description:
      "Use for correctness review, regression risk, validation coverage, and release safety checks.",
    displayName: "quality specialist",
    toolName: "quality_specialist",
  },
};

export const getSpecialistMetadata = (category: AgentSkillCategory) =>
  SPECIALIST_METADATA[category];

export const buildSupervisorSystemPrompt = ({
  imageRole,
  intent,
  specialists,
}: {
  imageRole: AgentImageRole;
  intent: AgentIntent;
  specialists: readonly SpecialistDescriptor[];
}) =>
  [
    "You are the supervisor agent in a multi-agent backend assistant.",
    `Resolved top-level intent: ${intent}.`,
    `Resolved image role: ${imageRole}.`,
    specialists.length > 0
      ? "Available specialists:"
      : "No specialists are available for this request. You may answer directly.",
    ...specialists.map(
      (specialist) =>
        `- ${specialist.displayName}: ${specialist.description} Skills: ${specialist.skills.map((skill) => skill.id).join(", ")}.`,
    ),
    "Rules:",
    "- If specialists are available, delegate at least once unless the user is only greeting or clarifying.",
    "- Break the task into concrete sub-tasks and route each sub-task to the best specialist tool.",
    "- You may consult multiple specialists before producing the final answer.",
    "- Synthesize specialist outputs into one final response for the user.",
    "- Keep the final answer in the user's language and do not expose internal routing unless the user asks for it.",
  ].join("\n");

export const buildSpecialistSystemPrompt = ({
  category,
  intent,
  skills,
}: {
  category: AgentSkillCategory;
  intent: AgentIntent;
  skills: readonly AgentSkillDefinition[];
}) => {
  const metadata = getSpecialistMetadata(category);

  return [
    `You are the ${metadata.displayName} inside a multi-agent system.`,
    `Top-level user intent is ${intent}.`,
    "You are working for the supervisor agent, not directly for the end user.",
    `Your scope is limited to: ${skills.map((skill) => `${skill.name} (${skill.id})`).join(", ")}.`,
    "Use the tools available to you when they materially help.",
    "If a Docker-backed execution tool is available, use it only for deterministic runtime verification, local workspace inspection, or structured data parsing. Do not treat it as a general shell.",
    "If file creation tools are available, use them only when the user explicitly asks for a file artifact or when creating a file is the clearest way to satisfy the request. Include the created path in your notes.",
    "Return concise, high-signal notes or draft fragments that the supervisor can directly synthesize.",
    "Do not mention internal agent orchestration unless explicitly asked.",
  ].join("\n");
};

export const buildChainSynthesisSystemPrompt = ({
  imageRole,
  intent,
}: {
  imageRole: AgentImageRole;
  intent: AgentIntent;
}) =>
  [
    "You are the final synthesis agent in a multi-agent backend assistant.",
    `Resolved top-level intent: ${intent}.`,
    `Resolved image role: ${imageRole}.`,
    "You will receive the original user request plus ordered notes from upstream specialists.",
    "Your job is to produce the final answer for the end user.",
    "Rules:",
    "- Preserve the strongest parts of the specialist chain outputs.",
    "- For coding tasks, keep the answer technically precise and mention concrete risks or validation gaps when relevant.",
    "- For writing tasks, return polished user-facing content instead of internal notes.",
    "- Do not expose internal agent orchestration unless the user explicitly asks for it.",
    "- Keep the final answer in the user's language.",
  ].join("\n");

export const formatChainResults = (results: readonly ChainResult[]) =>
  results.map((result) => `## ${result.category}\n${result.output}`).join("\n\n");
