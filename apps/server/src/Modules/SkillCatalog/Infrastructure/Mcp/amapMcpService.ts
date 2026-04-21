import type { StructuredToolInterface } from "@langchain/core/tools";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { Inject, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";

import { AppConfigService } from "../../../../Config/appConfigService.js";

@Injectable()
export class AmapMcpService implements OnModuleDestroy {
  @Inject(AppConfigService)
  private readonly config!: AppConfigService;

  private readonly logger = new Logger(AmapMcpService.name);

  private client?: MultiServerMCPClient;
  private hasLoggedMissingApiKey = false;
  private toolsPromise?: Promise<StructuredToolInterface[]>;

  async getTools(): Promise<StructuredToolInterface[]> {
    if (!this.config.amapMapsMcpEnabled) {
      return [];
    }

    if (!this.config.amapMapsApiKey) {
      if (!this.hasLoggedMissingApiKey) {
        this.logger.warn(
          "AGENT_MCP_AMAP_ENABLED=true but AMAP_MAPS_API_KEY is missing. AMap MCP tools will not be loaded.",
        );
        this.hasLoggedMissingApiKey = true;
      }

      return [];
    }

    this.toolsPromise ??= this.loadTools();

    try {
      return await this.toolsPromise;
    } catch (error) {
      this.toolsPromise = undefined;
      await this.closeClient();
      this.logger.warn(
        `Failed to initialize AMap MCP tools: ${this.normalizeError(error)}`,
      );

      return [];
    }
  }

  async onModuleDestroy() {
    await this.closeClient();
  }

  private async loadTools() {
    const client = this.getOrCreateClient();
    const tools = await client.getTools("amap");

    if (tools.length === 0) {
      this.logger.warn(
        "AMap MCP connected but returned no tools. The location specialist will be skipped.",
      );
    }

    return tools;
  }

  private getOrCreateClient() {
    if (this.client) {
      return this.client;
    }

    this.client = new MultiServerMCPClient({
      defaultToolTimeout: this.config.amapMapsMcpTimeoutMs,
      onConnectionError: ({ error, serverName }) => {
        this.logger.warn(
          `Ignoring MCP connection error from ${serverName}: ${this.normalizeError(error)}`,
        );
      },
      useStandardContentBlocks: true,
      mcpServers: {
        amap: {
          transport: "http",
          url: this.buildAmapMcpUrl(),
        },
      },
    });

    return this.client;
  }

  private buildAmapMcpUrl() {
    const url = new URL(this.config.amapMapsMcpBaseUrl);
    url.searchParams.set("key", this.config.amapMapsApiKey!);

    return url.toString();
  }

  private async closeClient() {
    if (!this.client) {
      return;
    }

    const client = this.client;
    this.client = undefined;

    try {
      await client.close();
    } catch (error) {
      this.logger.warn(
        `Failed to close AMap MCP client cleanly: ${this.normalizeError(error)}`,
      );
    }
  }

  private normalizeError(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
