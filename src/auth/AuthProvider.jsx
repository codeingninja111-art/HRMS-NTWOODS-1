import React, { createContext, useCallback, useEffect, useMemo, useReducer } from 'react';
import { toast } from 'react-hot-toast';
import { login, me as apiMe } from '../api/auth';
import {
  clearMeCache,
  clearPermissionsCache,
  clearSessionToken,
  loadMeCache,
  loadSessionToken,
  saveMeCache,
  saveSessionToken,
} from '../utils/storage';

export const AuthContext = createContext(null);

function normalizeRole_(role) {
  const r = String(role || '').trim().toUpperCase();
  return r || null;
}

function legacyRole_(role) {
  const r = normalizeRole_(role);
  if (r === 'ADMIN' || r === 'EA' || r === 'HR' || r === 'OWNER') return r;
  return null;
}

const initialState = {
  status: 'loading',
  token: null,
  me: null,
  permissions: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'INIT_DONE':
      return {
        ...state,
        status: action.payload.token ? 'authenticated' : 'anonymous',
        token: action.payload.token,
        me: action.payload.me,
        permissions: action.payload.permissions ?? null,
      };
    case 'SESSION_REFRESH':
      return {
        ...state,
        me: action.payload.me ?? state.me,
        permissions: action.payload.permissions ?? state.permissions,
      };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        status: 'authenticated',
        token: action.payload.token,
        me: action.payload.me,
        permissions: action.payload.permissions ?? null,
      };
    case 'LOGOUT':
      return { ...state, status: 'anonymous', token: null, me: null, permissions: null };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const logout = useCallback(() => {
    clearSessionToken();
    clearMeCache();
    clearPermissionsCache();
    dispatch({ type: 'LOGOUT' });
  }, []);

  const refreshMe = useCallback(async (token) => {
    return await apiMe(token);
  }, []);

  const loginWithPassword = useCallback(
    async (email, password) => {
      const data = await login(email, password);
      const token = data?.access_token;
      if (!token) throw new Error('Backend did not return access_token');

      saveSessionToken(token);
      const profile = data?.user ?? (await refreshMe(token));

      dispatch({ type: 'LOGIN_SUCCESS', payload: { token, me: profile, permissions: null } });
      saveMeCache(profile);
      toast.success('Signed in');
      return { token, me: profile };
    },
    [refreshMe]
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const token = loadSessionToken();
      if (!token) {
        if (!cancelled) dispatch({ type: 'INIT_DONE', payload: { token: null, me: null } });
        return;
      }

      // Fast-path: render app immediately with cached profile/permissions (if available).
      const cachedMe = loadMeCache();
      if (!cancelled) {
        dispatch({
          type: 'INIT_DONE',
          payload: { token, me: cachedMe ?? null, permissions: null },
        });
      }

      try {
        const me = await refreshMe(token);
        if (cancelled) return;

        dispatch({ type: 'SESSION_REFRESH', payload: { me, permissions: null } });
        if (me) saveMeCache(me);
      } catch (e) {
        clearSessionToken();
        clearMeCache();
        clearPermissionsCache();
        if (!cancelled) dispatch({ type: 'INIT_DONE', payload: { token: null, me: null } });
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [refreshMe]);

  const role = normalizeRole_(state.me?.role);
  const legacyRole = legacyRole_(state.me?.role);

  const uiSet = useMemo(() => new Set(state.permissions?.uiKeys || []), [state.permissions]);
  const actionSet = useMemo(() => new Set(state.permissions?.actionKeys || []), [state.permissions]);

  const value = useMemo(
    () => ({
      status: state.status,
      token: state.token,
      me: state.me,
      role,
      legacyRole,
      permissions: state.permissions,
      isAuthenticated: state.status === 'authenticated',

      // Permission helpers (UI only; backend RBAC is still enforced server-side).
      canPortal: (key) => {
        if (!state.permissions) return null;
        return uiSet.has(String(key || '').toUpperCase());
      },
      canUi: (key) => {
        if (!state.permissions) return null;
        return uiSet.has(String(key || '').toUpperCase());
      },
      canAction: (key) => {
        if (!state.permissions) return null;
        return actionSet.has(String(key || '').toUpperCase());
      },

      loginWithPassword,
      logout,
    }),
    [state, role, legacyRole, uiSet, actionSet, loginWithPassword, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
