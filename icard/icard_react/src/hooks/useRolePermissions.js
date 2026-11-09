import { useCallback, useState } from "react";
import { getPermissionMatrixApi, updateRolePermissionsApi } from "../api/rolePermissions";
import { useRequestState } from "./useRequestState";

export function useRolePermissions() {
  const { loading, error, run } = useRequestState();
  const [matrix, setMatrix] = useState(null);

  const getMatrix = useCallback(
    () =>
      run(async () => {
        const result = await getPermissionMatrixApi();
        setMatrix(result);
        return result;
      }),
    [run],
  );

  const updateRole = useCallback(
    (role, permissions) => run(() => updateRolePermissionsApi(role, permissions)),
    [run],
  );

  return { loading, error, matrix, getMatrix, updateRole };
}
