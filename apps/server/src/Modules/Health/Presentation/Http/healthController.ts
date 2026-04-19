import { Controller, Get, Inject } from "@nestjs/common";

import { AppConfigService } from "../../../../Config/appConfigService.js";

@Controller("health")
export class HealthController {
  @Inject(AppConfigService)
  private readonly config!: AppConfigService;

  @Get()
  getHealth() {
    return {
      memoryEnabled: true,
      model: this.config.openAiModel,
      providerConfigured: this.config.providerConfigured,
      status: "ok",
    };
  }
}
