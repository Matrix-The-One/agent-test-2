import type { AgentSkillDefinition } from "../Domain/agentSkillTypes.js";
import { FileCreationService } from "../Infrastructure/Files/fileCreationService.js";
import {
  createDocxFileTool,
  createJavaScriptFileTool,
  createMarkdownFileTool,
  createPythonFileTool,
  createTxtFileTool,
  createXlsxFileTool,
} from "../Tools/fileCreationTools.js";

export const createFileCreationSkill = (
  fileCreationService: FileCreationService,
): AgentSkillDefinition => ({
  // artifact category 只在用户明确需要文件产物时才应被路由命中。
  category: "artifact",
  categoryLabel: "文件创建",
  description:
    "用于在工作区中创建常见交付文件，包括 txt、md、js、py、docx 和 xlsx。",
  id: "file-creation",
  name: "文件创建",
  popularity: "popular",
  routingHints: [
    "create file",
    "save as",
    "export",
    "xlsx",
    "excel",
    "docx",
    "word",
    "markdown",
    "md",
    "txt",
    "javascript file",
    "python file",
    "生成文件",
    "创建文件",
    "写入文件",
    "导出",
    "保存成",
  ],
  tags: ["file", "artifact", "docx", "xlsx", "markdown", "code"],
  tools: [
    createTxtFileTool(fileCreationService),
    createMarkdownFileTool(fileCreationService),
    createJavaScriptFileTool(fileCreationService),
    createPythonFileTool(fileCreationService),
    createDocxFileTool(fileCreationService),
    createXlsxFileTool(fileCreationService),
  ],
  useCases: [
    "把最终内容直接保存成 txt / md 文件",
    "把脚本落成 js / py 文件而不是只返回代码块",
    "生成可继续编辑的 docx / xlsx 交付件",
  ],
});
