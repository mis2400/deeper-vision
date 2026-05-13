import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { domToCanvas } from 'modern-screenshot';
import { jsPDF } from 'jspdf';
import { FileDown, Loader2 } from 'lucide-react';

const ROUTES: Array<{ path: string; label: string }> = [
  { path: '/login', label: 'Login' },
  { path: '/projects', label: 'Project Hub' },
  { path: '/project/lincoln-hs/canvas', label: 'Engineering Canvas' },
  { path: '/devices', label: 'Device Library' },
  { path: '/visionscan', label: 'VisionScan' },
  { path: '/sitewalk/lincoln-hs', label: 'Site Walk' },
  { path: '/estimate/lincoln-hs', label: 'Estimator' },
  { path: '/portal/lincoln-hs', label: 'Customer Portal' },
  { path: '/live/lincoln-hs', label: 'Live Integration' },
  { path: '/flow/lincoln-hs', label: 'Flow View' },
  { path: '/interactions', label: 'Canvas Interactions' },
  { path: '/door/d-104', label: 'Door Engineering' },
  { path: '/calibrate/lincoln-hs', label: 'Blueprint Calibration' },
  { path: '/ai/lincoln-hs', label: 'AI Assistant' },
  { path: '/commission/lincoln-hs', label: 'Commissioning' },
  { path: '/pathways/lincoln-hs', label: 'Pathway Routing' },
  { path: '/admin/library', label: 'Component Admin' },
  { path: '/help', label: 'Help & Shortcuts' },
  { path: '/settings', label: 'Settings' },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PROJECT_META = {
  name: 'Lincoln High School',
  rev: 'R3.2',
  date: new Date().toISOString().slice(0, 10),
};

// Mono BrandLogo as inline SVG — mirrors components/BrandLogo.tsx variant="mono".
// Rendered once to a PNG dataURL and stamped on every page footer.
function buildMonoLogoSvg(ink: string): string {
  const font = `font-family="Helvetica, Arial, sans-serif" font-size="36" font-weight="400" letter-spacing="3" fill="${ink}"`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 88" width="520" height="88">` +
    // Emblem (4-bar scan stack), origin (4,22)
    `<g transform="translate(4,22)">` +
    `<rect x="0" y="0"  width="44" height="5" rx="2.5" fill="${ink}"/>` +
    `<rect x="0" y="11" width="34" height="5" rx="2.5" fill="${ink}"/>` +
    `<rect x="0" y="22" width="44" height="5" rx="2.5" fill="${ink}"/>` +
    `<rect x="0" y="33" width="20" height="5" rx="2.5" fill="${ink}" opacity="0.55"/>` +
    `<circle cx="46" cy="2.5" r="2.2" fill="${ink}"/>` +
    `</g>` +
    `<text x="70" y="56" ${font}>DEEPER</text>` +
    `<text x="266" y="56" ${font}>VISION</text>` +
    `<circle cx="508" cy="52" r="2.6" fill="${ink}"/>` +
    `</svg>`
  );
}

async function renderMonoLogoPng(ink = '#B4C8DC'): Promise<string> {
  const svg = buildMonoLogoSvg(ink);
  const url = 'data:image/svg+xml;base64,' + btoa(svg);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = (e) => rej(e);
    img.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = 1040; canvas.height = 176;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, 1040, 176);
  return canvas.toDataURL('image/png');
}

async function captureCurrent(): Promise<HTMLCanvasElement> {
  const target = (document.getElementById('app-root') || document.body) as HTMLElement;
  return domToCanvas(target, {
    backgroundColor: '#0a0e1a',
    scale: 1.25,
    filter: (node) => {
      if (!(node instanceof HTMLElement)) return true;
      // Skip the exporter itself so it isn't captured in the screenshots.
      return !node.dataset?.pdfExporter;
    },
  });
}

