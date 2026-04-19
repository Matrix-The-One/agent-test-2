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
    return this.userRepository.ensureUser({
      displayName: payload.displayName,
      email: payload.email,
      id: payload.id,
    });
  }

  async getUserById(userId: string) {
    return this.userRepository.findById(userId);
  }

  async ensureRuntimeUser(userId?: string) {
    const resolvedUserId = userId ?? LOCAL_DEFAULT_USER_ID;

    try {
      return await this.userRepository.findById(resolvedUserId);
    } catch {
      return this.userRepository.ensureUser({
        displayName: LOCAL_DEFAULT_USER_NAME,
        id: resolvedUserId,
      });
    }
  }
}
