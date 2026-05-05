import type { StructuredToolInterface } from "@langchain/core/tools";

import type { AgentSkillDefinition } from "../Domain/agentSkillTypes.js";

export const createAmapMapsSkill = (
  tools: StructuredToolInterface[],
): AgentSkillDefinition => ({
  // 这个 skill 只有在 AmapMcpService 成功加载 MCP tools 后才会注册。
  category: "location",
  categoryLabel: "地图与位置",
  description:
    "用于地点搜索、周边检索、地理编码、逆地理编码、路线规划和其他位置类任务。",
  id: "amap-maps",
  name: "高德地图",
  popularity: "popular",
  routingHints: [
    "高德",
    "amap",
    "地图",
    "导航",
    "路线",
    "路况",
    "位置",
    "地点",
    "地址",
    "经纬度",
    "坐标",
    "poi",
    "周边",
    "附近",
    "地理编码",
    "逆地理编码",
  ],
  tags: [
    "map",
    "location",
    "navigation",
    "route",
    "geocode",
    "poi",
    "amap",
    "mcp",
  ],
  tools,
  useCases: [
    "搜索地点、地址和 POI",
    "把地址转换成经纬度，或把经纬度转换成地址",
    "规划步行、驾车、骑行或公共交通路线",
    "查询附近地点、行政区划或路况相关信息",
  ],
});
