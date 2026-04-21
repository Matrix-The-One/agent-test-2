import { tool } from "@langchain/core/tools";
import { z } from "zod";

import {
  FileCreationService,
  formatCreatedFileResult,
  formatFileCreationError,
} from "../Infrastructure/Files/fileCreationService.js";

const relativePathSchema = z.string().trim().min(1).max(240);
const overwriteSchema = z.boolean().default(false);
const longTextSchema = z.string().trim().min(1).max(50000);

const docxBlockSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  type: z.enum(["title", "heading", "paragraph", "bullet"]),
});

const xlsxFormulaCellSchema = z.object({
  formula: z.string().trim().min(1).max(200),
  result: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});

const xlsxCellSchema = z.union([
  z.string().max(2000),
  z.number(),
  z.boolean(),
  z.null(),
  xlsxFormulaCellSchema,
]);

const xlsxSheetSchema = z.object({
  name: z.string().trim().min(1).max(31),
  rows: z.array(z.array(xlsxCellSchema).max(50)).max(500),
  treatFirstRowAsHeader: z.boolean().default(true),
});

const createTextFileTool = ({
  description,
  format,
  name,
  payloadKey,
  service,
}: {
  description: string;
  format: "txt" | "md" | "js" | "py";
  name: string;
  payloadKey: string;
  service: FileCreationService;
}) =>
  tool(
    async (
      input: { overwrite?: boolean; relativePath: string } & Record<string, string>,
    ) => {
      try {
        const content = input[payloadKey];

        return formatCreatedFileResult(
          await service.createTextFile({
            content,
            format,
            overwrite: input.overwrite,
            relativePath: input.relativePath,
          }),
        );
      } catch (error) {
        return formatFileCreationError(error);
      }
    },
    {
      description,
      name,
      schema: z.object({
        [payloadKey]: longTextSchema,
        overwrite: overwriteSchema,
        relativePath: relativePathSchema,
      }),
    },
  );

export const createTxtFileTool = (service: FileCreationService) =>
  createTextFileTool({
    description:
      "Create a UTF-8 .txt file inside the configured workspace root. Use this when the user explicitly wants a plain text artifact.",
    format: "txt",
    name: "create_txt_file",
    payloadKey: "content",
    service,
  });

export const createMarkdownFileTool = (service: FileCreationService) =>
  createTextFileTool({
    description:
      "Create a UTF-8 .md file inside the configured workspace root. Use this for Markdown notes, specs, READMEs, or drafts.",
    format: "md",
    name: "create_markdown_file",
    payloadKey: "content",
    service,
  });

export const createJavaScriptFileTool = (service: FileCreationService) =>
  createTextFileTool({
    description:
      "Create a .js file inside the configured workspace root. Use this when the user explicitly asks for a JavaScript file artifact.",
    format: "js",
    name: "create_javascript_file",
    payloadKey: "code",
    service,
  });

export const createPythonFileTool = (service: FileCreationService) =>
  createTextFileTool({
    description:
      "Create a .py file inside the configured workspace root. Use this when the user explicitly asks for a Python file artifact.",
    format: "py",
    name: "create_python_file",
    payloadKey: "code",
    service,
  });

export const createDocxFileTool = (service: FileCreationService) =>
  tool(
    async ({ blocks, overwrite, relativePath }) => {
      try {
        return formatCreatedFileResult(
          await service.createDocxFile({
            blocks,
            overwrite,
            relativePath,
          }),
        );
      } catch (error) {
        return formatFileCreationError(error);
      }
    },
    {
      description:
        "Create a .docx document inside the configured workspace root. Provide structured blocks so the output has headings, paragraphs, and bullets instead of raw plain text.",
      name: "create_docx_file",
      schema: z.object({
        blocks: z.array(docxBlockSchema).min(1).max(300),
        overwrite: overwriteSchema,
        relativePath: relativePathSchema,
      }),
    },
  );

export const createXlsxFileTool = (service: FileCreationService) =>
  tool(
    async ({ overwrite, relativePath, sheets }) => {
      try {
        return formatCreatedFileResult(
          await service.createXlsxFile({
            overwrite,
            relativePath,
            sheets,
          }),
        );
      } catch (error) {
        return formatFileCreationError(error);
      }
    },
    {
      description:
        "Create a .xlsx workbook inside the configured workspace root. Each sheet accepts tabular rows; the first row can optionally be treated as a header and formula cells are supported.",
      name: "create_xlsx_file",
      schema: z.object({
        overwrite: overwriteSchema,
        relativePath: relativePathSchema,
        sheets: z.array(xlsxSheetSchema).min(1).max(10),
      }),
    },
  );
