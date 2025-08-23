import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { persistReducer, persistStore } from "redux-persist";
import storage from "redux-persist/lib/storage"; // Defaults to localStorage for web

import authReducer from "@/app/features/auth.slice"; // ✅ Import auth reducer first
import { api } from "@/app/services/auth.service"; // ✅ Then import API
import { userAPI } from "@/app/services/user.service";

// Persist config for auth & project slices
const persistAuthConfig = {
  key: "auth",
  storage,
  whitelist: ["user", "token", "refreshToken", "colorScheme"], // ✅ Persist only necessary fields
};

// Combine reducers
const rootReducer = combineReducers({
  auth: persistReducer(persistAuthConfig, authReducer),
  [api.reducerPath]: api.reducer,
  [userAPI.reducerPath]: userAPI.reducer,
});

// Configure store
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // ✅ Prevent issues with non-serializable data
    }).concat(api.middleware, userAPI.middleware), // ✅ Fixed array syntax
});

// Persistor
export const persistor = persistStore(store);

// Types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
