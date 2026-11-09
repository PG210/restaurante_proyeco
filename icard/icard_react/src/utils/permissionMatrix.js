export function buildDrafts(matrix) {
  return Object.fromEntries((matrix?.roles ?? []).map((role) => [role.name, [...role.permissions].sort()]));
}

export function draftFor(drafts, role) {
  return drafts[role.name] ?? role.permissions;
}

export function togglePermission(permissions, codename) {
  const next = permissions.includes(codename)
    ? permissions.filter((permission) => permission !== codename)
    : [...permissions, codename];
  return next.sort();
}

export function hasSamePermissions(first, second) {
  if (first.length !== second.length) return false;
  const sortedSecond = [...second].sort();
  return [...first].sort().every((permission, index) => permission === sortedSecond[index]);
}
