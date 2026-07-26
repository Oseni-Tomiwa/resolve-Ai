export const ORGANIZATION_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const;
export const WORKSPACE_ROLES = ['ADMIN', 'AGENT', 'VIEWER'] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];
export type ApiSuccess<T> = { success: true; message: string; data: T };
export type ApiFailure = { success: false; message: string; error: { code: string; details: readonly unknown[] } };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
