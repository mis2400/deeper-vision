import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { LoginScreen } from './screens/LoginScreen';
import { ProjectHub } from './screens/ProjectHub';
import { ProjectCenter } from './screens/ProjectCenter';
import { EngineeringCanvas } from './screens/EngineeringCanvas';
import { ReviewMode } from './screens/ReviewMode';
import { DeploymentMode } from './screens/DeploymentMode';
import { DeploymentModeMobile } from './screens/DeploymentModeMobile';
import { ReportsCenter } from './screens/ReportsCenter';
import { VisionScan } from './screens/VisionScan';
import { DeviceLibrary } from './screens/DeviceLibrary';
import { SiteWalk } from './screens/SiteWalk';
import { EstimatorView } from './screens/EstimatorView';
import { CustomerPortal } from './screens/CustomerPortal';
import { SettingsView } from './screens/SettingsView';
import { LiveIntegration } from './screens/LiveIntegration';
import { ComponentAdmin } from './screens/ComponentAdmin';
import { HelpCenter } from './screens/HelpCenter';
import { FlowView } from './screens/FlowView';
import { CanvasInteractions } from './screens/CanvasInteractions';
import { DoorEngineering } from './screens/DoorEngineering';
import { BlueprintCalibration } from './screens/BlueprintCalibration';
import { AIAssistant } from './screens/AIAssistant';
import { Commissioning } from './screens/Commissioning';
import { PathwayRouting } from './screens/PathwayRouting';
import { SiteIntake } from './screens/SiteIntake';
import { ThreatSimulator } from './screens/ThreatSimulator';
import { LayerStack } from './screens/LayerStack';
import { PowerCablePlan } from './screens/PowerCablePlan';
import { ProposalBuilder } from './screens/ProposalBuilder';
import { PermitPacket } from './screens/PermitPacket';
import { WorkOrders } from './screens/WorkOrders';
import { Maintenance } from './screens/Maintenance';
import { ChangeOrders } from './screens/ChangeOrders';
import { KnowledgeBase } from './screens/KnowledgeBase';
import { PipelineView } from './screens/PipelineView';
import { AccountDetail } from './screens/AccountDetail';
import { Dashboard } from './screens/Dashboard';
import { ProductCatalog } from './screens/ProductCatalog';
import { ThreatDrillLibrary } from './screens/ThreatDrillLibrary';
import { ThreatDrillEditor } from './screens/ThreatDrillEditor';
import { BusFleet } from './screens/BusFleet';
import { BusDesigner } from './screens/BusDesigner';
import { PdfExporter } from './components/PdfExporter';
import { ShortcutOverlay } from './components/ShortcutOverlay';
import { Toaster } from './components/ui/sonner';
import { useEffect } from 'react';
import { useProjectStore } from './store/projectStore';

function ThemeProvider() {
  // Reads the persisted canvasTheme and mirrors it onto the <html>
  // data-theme attribute so CSS variables resolve correctly. Runs once
  // per change; never owns its own state.
  const theme = useProjectStore((s) => s.canvasTheme);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider />
      <div id="app-root">
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/projects" element={<ProjectHub />} />
          <Route path="/crm" element={<PipelineView />} />
          <Route path="/account/:customerId" element={<AccountDetail />} />
          <Route path="/catalog" element={<ProductCatalog />} />
          <Route path="/project/:projectId" element={<ProjectCenter />} />
          <Route path="/project/:projectId/canvas" element={<EngineeringCanvas />} />
          <Route path="/project/:projectId/review" element={<ReviewMode />} />
          <Route path="/project/:projectId/deployment" element={<DeploymentMode />} />
          <Route path="/project/:projectId/deployment/m" element={<DeploymentModeMobile />} />
          <Route path="/project/:projectId/reports" element={<ReportsCenter />} />
          <Route path="/visionscan" element={<VisionScan />} />
          <Route path="/devices" element={<DeviceLibrary />} />
          <Route path="/sitewalk/:projectId" element={<SiteWalk />} />
          <Route path="/estimate/:projectId" element={<EstimatorView />} />
          <Route path="/portal/:projectId" element={<CustomerPortal />} />
          <Route path="/live/:projectId" element={<LiveIntegration />} />
          <Route path="/admin/library" element={<ComponentAdmin />} />
          <Route path="/help" element={<HelpCenter />} />
          <Route path="/flow/:projectId" element={<FlowView />} />
          <Route path="/interactions" element={<CanvasInteractions />} />
          <Route path="/door/:doorId" element={<DoorEngineering />} />
          <Route path="/calibrate/:projectId" element={<BlueprintCalibration />} />
          <Route path="/ai/:projectId" element={<AIAssistant />} />
          <Route path="/commission/:projectId" element={<Commissioning />} />
          <Route path="/pathways/:projectId" element={<PathwayRouting />} />
          <Route path="/intake/:projectId" element={<SiteIntake />} />
          <Route path="/threat/:projectId" element={<ThreatSimulator />} />
          {/* Threat Drill Simulator — flagship defensive readiness module */}
          <Route path="/project/:projectId/drill" element={<ThreatDrillLibrary />} />
          <Route path="/project/:projectId/drill/:scenarioId" element={<ThreatDrillEditor />} />
          {/* Bus Security Designer — flagship fleet module */}
          <Route path="/project/:projectId/bus" element={<BusFleet />} />
          <Route path="/project/:projectId/bus/:busId" element={<BusDesigner />} />
          <Route path="/layers/:projectId" element={<LayerStack />} />
          <Route path="/power/:projectId" element={<PowerCablePlan />} />
          <Route path="/proposal/:projectId" element={<ProposalBuilder />} />
          <Route path="/permit/:projectId" element={<PermitPacket />} />
          <Route path="/workorders/:projectId" element={<WorkOrders />} />
          <Route path="/maintenance/:projectId" element={<Maintenance />} />
          <Route path="/changeorders/:projectId" element={<ChangeOrders />} />
          <Route path="/kb" element={<KnowledgeBase />} />
          <Route path="/settings" element={<SettingsView />} />
        </Routes>
        <PdfExporter />
        <ShortcutOverlay />
        <Toaster richColors position="bottom-right" closeButton />
      </div>
    </BrowserRouter>
  );
}
