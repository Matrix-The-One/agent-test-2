// 本地开发默认用户：没有登录系统时，所有对话挂到这个固定用户上。
export const LOCAL_DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";
export const LOCAL_DEFAULT_USER_NAME = "Local User";

// UserRecord 是暴露给 HTTP 层和前端的领域结构。
export type UserRecord = {
  id: string;
  displayName: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
};
