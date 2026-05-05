import { access, mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { constants as fsConstants } from "node:fs";

import { AlignmentType, Document, HeadingLevel, Packer, Paragraph } from "docx";
import ExcelJS from "exceljs";
import { Inject, Injectable } from "@nestjs/common";

import { AppConfigService } from "../../../../Config/appConfigService.js";

type FileFormat = "txt" | "md" | "js" | "py" | "docx" | "xlsx";
type DocxBlockType = "title" | "heading" | "paragraph" | "bullet";

type CreatedFileResult = {
  absolutePath: string;
  byteLength: number;
  details?: string[];
  format: FileFormat;
  overwritten: boolean;
  relativePath: string;
};

export type DocxBlockInput = {
  text: string;
  type: DocxBlockType;
};

export type SpreadsheetCellValue =
  | string
  | number
  | boolean
  | null
  | {
      formula: string;
      result?: boolean | number | string | null;
    };

export type SpreadsheetSheetInput = {
  name: string;
  rows: SpreadsheetCellValue[][];
  treatFirstRowAsHeader?: boolean;
};

type WriteTextFileInput = {
  content: string;
  format: Extract<FileFormat, "txt" | "md" | "js" | "py">;
  overwrite?: boolean;
  relativePath: string;
};

const toPosixPath = (value: string) => value.split(sep).join("/");

const formatFileCreationError = (error: unknown) => {
  // tool 捕获异常后返回文本给模型，而不是让整条 Agent 请求失败。
  const message = error instanceof Error ? error.message : "Unknown file creation error.";

  return `File creation failed: ${message}`;
};

const getCellDisplayLength = (value: SpreadsheetCellValue) => {
  // 用于估算 xlsx 列宽，让生成的表格打开后可读。
  if (value === null) {
    return 0;
  }

  if (typeof value === "object") {
    return Math.max(
      value.formula.length,
      value.result == null ? 0 : String(value.result).length,
    );
  }

  return String(value).length;
};

@Injectable()
export class FileCreationService {
  @Inject(AppConfigService)
  private readonly config!: AppConfigService;

  async createTextFile(input: WriteTextFileInput) {
    // txt/md/js/py 都走 UTF-8 文本写入路径。
    const normalizedTarget = this.resolveTargetPath(input.relativePath, `.${input.format}`);
    const contentBuffer = Buffer.from(input.content, "utf8");

    return this.writeCreatedFile({
      content: contentBuffer,
      format: input.format,
      overwrite: input.overwrite ?? false,
      relativePath: normalizedTarget.relativePath,
    });
  }

  async createDocxFile(input: {
    blocks: DocxBlockInput[];
    overwrite?: boolean;
    relativePath: string;
  }) {
    // docx 使用结构化 blocks，避免把整份文档作为一段纯文本写入。
    const normalizedTarget = this.resolveTargetPath(input.relativePath, ".docx");
    const document = new Document({
      sections: [
        {
          children: input.blocks.map((block) => this.mapDocxBlockToParagraph(block)),
        },
      ],
    });
    const contentBuffer = await Packer.toBuffer(document);

    return this.writeCreatedFile({
      content: contentBuffer,
      details: [`Blocks: ${input.blocks.length}`],
      format: "docx",
      overwrite: input.overwrite ?? false,
      relativePath: normalizedTarget.relativePath,
    });
  }

  async createXlsxFile(input: {
    overwrite?: boolean;
    relativePath: string;
    sheets: SpreadsheetSheetInput[];
  }) {
    // xlsx 使用 ExcelJS 生成真实 workbook，而不是写 CSV 伪装成 xlsx。
    const normalizedTarget = this.resolveTargetPath(input.relativePath, ".xlsx");
    const workbook = new ExcelJS.Workbook();

    for (const sheetInput of input.sheets) {
      const worksheet = workbook.addWorksheet(sheetInput.name);
      const normalizedRows = sheetInput.rows.map((row) =>
        row.map((cell) =>
          cell && typeof cell === "object"
            ? {
                formula: cell.formula,
                result: cell.result ?? undefined,
              }
            : cell,
        ),
      );

      if (normalizedRows.length > 0) {
        worksheet.addRows(normalizedRows as never[]);
      }

      if (sheetInput.treatFirstRowAsHeader !== false && normalizedRows.length > 0) {
        const headerRow = worksheet.getRow(1);

        headerRow.font = {
          bold: true,
        };
        headerRow.alignment = {
          vertical: "middle",
          wrapText: true,
        };
        worksheet.views = [{ state: "frozen", ySplit: 1 }];
      }

      const columnWidths: number[] = [];

      for (const row of sheetInput.rows) {
        row.forEach((cell, columnIndex) => {
          columnWidths[columnIndex] = Math.max(
            columnWidths[columnIndex] ?? 10,
            Math.min(40, getCellDisplayLength(cell) + 2),
          );
        });
      }

      worksheet.columns = columnWidths.map((width) => ({
        width,
      }));
    }

    const contentBuffer = Buffer.from(await workbook.xlsx.writeBuffer());

    return this.writeCreatedFile({
      content: contentBuffer,
      details: [
        `Sheets: ${input.sheets.length}`,
        `Rows: ${input.sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0)}`,
      ],
      format: "xlsx",
      overwrite: input.overwrite ?? false,
      relativePath: normalizedTarget.relativePath,
    });
  }

  private async writeCreatedFile(input: {
    content: Buffer;
    details?: string[];
    format: FileFormat;
    overwrite: boolean;
    relativePath: string;
  }): Promise<CreatedFileResult> {
    // 所有文件最终都通过这个方法写入，集中处理覆盖保护和目录创建。
    const absolutePath = resolve(this.config.agentFileOutputRoot, input.relativePath);
    const overwritten = await this.fileExists(absolutePath);

    if (overwritten && !input.overwrite) {
      throw new Error(
        `Target file already exists: ${input.relativePath}. Pass overwrite=true if replacement is intended.`,
      );
    }

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.content);

    return {
      absolutePath,
      byteLength: input.content.byteLength,
      ...(input.details ? { details: input.details } : {}),
      format: input.format,
      overwritten,
      relativePath: input.relativePath,
    };
  }

  private mapDocxBlockToParagraph(block: DocxBlockInput) {
    // 将工具入参里的简单 block 类型映射到 docx 段落样式。
    switch (block.type) {
      case "title":
        return new Paragraph({
          alignment: AlignmentType.CENTER,
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 240 },
          text: block.text,
        });
      case "heading":
        return new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 160, after: 120 },
          text: block.text,
        });
      case "bullet":
        return new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 80 },
          text: block.text,
        });
      case "paragraph":
        return new Paragraph({
          spacing: { after: 160 },
          text: block.text,
        });
    }
  }

  private resolveTargetPath(relativePath: string, expectedExtension: `.${FileFormat}`) {
    // 文件工具只允许写入配置根目录下的相对路径，防止路径穿越和误写系统文件。
    let normalizedRelativePath = relativePath.trim().replace(/\\/g, "/");

    if (!normalizedRelativePath) {
      throw new Error("relativePath cannot be empty.");
    }

    if (normalizedRelativePath.includes("\0")) {
      throw new Error("relativePath contains an invalid null byte.");
    }

    if (isAbsolute(normalizedRelativePath)) {
      throw new Error("relativePath must stay within the configured workspace root.");
    }

    if (normalizedRelativePath.endsWith("/")) {
      throw new Error("relativePath must point to a file, not a directory.");
    }

    const currentExtension = extname(normalizedRelativePath).toLowerCase();

    if (!currentExtension) {
      normalizedRelativePath = `${normalizedRelativePath}${expectedExtension}`;
    } else if (currentExtension !== expectedExtension) {
      throw new Error(
        `relativePath must use the ${expectedExtension} extension for this tool.`,
      );
    }

    const absolutePath = resolve(this.config.agentFileOutputRoot, normalizedRelativePath);
    const relativeToRoot = relative(this.config.agentFileOutputRoot, absolutePath);

    if (
      !relativeToRoot ||
      relativeToRoot.startsWith("..") ||
      isAbsolute(relativeToRoot)
    ) {
      throw new Error("relativePath escapes the configured workspace root.");
    }

    return {
      absolutePath,
      relativePath: toPosixPath(relativeToRoot),
    };
  }

  private async fileExists(path: string) {
    // 只把已存在的普通文件视为 overwritten；目录等异常情况交给后续 writeFile 抛错。
    try {
      await access(path, fsConstants.F_OK);
      const fileStat = await stat(path);

      return fileStat.isFile();
    } catch {
      return false;
    }
  }
}

export const formatCreatedFileResult = (result: CreatedFileResult) =>
  // 工具返回创建结果给模型，模型再在最终答案里向用户说明产物路径。
  [
    "File creation result",
    `Format: ${result.format}`,
    `Relative path: ${result.relativePath}`,
    `Absolute path: ${result.absolutePath}`,
    `Overwritten: ${result.overwritten ? "yes" : "no"}`,
    `Bytes: ${result.byteLength}`,
    ...(result.details ?? []),
  ].join("\n");

export { formatFileCreationError };
