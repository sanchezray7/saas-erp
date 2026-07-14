/**
 * Verifica si un conjunto de permisos del usuario cumple con lo requerido.
 * Si `required` es un array, se exigen TODOS.
 */
export function hasPermission(userPermissions, required) {
  if (!Array.isArray(userPermissions)) return false
  if (required == null) return true

  const userSet = new Set(userPermissions)
  const list = Array.isArray(required) ? required : [required]
  if (list.length === 0) return true

  return list.every((perm) => userSet.has(perm))
}
