import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'DEALER';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'INACTIVE';
  businessName?: string | null;
  assignedWarehouseId?: string | null;
  phone?: string | null;
  impersonatedBy?: string | { id: string; name: string } | null;
  impersonatedByName?: string | null;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isImpersonated: boolean;
  impersonatedBy: { id: string; name: string } | null;
}

const initialState: AuthState = {
  user: null,
  // Access token lives in memory only; the HttpOnly refresh cookie restores it after reload.
  token: null,
  isAuthenticated: false,
  isImpersonated: false,
  impersonatedBy: null,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{
        user: AuthUser;
        token: string;
        isImpersonated?: boolean;
        impersonatedBy?: { id: string; name: string } | null;
      }>
    ) => {
      const { user, token } = action.payload;
      state.user = user;
      state.token = token;
      state.isAuthenticated = true;

      const isImp = Boolean(action.payload.isImpersonated || user.impersonatedBy);
      state.isImpersonated = isImp;

      if (action.payload.impersonatedBy) {
        state.impersonatedBy = action.payload.impersonatedBy;
      } else if (user.impersonatedBy) {
        state.impersonatedBy =
          typeof user.impersonatedBy === 'object'
            ? user.impersonatedBy
            : {
                id: String(user.impersonatedBy),
                name: user.impersonatedByName || 'Administrator',
              };
      } else {
        state.impersonatedBy = null;
      }
    },
    updateToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.isImpersonated = false;
      state.impersonatedBy = null;
    },
  },
});

export const { setCredentials, updateToken, logout } = authSlice.actions;
export default authSlice.reducer;
