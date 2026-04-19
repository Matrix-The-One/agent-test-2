import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { buildOpenApiDocument } from "./Common/OpenApi/openApiDocument.js";
import { createApp } from "./appFactory.js";

const defaultOutputPath = resolve(
  process.cwd(),
  "../web/openapi/agent-api.json",
);

const resolveOutputPath = () => {
  const explicitPath = process.argv[2];

  return explicitPath
    ? resolve(process.cwd(), explicitPath)
    : defaultOutputPath;
};

async function exportOpenApi() {
  const outputPath = resolveOutputPath();
  const app = await createApp({ logger: false });

  try {
    const document = buildOpenApiDocument(app);

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(document, null, 2), "utf8");
    console.log(`OpenAPI spec written to ${outputPath}`);
  } finally {
    await app.close();
  }
}

void exportOpenApi();
