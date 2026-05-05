import { Inject, Injectable } from "@nestjs/common";

import type { EnsureUserRequest } from "../../Domain/userSchemas.js";
import {
  LOCAL_DEFAULT_USER_ID,
  LOCAL_DEFAULT_USER_NAME,
} from "../../Domain/userTypes.js";
import { UserRepository } from "../../Infrastructure/Repositories/userRepository.js";

@Injectable()
export class UserService {
  constructor(
    @Inject(UserRepository)
    private readonly userRepository: UserRepository,
  ) {}

  async ensureUser(payload: EnsureUserRequest) {
    // 前端启动时会调用 ensure，保证 localStorage 中的 userId 在数据库中存在。
    return this.userRepository.ensureUser({
      displayName: payload.displayName,
      email: payload.email,
      id: payload.id,
    });
  }

  async getUserById(userId: string) {
    // 普通查询接口，找不到时由 Repository 抛 404。
    return this.userRepository.findById(userId);
  }

  async ensureRuntimeUser(userId?: string) {
    // Agent/Conversation 内部调用的兜底用户逻辑：没传 userId 时使用固定本地用户。
    const resolvedUserId = userId ?? LOCAL_DEFAULT_USER_ID;

    try {
      return await this.userRepository.findById(resolvedUserId);
    } catch {
      // 找不到就创建，避免首次本地运行需要单独初始化用户。
      return this.userRepository.ensureUser({
        displayName: LOCAL_DEFAULT_USER_NAME,
        id: resolvedUserId,
      });
    }
  }
}
