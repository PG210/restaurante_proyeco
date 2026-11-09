import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Loader, Message } from "semantic-ui-react";
import { HeaderPage, PermissionMatrix } from "../../components/Admin";
import { useRolePermissions } from "../../hooks";
import { notifyError } from "../../utils/notify";
import { buildDrafts } from "../../utils/permissionMatrix";
import { ROLE_LABELS } from "../../utils/roles";

export function PermissionsAdmin() {
  const { matrix, getMatrix, updateRole } = useRolePermissions();
  const [drafts, setDrafts] = useState({});
  const [savingRole, setSavingRole] = useState(null);

  const loadMatrix = useCallback(
    () =>
      getMatrix()
        .then((result) => setDrafts(buildDrafts(result)))
        .catch(notifyError),
    [getMatrix],
  );

  useEffect(() => {
    loadMatrix();
  }, [loadMatrix]);

  const onChange = (role, permissions) => setDrafts((current) => ({ ...current, [role]: permissions }));

  const onRestoreDefaults = (role) => {
    if (!window.confirm(`¿Restaurar los permisos por defecto de ${ROLE_LABELS[role.name] ?? role.name}?`)) return;
    onChange(role.name, [...role.defaults]);
  };

  const onSave = async (role) => {
    setSavingRole(role);
    try {
      await updateRole(role, drafts[role]);
      toast.success(`Permisos de ${ROLE_LABELS[role] ?? role} guardados`);
      await loadMatrix();
    } catch (error) {
      notifyError(error);
    } finally {
      setSavingRole(null);
    }
  };

  return (
    <>
      <HeaderPage title="Permisos por rol" />
      <Message info>
        Los cambios se aplican en la API en cuanto se guardan. Cada persona verá sus menús actualizados la
        próxima vez que inicie sesión o recargue el panel.
      </Message>
      {matrix === null ? (
        <Loader active inline="centered">
          Cargando...
        </Loader>
      ) : (
        <PermissionMatrix
          matrix={matrix}
          drafts={drafts}
          onChange={onChange}
          onSave={onSave}
          onRestoreDefaults={onRestoreDefaults}
          savingRole={savingRole}
        />
      )}
    </>
  );
}
