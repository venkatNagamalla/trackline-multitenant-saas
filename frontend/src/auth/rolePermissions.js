
export function getCurrentWorkspaceRole(user, currentWorkspace) {
  const workspace = user?.workspaces?.find(
    (item) => item.slug === currentWorkspace
  );

  return workspace?.role ?? null;
}

export function canReadWorkspace(role) {
  return ["admin", "member", "viewer"].includes(role);
}

export function canWrite(role) {
  return ["admin", "member"].includes(role);
}

export function isAdmin(role) {
  return role === "admin";
}
