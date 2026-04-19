import { Module } from "@nestjs/common";

import { UsersModule } from "../Users/usersModule.js";
import { ConversationService } from "./Application/Services/conversationService.js";
import { ConversationMessageRepository } from "./Infrastructure/Repositories/conversationMessageRepository.js";
import { ConversationRepository } from "./Infrastructure/Repositories/conversationRepository.js";
import { ConversationsController } from "./Presentation/Http/conversationsController.js";

@Module({
  controllers: [ConversationsController],
  exports: [ConversationService],
  imports: [UsersModule],
  providers: [
    ConversationService,
    ConversationRepository,
    ConversationMessageRepository,
  ],
})
export class ConversationsModule {}
