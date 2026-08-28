import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { createClient } from "@/lib/supabase/client";
import { notificationsInterface } from "@/modules/notifications/notifications.interface";
import type { NotificationDTO } from "@/modules/notifications/notifications.interface";

interface NotificationsState {
  items: NotificationDTO[] | null;
  status: "idle" | "loading" | "loaded" | "error";
}

const initialState: NotificationsState = {
  items: null,
  status: "idle",
};

/** NotificationBell.tsx only dispatches this when `status` is still "idle" - same
 * fetch-once-and-reuse-across-navigation behavior as sessionSlice.ts's fetchSession. */
export const fetchNotifications = createAsyncThunk("notifications/fetch", async (userId: string) => {
  const supabase = createClient();
  return notificationsInterface.listForUser(supabase, userId);
});

/** Optimistic-update-then-persist, same order NotificationBell.tsx used before this
 * moved into Redux: the reducer flips `is_read` immediately, the request happens after. */
export const markNotificationRead = createAsyncThunk(
  "notifications/markRead",
  async ({ userId, id }: { userId: string; id: string }, { dispatch }) => {
    dispatch(notificationMarkedReadLocally(id));
    const supabase = createClient();
    await notificationsInterface.markAsRead(supabase, userId, id);
  },
);

export const markAllNotificationsRead = createAsyncThunk(
  "notifications/markAllRead",
  async (userId: string, { dispatch }) => {
    dispatch(allNotificationsMarkedReadLocally());
    const supabase = createClient();
    await notificationsInterface.markAllAsRead(supabase, userId);
  },
);

export const removeNotification = createAsyncThunk(
  "notifications/remove",
  async ({ userId, id }: { userId: string; id: string }, { dispatch }) => {
    dispatch(notificationRemovedLocally(id));
    const supabase = createClient();
    await notificationsInterface.remove(supabase, userId, id);
  },
);

const notificationsSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    notificationMarkedReadLocally(state, action: PayloadAction<string>) {
      const notification = state.items?.find((item) => item.id === action.payload);
      if (notification) notification.is_read = true;
    },
    allNotificationsMarkedReadLocally(state) {
      state.items?.forEach((item) => {
        item.is_read = true;
      });
    },
    notificationRemovedLocally(state, action: PayloadAction<string>) {
      state.items = state.items?.filter((item) => item.id !== action.payload) ?? null;
    },
    /** Dispatched on sign-out - see sessionSlice.ts's sessionCleared for why. */
    notificationsCleared() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.items = action.payload;
        state.status = "loaded";
      })
      .addCase(fetchNotifications.rejected, (state) => {
        state.status = "error";
      });
  },
});

export const {
  notificationMarkedReadLocally,
  allNotificationsMarkedReadLocally,
  notificationRemovedLocally,
  notificationsCleared,
} = notificationsSlice.actions;
export default notificationsSlice.reducer;
