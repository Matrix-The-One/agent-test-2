import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AppConfigService } from "./appConfigService.js";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
