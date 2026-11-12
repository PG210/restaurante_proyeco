import React, { useCallback, useEffect, useState } from "react";
import { Header, Loader, Segment } from "semantic-ui-react";
import { cashClosingApi } from "../../api/reports";
import { CashClosingHistory, CashClosingResult, CashCountForm, HeaderPage } from "../../components/Admin";
import { useAuth } from "../../hooks";
import { notifyError } from "../../utils/notify";
import { PERMISSIONS, hasPermission } from "../../utils/permissions";

export function CashClosingAdmin() {
  const { auth } = useAuth();
  const user = auth?.me;
  const canSeeHistory = hasPermission(user, PERMISSIONS.VIEW_PAYMENTS);
  const [today, setToday] = useState(null);
  const [closings, setClosings] = useState(null);

  const loadHistory = useCallback(async () => {
    if (!canSeeHistory) return;
    try {
      setClosings((await cashClosingApi.list()).results);
    } catch (error) {
      notifyError(error);
    }
  }, [canSeeHistory]);

  const load = useCallback(async () => {
    try {
      setToday(await cashClosingApi.today());
    } catch (error) {
      notifyError(error);
    }
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    load();
  }, [load]);

  const showClosing = (closing) => {
    setToday((current) => ({ ...current, closing }));
    loadHistory();
  };

  return (
    <>
      <HeaderPage title="Cierre de caja" />
      {today === null ? (
        <Loader active inline="centered">
          Cargando...
        </Loader>
      ) : (
        <TodayClosing today={today} onClosed={showClosing} />
      )}
      {canSeeHistory && closings !== null && (
        <>
          <Header as="h3">Cierres anteriores</Header>
          <CashClosingHistory closings={closings} canVoid={Boolean(user?.is_staff)} onVoided={load} />
        </>
      )}
    </>
  );
}

function TodayClosing({ today, onClosed }) {
  if (today.closing) return <CashClosingResult closing={today.closing} onChange={onClosed} />;
  return (
    <Segment role="region" aria-label="Contar la caja">
      <Header as="h3">Jornada del {today.service_day}</Header>
      <CashCountForm onClosed={onClosed} />
    </Segment>
  );
}
