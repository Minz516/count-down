import { configureStore } from "@reduxjs/toolkit";
import notificationsReducer from "./notificationsSlice";
import sessionReducer from "./sessionSlice";

export function makeStore() {
  return configureStore({
    reducer: {
      session: sessionReducer,
      notifications: notificationsReducer,
    },
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
