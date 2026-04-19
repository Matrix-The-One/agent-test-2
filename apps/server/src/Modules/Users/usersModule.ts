import { Module } from "@nestjs/common";

import { UserService } from "./Application/Services/userService.js";
import { UserRepository } from "./Infrastructure/Repositories/userRepository.js";
import { UsersController } from "./Presentation/Http/usersController.js";

@Module({
  controllers: [UsersController],
  exports: [UserService],
  providers: [UserService, UserRepository],
})
export class UsersModule {}
