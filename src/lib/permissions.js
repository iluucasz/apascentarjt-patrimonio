// Permissões baseadas em papel (role)
export function canCreateAsset(user) {
  return user && (user.role === 'admin' || user.role === 'manager');
}
export function canEditAsset(user) {
  return user && (user.role === 'admin' || user.role === 'manager');
}
export function canDisposeAsset(user) {
  return user && user.role === 'admin';
}
export function canManageUsers(user) {
  return user && user.role === 'admin';
}
export function canManageSettings(user) {
  return user && user.role === 'admin';
}
export function canMoveAsset(user) {
  return user && (user.role === 'admin' || user.role === 'manager');
}
export function canMaintainAsset(user) {
  return user && (user.role === 'admin' || user.role === 'manager');
}
export function canCreateInventory(user) {
  return user && (user.role === 'admin' || user.role === 'manager');
}
export function canScanInventory(user) {
  return !!user;
}
export function canUpdateInventoryLocation(user) {
  return user && (user.role === 'admin' || user.role === 'manager');
}
export function canViewFinancials(user) {
  return user && user.role === 'admin';
}
export function canGenerateLabels(user) {
  return user && (user.role === 'admin' || user.role === 'manager');
}
export const ROLE_LABELS = {
  admin: 'Administrador',
  manager: 'Gestor',
  viewer: 'Leitor / Inventariante'
};