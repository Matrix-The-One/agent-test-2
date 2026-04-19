import { Injectable } from "@nestjs/common";

import type {
  AgentImageInput,
  AgentImageRoleDecision,
} from "../../Domain/agentTypes.js";

const editKeywords = [
  "改图",
  "修图",
  "编辑图片",
  "编辑这张图",
  "修改这张图",
  "换背景",
  "抠图",
  "裁剪",
  "扩图",
  "去水印",
  "局部重绘",
  "edit this image",
  "edit image",
  "image edit",
] as const;

const referenceKeywords = [
  "参考这张图",
  "参考图片",
  "按照这张图",
  "按这张图",
  "基于这张图",
  "根据这张图",
  "参考图",
  "同样风格",
  "同款风格",
  "类似这张图",
  "use this image as reference",
  "reference image",
] as const;

const containsAny = (message: string, keywords: readonly string[]) =>
  keywords.some((keyword) => message.includes(keyword));

@Injectable()
export class AgentImageRoleService {
  detect({
    images,
    message,
  }: {
    images: AgentImageInput[];
    message: string;
  }): AgentImageRoleDecision {
    if (images.length === 0) {
      return {
        hasImages: false,
        reason: "当前请求未携带图片输入。",
        role: "none",
      };
    }

    const normalizedMessage = message.trim().toLowerCase();

    if (!normalizedMessage) {
      return {
        hasImages: true,
        reason: "当前请求只上传了图片, 默认按图片分析处理。",
        role: "analyze",
      };
    }

    if (containsAny(normalizedMessage, editKeywords)) {
      return {
        hasImages: true,
        reason: "消息包含明确的改图或编辑指令, 图片角色识别为 edit。",
        role: "edit",
      };
    }

    if (containsAny(normalizedMessage, referenceKeywords)) {
      return {
        hasImages: true,
        reason: "消息说明图片用于参考或风格对齐, 图片角色识别为 reference。",
        role: "reference",
      };
    }

    return {
      hasImages: true,
      reason: "请求携带了图片, 但没有命中参考图或改图指令, 默认按分析型上下文处理。",
      role: "analyze",
    };
  }
}
