import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { createClient } from "@/lib/supabase/client";
import { authInterface } from "@/modules/auth/auth.interface";
import { profilesInterface, type ProfileDTO } from "@/modules/profiles/profiles.interface";

interface SessionState {
  userId: string | null;
  profile: ProfileDTO | null;
  status: "idle" | "loading" | "loaded" | "error";
}

const initialState: SessionState = {
  userId: null,
  profile: null,
  status: "idle",
};

/**
 * Loads the signed-in user's id + profile once. UserMenu.tsx only dispatches this when
 * `status` is still "idle" (see its useEffect) - that's what turns "every Nav/GroupNav
 * remount re-fetches" into "fetched once per session and reused across tab switches".
 */
export const fetchSession = createAsyncThunk("session/fetch", async () => {
  const supabase = createClient();
  const user = await authInterface.getCurrentUser(supabase);
  if (!user) return { userId: null, profile: null };

  const profile = await profilesInterface.getProfile(supabase, user.id);
  return { userId: user.id, profile };
});

const sessionSlice = createSlice({
  name: "session",
  initialState,
  reducers: {
    /** EditProfileModal's onSaved - updates the cached profile in place instead of
     * refetching, so the change shows up immediately everywhere without a network call. */
    profileUpdated(state, action: PayloadAction<ProfileDTO>) {
      state.profile = action.payload;
    },
    /** Dispatched on sign-out so a different account signing in on the same tab never
     * sees the previous user's cached avatar/username for a moment. */
    sessionCleared() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSession.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchSession.fulfilled, (state, action) => {
        state.userId = action.payload.userId;
        state.profile = action.payload.profile;
        state.status = "loaded";
      })
      .addCase(fetchSession.rejected, (state) => {
        state.status = "error";
      });
  },
});

export const { profileUpdated, sessionCleared } = sessionSlice.actions;
export default sessionSlice.reducer;
