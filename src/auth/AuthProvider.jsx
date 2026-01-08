import React, { createContext, useCallback, useEffect, useMemo, useReducer } from 'react';
import { toast } from 'react-hot-toast';
import { loginExchange, employeeLogin, sessionValidate, getMe } from '../api/auth';
import { myPermissionsGet } from '../api/admin';
import {
  clearMeCache,
  clearPermissionsCache,
  clearSessionToken,
  loadMeCache,
  loadPermissionsCache,
  loadSessionToken,
  saveMeCache,
  savePermissionsCache,
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

  const refreshMe = useCallback(
    async (token) => {
      const meRes = await getMe(token);
      return meRes.me;
    },
    []
  );

  const refreshPermissions = useCallback(async (token) => {
    try {
      const res = await myPermissionsGet(token);
      return res;
    } catch (e) {
      return null;
    }
  }, []);

  const loginWithGoogleIdToken = useCallback(
    async (idToken) => {
      const data = await loginExchange(idToken);
      const token = data.sessionToken;
      if (!token) {
        throw new Error('Backend did not return sessionToken');
      }

      saveSessionToken(token);
      const me = data.me ?? (await refreshMe(token));

      // Permissions are best-effort: keep legacy role-based fallbacks if unavailable.
      const permissions = await refreshPermissions(token);

      dispatch({ type: 'LOGIN_SUCCESS', payload: { token, me, permissions } });
      saveMeCache(me);
      if (permissions) savePermissionsCache(permissions);
      toast.success('Signed in');
      return { token, me };
    },
    [refreshMe, refreshPermissions]
  );

  const loginWithEmployeeId = useCallback(
    async (employeeId) => {
      const data = await employeeLogin(employeeId);
      const token = data.sessionToken;
      if (!token) {
        throw new Error('Backend did not return sessionToken');
      }

      saveSessionToken(token);
      const me = data.me ?? (await refreshMe(token));

      const permissions = await refreshPermissions(token);

      dispatch({ type: 'LOGIN_SUCCESS', payload: { token, me, permissions } });
      saveMeCache(me);
      if (permissions) savePermissionsCache(permissions);
      toast.success('Signed in');
      return { token, me };
    },
    [refreshMe, refreshPermissions]
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
      const cachedPermissions = loadPermissionsCache();
      if (!cancelled) {
        dispatch({
          type: 'INIT_DONE',
          payload: { token, me: cachedMe ?? null, permissions: cachedPermissions ?? null },
        });
      }

      try {
        const v = await sessionValidate(token);
        if (!v.valid) {
          clearSessionToken();
          clearMeCache();
          clearPermissionsCache();
          if (!cancelled) dispatch({ type: 'INIT_DONE', payload: { token: null, me: null } });
          return;
        }

        const [me, permissions] = await Promise.all([refreshMe(token), refreshPermissions(token)]);
        if (cancelled) return;

        dispatch({ type: 'SESSION_REFRESH', payload: { me, permissions } });
        if (me) saveMeCache(me);
        if (permissions) savePermissionsCache(permissions);
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
  }, [refreshMe, refreshPermissions]);

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

      loginWithGoogleIdToken,
      loginWithEmployeeId,
      logout,
    }),
    [state, role, legacyRole, uiSet, actionSet, loginWithGoogleIdToken, loginWithEmployeeId, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
