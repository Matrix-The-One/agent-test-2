import { Module } from "@nestjs/common";

import { HealthController } from "./Presentation/Http/healthController.js";

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
