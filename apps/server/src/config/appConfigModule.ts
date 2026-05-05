import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AppConfigService } from "./appConfigService.js";

// 配置服务是全局依赖，业务模块可以直接注入 AppConfigService，不需要重复导入配置模块。
@Global()
@Module({
  imports: [ConfigModule],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
