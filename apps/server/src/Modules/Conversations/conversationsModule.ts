import { Module } from "@nestjs/common";

import { UsersModule } from "../Users/usersModule.js";
import { ConversationService } from "./Application/Services/conversationService.js";
import { ConversationMessageRepository } from "./Infrastructure/Repositories/conversationMessageRepository.js";
import { ConversationRepository } from "./Infrastructure/Repositories/conversationRepository.js";
import { ConversationsController } from "./Presentation/Http/conversationsController.js";

// 会话模块同时服务前端 CRUD 和 Agent 执行链路中的消息持久化/上下文读取。
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
