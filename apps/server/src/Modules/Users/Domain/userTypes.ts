export const LOCAL_DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";
export const LOCAL_DEFAULT_USER_NAME = "Local User";

export type UserRecord = {
  id: string;
  displayName: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
};
