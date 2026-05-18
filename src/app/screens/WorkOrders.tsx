// SC.2.4 — the /workorders/:projectId screen was a hardcoded 3 item
// mock with a no op "Generate from BOM" button. The MVP spine audit
// flagged it as HIGH gap #5 (two parallel WO screens for the same
// project). The canonical work order surface is /project/:id/deployment
// (DeploymentMode.tsx), which derives WOs from real canvas state via
// projectStore.deriveWorkOrders.
//
// This shim preserves the /workorders/:projectId route so any
// pre existing bookmark or in app link (lifecycle phase nav, command
// palette, AI assistant) keeps working without a 404. It immediately
// redirects to the canonical deployment screen.

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';

export function WorkOrders() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    if (projectId) navigate(`/project/${projectId}/deployment`, { replace: true });
  }, [projectId, navigate]);
  return null;
}