export function PdfExporter() {
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('');

  // Show on all screens including login so it's always discoverable.

  async function exportAll() {
    setBusy(true);
    const original = location.pathname + location.search;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    let logoPng: string | null = null;
    try { logoPng = await renderMonoLogoPng('#B4C8DC'); } catch { logoPng = null; }

    try {
      for (let i = 0; i < ROUTES.length; i++) {
        const r = ROUTES[i];
        setStatus(`${i + 1}/${ROUTES.length} · ${r.label}`);
        navigate(r.path);
        await wait(900);
        const canvas = await captureCurrent();
        if (i > 0) pdf.addPage('a4', 'landscape');
        pdf.setFillColor(10, 14, 26);
        pdf.rect(0, 0, pageW, pageH, 'F');
        if (canvas.width > 0 && canvas.height > 0) {
          const img = canvas.toDataURL('image/jpeg', 0.85);
          const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
          const w = canvas.width * ratio;
          const h = canvas.height * ratio;
          const x = (pageW - w) / 2;
          const y = (pageH - h) / 2;
          if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
            pdf.addImage(img, 'JPEG', x, y, w, h, undefined, 'FAST');
          }
        }
        // Footer: mono logo stamp + project metadata block + page counter
        pdf.setTextColor(180, 200, 220);
        pdf.setFontSize(9);
        if (logoPng) {
          // 5.9:1 ratio
          pdf.addImage(logoPng, 'PNG', 18, pageH - 26, 83, 14, undefined, 'FAST');
        } else {
          pdf.text('Deeper Vision', 18, pageH - 16);
        }
        // Vertical divider after stamp
        pdf.setDrawColor(80, 100, 130);
        pdf.line(110, pageH - 26, 110, pageH - 12);
        // Metadata block — three two-line cells: PROJECT · REV · DATE
        const metaY1 = pageH - 19;
        const metaY2 = pageH - 9;
        pdf.setFontSize(6.5);
        pdf.setTextColor(130, 150, 175);
        pdf.text('PROJECT', 118, metaY1);
        pdf.text('REV', 250, metaY1);
        pdf.text('DATE', 310, metaY1);
        pdf.text('SHEET', 380, metaY1);
        pdf.setFontSize(9);
        pdf.setTextColor(220, 232, 245);
        pdf.text(PROJECT_META.name, 118, metaY2);
        pdf.text(PROJECT_META.rev, 250, metaY2);
        pdf.text(PROJECT_META.date, 310, metaY2);
        pdf.text(r.label, 380, metaY2);
        // Page counter
        pdf.setFontSize(9);
        pdf.setTextColor(180, 200, 220);
        pdf.text(`${i + 1} / ${ROUTES.length}`, pageW - 40, pageH - 12);
      }
      setStatus('Saving…');
      pdf.save(`deeper-vision-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      console.error(e);
      setStatus('Failed — see console');
    } finally {
      navigate(original);
      await wait(300);
      setBusy(false);
      setTimeout(() => setStatus(''), 2000);
    }
  }

  async function exportCurrent() {
    setBusy(true);
    setStatus('Capturing…');
    try {
      const canvas = await captureCurrent();
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      pdf.setFillColor(10, 14, 26);
      pdf.rect(0, 0, pageW, pageH, 'F');
      if (canvas.width > 0 && canvas.height > 0) {
        const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
        const w = canvas.width * ratio;
        const h = canvas.height * ratio;
        if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
          pdf.addImage(canvas.toDataURL('image/jpeg', 0.85), 'JPEG', (pageW - w) / 2, (pageH - h) / 2, w, h, undefined, 'FAST');
        }
      }
      pdf.save(`deeper-vision-screen-${Date.now()}.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
      setStatus('');
    }
  }

  return (
    <div
      data-pdf-exporter
      style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 2147483647 }}
      className="flex items-center gap-2 print:hidden"
    >
      {status && (
        <div className="bg-[#0F172A] border border-white/10 text-[11px] text-slate-200 px-3 py-1.5 rounded-md shadow-xl">
          {status}
        </div>
      )}
      <button
        onClick={exportCurrent}
        disabled={busy}
        className="bg-[#0F172A] border border-white/10 hover:border-white/30 text-slate-200 text-xs px-3 py-2 rounded-md shadow-xl disabled:opacity-50 flex items-center gap-1.5"
        title="Export current screen"
      >
        <FileDown className="w-3.5 h-3.5" />
        Screen
      </button>
      <button
        onClick={exportAll}
        disabled={busy}
        className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs px-3 py-2 rounded-md shadow-xl disabled:opacity-50 flex items-center gap-1.5"
        title="Export all screens to PDF"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
        Export PDF
      </button>
    </div>
  );
}
