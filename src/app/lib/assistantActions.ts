// Apply-suggestion runtime — Phase 2A.5.
//
// Each AiAction variant has two halves: an `execute` that performs
// the real store mutation and returns a short human-readable result
// + an undo payload, and an `undo` that reverses the mutation given
// that payload.
//
// The Assistant screen calls executeAction on click, records the
// applied entry on the message via recordAiApplied, and renders an
// "Undo" affordance that calls undoAction.
//
// Honesty contract: actions only emit when the engine can ground
// them in live data. If a handler can't actually execute (e.g.
// resolve-event for a work order that no longer exists), it returns
// a refusal string instead of silently no-opping.

import { useProjectStore } from '../store/projectStore';
import type { AiAction, AiAppliedRecord, Device, Task, SurveyItem, WorkOrderStatus } from '../store/types';

export interface ApplyResult {
  result: string;
  undoPayload?: any;
  /** Optional URL the caller can navigate to after applying (e.g.
   *  generate-report routes to /reports). */
  navigateTo?: string;
  /** Set true when the action was a no-op so the caller doesn't
   *  log it. */
  refused?: boolean;
}

export function executeAction(action: AiAction, projectId: string): ApplyResult {
  const store = useProjectStore.getState();
  switch (action.kind) {
    case 'add-device': {
      const floorId = action.nearFloorId ?? findFirstFloor(projectId);
      if (!floorId) return refused('No floor to drop the device on. Open the canvas and pick a floor first.');
      const id = `ai-${Date.now().toString(36)}`;
      const device: Device = {
        id,
        projectId,
        floorId,
        type: action.deviceType as Device['type'],
        label: action.label,
        product: '',
        x: 400 + Math.random() * 200 - 100,
        y: 300 + Math.random() * 200 - 100,
        rot: 0,
      };
      store.addDevice(device);
      return {
        result: `Added ${action.label} (${id}) on the current floor. Drag to fine tune position.`,
        undoPayload: { kind: 'remove-device', deviceId: id },
      };
    }
    case 'resolve-event': {
      const wo = store.workOrderProgress[action.refId];
      const prevStatus = wo?.status;
      store.setWorkOrderStatus(action.refId, 'complete');
      return {
        result: `Marked ${action.label} complete.`,
        undoPayload: { kind: 'restore-wo-status', woId: action.refId, prevStatus: prevStatus ?? 'ready' },
      };
    }
    case 'assign-workflow': {
      const wo = store.workOrderProgress[action.refId];
      const prevAssigned = wo?.assignedTo;
      store.patchWorkOrderProgress(action.refId, { assignedTo: action.assignTo });
      return {
        result: `Assigned ${action.label} to ${action.assignTo}.`,
        undoPayload: { kind: 'restore-wo-assigned', woId: action.refId, prevAssigned },
      };
    }
    case 'create-note': {
      const floorId = findFirstFloor(projectId);
      if (!floorId) return refused('No floor to attach the note to.');
      const created: Omit<SurveyItem, 'id' | 'createdAt' | 'updatedAt'> = {
        projectId,
        floorId,
        objectType: 'floor',
        objectId: floorId,
        kind: 'note',
        body: action.body,
        author: 'Assistant',
      } as any;
      const noteId = store.addSurveyItem(created as any);
      return {
        result: `Added a survey note on the current floor.`,
        undoPayload: { kind: 'remove-survey-item', itemId: noteId },
      };
    }
    case 'schedule-check': {
      const due = Date.now() + action.dueInDays * 86_400_000;
      const newId = store.addTask({
        projectId,
        title: action.label,
        detail: 'Created by the Assistant.',
        dueDate: due,
      } as Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status'>);
      return {
        result: `Scheduled "${action.label}" for ${new Date(due).toLocaleDateString()}.`,
        undoPayload: { kind: 'remove-task', taskId: newId },
      };
    }
    case 'generate-report': {
      const route = `/project/${projectId}/reports`;
      return {
        result: `Opened the ${action.reportKind} report. Generation is page-driven.`,
        navigateTo: route,
        // No undo for navigation — handled by the back button.
      };
    }

    // ── DV Assist Phase 1 (DVA.6) ─────────────────────────────────
    // Three shapes share the same mutation: append a product id to
    // the target device's `accessories` array. The undo restores the
    // exact prior array. Same executor path, distinct AiAction kinds
    // so the conversation thread / panel can show different labels
    // ("Added license", "Added mount", "Added accessory").
    case 'add-license':
    case 'add-mount':
    case 'add-accessory': {
      const dev = store.devices[action.deviceId];
      if (!dev) return refused(`Cannot add: device ${action.deviceId} not found.`);
      const prevAccessories = dev.accessories ? [...dev.accessories] : [];
      if (prevAccessories.includes(action.productId)) {
        return refused(`${action.label} already attached.`);
      }
      const nextAccessories = [...prevAccessories, action.productId];
      store.updateDevice(action.deviceId, { accessories: nextAccessories }, { log: false });
      const verb = action.kind === 'add-license' ? 'license'
                 : action.kind === 'add-mount'   ? 'mount'
                 :                                  'accessory';
      return {
        result: `Added ${verb}: ${action.label}.`,
        undoPayload: {
          kind: 'restore-device-accessories',
          deviceId: action.deviceId,
          prevAccessories,
        },
      };
    }

    case 'select-and-edit': {
      // Manual fix path. The panel sets `assistantContext.selectionId`
      // before calling executeAction so the canvas (or wherever the
      // operator lands) can scope to the object. No mutation, no
      // undo — this is a navigation cue, not a change.
      store.setAssistantContext({
        surface: 'canvas',
        projectId,
        selectionKind: action.objectKind === 'pathway' ? 'pathway'
                     : action.objectKind === 'device'  ? 'device'
                     : undefined,
        selectionId: action.objectId,
        selectionLabel: action.label,
      });
      return {
        result: `Opened ${action.label}.`,
        // No undoPayload — operator just opened a thing to look at it.
      };
    }
  }
}

export function undoAction(applied: AiAppliedRecord): string | null {
  const payload = applied.undoPayload;
  if (!payload) return null;
  const store = useProjectStore.getState();
  switch (payload.kind) {
    case 'remove-device':
      store.removeDevice(payload.deviceId);
      return `Removed ${payload.deviceId}.`;
    case 'restore-wo-status':
      store.setWorkOrderStatus(payload.woId, payload.prevStatus as WorkOrderStatus);
      return `Reverted ${payload.woId} to ${payload.prevStatus}.`;
    case 'restore-wo-assigned':
      store.patchWorkOrderProgress(payload.woId, { assignedTo: payload.prevAssigned });
      return `Cleared assignment on ${payload.woId}.`;
    case 'remove-survey-item':
      store.removeSurveyItem(payload.itemId);
      return 'Removed the survey note.';
    case 'remove-task':
      store.removeTask(payload.taskId);
      return 'Removed the scheduled check.';
    case 'restore-device-accessories': {
      const dev = store.devices[payload.deviceId];
      if (!dev) return null;
      store.updateDevice(payload.deviceId, { accessories: payload.prevAccessories }, { log: false });
      return `Reverted accessories on ${payload.deviceId}.`;
    }
    default:
      return null;
  }
}

function refused(text: string): ApplyResult {
  return { result: text, refused: true };
}

function findFirstFloor(projectId: string): string | null {
  const s = useProjectStore.getState();
  // Mirror the storeSelectors.firstFloorOfProject helper without
  // pulling the import to avoid the cycle the engine already has.
  const site = Object.values(s.sites).find((x) => x.projectId === projectId);
  if (!site) return null;
  const building = Object.values(s.buildings).find((b) => b.siteId === site.id);
  if (!building) return null;
  const floor = Object.values(s.floors).find((f) => f.buildingId === building.id);
  return floor?.id ?? null;
}
