import { Module } from "@nestjs/common";

import { UserService } from "./Application/Services/userService.js";
import { UserRepository } from "./Infrastructure/Repositories/userRepository.js";
import { UsersController } from "./Presentation/Http/usersController.js";

// 用户模块提供本地用户 ensure/get 能力，Conversation 和 Agent 都依赖它保证 user 存在。
@Module({
  controllers: [UsersController],
  exports: [UserService],
  providers: [UserService, UserRepository],
})
export class UsersModule {}
