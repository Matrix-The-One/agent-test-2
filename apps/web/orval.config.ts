import { defineConfig } from "orval";

export default defineConfig({
  agentApi: {
    input: {
      target: "./openapi/agent-api.json",
    },
    output: {
      client: "axios-functions",
      mode: "split",
      schemas: "./src/services/api/generated/models",
      target: "./src/services/api/generated/endpoints.ts",
    },
  },
});
