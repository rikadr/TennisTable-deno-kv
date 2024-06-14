import { SessionUser, authService } from "./auth-service.ts";
import { OptioPongContext } from "./auth-service.ts";

export type Resource = keyof typeof resources;
export type Action<T extends Resource> = (typeof resources)[T][number];

const resources = {
  player: ["create", "read", "update", "delete"],
  game: ["create", "read", "update", "delete"],
  user: ["read", "delete"],
  roles: ["write"],
} as const;

const roles: Record<string, { resource: string; actions: "*" | string[] }[]> = {
  admin: [
    { resource: "player", actions: "*" },
    { resource: "game", actions: "*" },
    { resource: "roles", actions: "*" },
    { resource: "user", actions: "*" },
  ],
};

export class Auth {
  private user: SessionUser;

  constructor(context: OptioPongContext) {
    this.user = authService.getUserFromRequest(context);
  }

  can<T extends keyof typeof resources>(resource: T, action: (typeof resources)[T][number]) {
    if (!(this.user.role in roles)) {
      return false;
    }

    const assignedActionsToResource = roles[this.user.role as keyof typeof roles].find(
      (role) => role.resource === resource
    );

    if (!assignedActionsToResource) {
      return false;
    }

    if (assignedActionsToResource.actions === "*") {
      return true;
    }

    return assignedActionsToResource.actions.includes(action);
  }
}
