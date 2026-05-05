import { Module } from "@nestjs/common";

import { HealthController } from "./Presentation/Http/healthController.js";

// 健康检查模块暴露运行时配置和基础依赖状态。
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
