import { randomUUID } from "node:crypto";

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { createAbortError } from "../../Domain/agentAbort.js";
import type { AgentSkillChoiceSubmitRequest } from "../../Domain/agentSchemas.js";

const DEFAULT_CHOICE_TIMEOUT_MS = 10 * 60 * 1000;

type PendingChoice = {
  cleanup: () => void;
  originalRequest: string;
  reject: (error: unknown) => void;
  resolve: (choice: AgentSkillChoiceSubmitRequest) => void;
};

export class AgentChoiceTimeoutError extends Error {
  constructor(choiceId: string) {
    super(`Agent choice ${choiceId} timed out.`);
    this.name = "AgentChoiceTimeoutError";
  }
}

@Injectable()
export class AgentChoiceService {
  private readonly pendingChoices = new Map<string, PendingChoice>();

  createChoice({
    originalRequest,
    signal,
    timeoutMs = DEFAULT_CHOICE_TIMEOUT_MS,
  }: {
    originalRequest: string;
    signal?: AbortSignal;
    timeoutMs?: number;
  }) {
    const choiceId = randomUUID();
    let timeoutHandle: NodeJS.Timeout | undefined;
    let abortHandler: (() => void) | undefined;

    const waitForChoice = new Promise<AgentSkillChoiceSubmitRequest>(
      (resolve, reject) => {
        const cleanup = () => {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
            timeoutHandle = undefined;
          }

          if (signal && abortHandler) {
            signal.removeEventListener("abort", abortHandler);
            abortHandler = undefined;
          }

          this.pendingChoices.delete(choiceId);
        };

        const resolveChoice = (choice: AgentSkillChoiceSubmitRequest) => {
          cleanup();
          resolve(choice);
        };

        const rejectChoice = (error: unknown) => {
          cleanup();
          reject(error);
        };

        this.pendingChoices.set(choiceId, {
          cleanup,
          originalRequest,
          reject: rejectChoice,
          resolve: resolveChoice,
        });

        timeoutHandle = setTimeout(() => {
          rejectChoice(new AgentChoiceTimeoutError(choiceId));
        }, timeoutMs);

        if (!signal) {
          return;
        }

        abortHandler = () => {
          rejectChoice(
            signal.reason instanceof Error
              ? signal.reason
              : createAbortError(),
          );
        };

        if (signal.aborted) {
          abortHandler();
          return;
        }

        signal.addEventListener("abort", abortHandler, { once: true });
      },
    );

    return {
      choiceId,
      waitForChoice,
    };
  }

  submitChoice(choiceId: string, choice: AgentSkillChoiceSubmitRequest) {
    const pendingChoice = this.pendingChoices.get(choiceId);

    if (!pendingChoice) {
      throw new NotFoundException(
        "这个方案选择请求已经不存在或已处理，请重新发起请求。",
      );
    }

    if (choice.originalRequest !== pendingChoice.originalRequest) {
      throw new BadRequestException("方案选择与当前待处理请求不匹配。");
    }

    pendingChoice.resolve(choice);

    return {
      accepted: true,
      choiceId,
    };
  }
}
