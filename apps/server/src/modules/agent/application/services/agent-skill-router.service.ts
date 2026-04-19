import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";

import { AgentSkillsService } from "../../../skill-catalog/application/services/agent-skills.service.js";
import {
  MAX_ROUTED_AGENT_SKILLS,
  type AgentSkillSelection,
} from "../../../skill-catalog/domain/agent-skill.types.js";
import { AgentModelFactory } from "../../infrastructure/factories/agent-model.factory.js";

const skillRouteSchema = z.object({
  reason: z.string().min(1),
  skillIds: z.array(z.string()).min(1).max(MAX_ROUTED_AGENT_SKILLS),
});

@Injectable()
export class AgentSkillRouterService {
  @Inject(AgentModelFactory)
  private readonly modelFactory!: AgentModelFactory;

  @Inject(AgentSkillsService)
  private readonly skillsService!: AgentSkillsService;

  async matchSkills(message: string): Promise<AgentSkillSelection> {
    try {
      const router = this.modelFactory
        .createRouterModel()
        .withStructuredOutput(skillRouteSchema);

      const decision = await router.invoke([
        new SystemMessage(
          [
            "你是一个多 skill 工程助手的快速路由器。",
            "你要从可用技能中选出满足当前请求所需的最小 skill 集合。",
            "当请求同时涉及架构、实施计划、测试质量、项目上下文时，可以返回多个 skill。",
            "当请求涉及文章编写、代码编辑、Excel/XLSX、PDF、Word 或文件生成时，优先选择对应领域 skill。",
            "不要编造 skill ID，只能从提供的 catalog 中返回 skillIds。",
          ].join("\n"),
        ),
        new HumanMessage(
          [
            `用户请求：\n${message}`,
            `可用技能目录：\n${this.skillsService.getRoutingCatalog()}`,
          ].join("\n\n"),
        ),
      ]);

      const skillIds = this.skillsService.normalizeSkillIds(decision.skillIds);

      if (skillIds.length > 0) {
        return {
          reason: decision.reason,
          skillIds,
          skills: this.skillsService.getSkillsByIds(skillIds),
        };
      }
    } catch {}

    const fallbackSkillIds = this.skillsService.getFallbackSkillIds(message);

    return {
      reason: "路由模型未返回有效 skill，已回退到关键词匹配结果。",
      skillIds: fallbackSkillIds,
      skills: this.skillsService.getSkillsByIds(fallbackSkillIds),
    };
  }
}
