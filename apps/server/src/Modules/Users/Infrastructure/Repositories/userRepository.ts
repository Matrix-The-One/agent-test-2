import { randomUUID } from "node:crypto";

import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  PrismaService,
  type PrismaSession,
} from "../../../../Common/Prisma/prismaService.js";
import type { User } from "../../../../generated/prisma/client.js";
import type { UserRecord } from "../../Domain/userTypes.js";

const mapUserRecord = (record: User): UserRecord => ({
  // Repository 层统一把 Prisma Date 转成 ISO string，前端类型保持稳定。
  createdAt: record.createdAt.toISOString(),
  displayName: record.displayName,
  ...(record.email ? { email: record.email } : {}),
  id: record.id,
  updatedAt: record.updatedAt.toISOString(),
});

@Injectable()
export class UserRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async ensureUser(
    input: {
      displayName: string;
      email?: string;
      id?: string;
    },
    session: PrismaSession = this.prisma,
  ) {
    const id = input.id ?? randomUUID();
    // ensure 语义：id 存在则更新基础资料，不存在则创建。
    const record = await session.user.upsert({
      create: {
        displayName: input.displayName,
        email: input.email,
        id,
      },
      update: {
        displayName: input.displayName,
        ...(input.email ? { email: input.email } : {}),
      },
      where: {
        id,
      },
    });

    return mapUserRecord(record);
  }

  async findById(id: string, session: PrismaSession = this.prisma) {
    // 所有按用户归属查询的上游逻辑最终依赖这个 404 保护。
    const record = await session.user.findUnique({
      where: {
        id,
      },
    });

    if (!record) {
      throw new NotFoundException(`User ${id} was not found.`);
    }

    return mapUserRecord(record);
  }
}
