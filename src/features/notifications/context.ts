"use client";

import { createContext, useContext } from "react";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@/features/notifications/defaults";
import type {
  NotificationPermissionState,
  NotificationPreferences,
  NotificationSuppressionState,
} from "@/features/notifications/types";

export interface NotificationCenterContextValue {
  ready: boolean;
  saving: boolean;
  permission: NotificationPermissionState;
  preferences: NotificationPreferences;
  suppressed: NotificationSuppressionState;
  lastEvaluatedAt: string | null;
  lastDeliveredAt: string | null;
  requestPermission: () => Promise<NotificationPermissionState>;
  savePreferences: (next: NotificationPreferences) => Promise<void>;
  resetPreferences: () => Promise<void>;
  sendTestNotification: () => void;
}

const noopAsync = async () => {};

export const NotificationCenterContext = createContext<NotificationCenterContextValue>({
  ready: false,
  saving: false,
  permission: "unsupported",
  preferences: DEFAULT_NOTIFICATION_PREFERENCES,
  suppressed: {
    quietHours: false,
    weekend: false,
  },
  lastEvaluatedAt: null,
  lastDeliveredAt: null,
  requestPermission: async () => "unsupported",
  savePreferences: noopAsync,
  resetPreferences: noopAsync,
  sendTestNotification: () => {},
});

export function useNotificationCenter() {
  return useContext(NotificationCenterContext);
}
