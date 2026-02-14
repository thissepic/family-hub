/**
 * Type-safe Socket.IO event definitions for Family Hub.
 */

export interface ShoppingItemData {
  id: string;
  listId: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  category: string | null;
  checked: boolean;
  isRecurring: boolean;
}

export interface ServerToClientEvents {
  "shopping:item-added": (data: { listId: string; item: ShoppingItemData }) => void;
  "shopping:item-updated": (data: { listId: string; item: ShoppingItemData }) => void;
  "shopping:item-toggled": (data: { listId: string; itemId: string; checked: boolean }) => void;
  "shopping:item-deleted": (data: { listId: string; itemId: string }) => void;
  "shopping:checked-cleared": (data: { listId: string }) => void;
  "activity:new-event": (data: { description: string; memberId: string }) => void;
  "hub:data-changed": (data: { modules: string[] }) => void;
  "notification:new": (data: { memberId: string; title: string; type: string }) => void;
}

export interface ClientToServerEvents {
  // Currently no client-to-server events needed beyond connection
}
