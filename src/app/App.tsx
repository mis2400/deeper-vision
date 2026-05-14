import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { LoginScreen } from './screens/LoginScreen';
import { ProjectHub } from './screens/ProjectHub';
import { ProjectCenter } from './screens/ProjectCenter';
import { EngineeringCanvas } from './screens/EngineeringCanvas';
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
import { PdfExporter } from './components/PdfExporter';
import { ShortcutOverlay } from './components/ShortcutOverlay';

export default function App() {
  return (
    <BrowserRouter>
      <div id="app-root">
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/projects" element={<ProjectHub />} />
          <Route path="/crm" element={<PipelineView />} />
          <Route path="/account/:customerId" element={<AccountDetail />} />
          <Route path="/project/:projectId" element={<ProjectCenter />} />
          <Route path="/project/:projectId/canvas" element={<EngineeringCanvas />} />
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
      </div>
    </BrowserRouter>
  );
}
