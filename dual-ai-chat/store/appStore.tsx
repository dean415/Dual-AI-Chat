import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { ApiProviderConfig, TeamPreset } from '../types';
import { ensureSchemaAndMigrate, save, STORAGE_KEYS } from '../utils/storage';

type AppState = {
  apiProviders: ApiProviderConfig[];
  teamPresets: TeamPreset[];
  activeTeamId: string;
};

type Action =
  | { type: 'setProviders'; providers: ApiProviderConfig[] }
  | { type: 'setTeamPresets'; teamPresets: TeamPreset[] }
  | { type: 'setActiveTeam'; teamId: string };

const AppStoreContext = createContext<{
  state: AppState;
  setProviders: (providers: ApiProviderConfig[]) => void;
  setTeamPresets: (teamPresets: TeamPreset[]) => void;
  setActiveTeam: (teamId: string) => void;
} | null>(null);

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'setProviders':
      return { ...state, apiProviders: action.providers };
    case 'setTeamPresets':
      return { ...state, teamPresets: action.teamPresets };
    case 'setActiveTeam':
      return { ...state, activeTeamId: action.teamId };
    default:
      return state;
  }
}

export const AppStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const init = useMemo(() => ensureSchemaAndMigrate(), []);
  const [state, dispatch] = useReducer(reducer, {
    apiProviders: init.apiProviders,
    teamPresets: init.teamPresets,
    activeTeamId: init.activeTeamId,
  });

  // Persist on changes (throttled in save())
  useEffect(() => { save(STORAGE_KEYS.apiProviders, state.apiProviders); }, [state.apiProviders]);
  useEffect(() => { save(STORAGE_KEYS.teamPresets, state.teamPresets); }, [state.teamPresets]);
  useEffect(() => { save(STORAGE_KEYS.activeTeamId, state.activeTeamId); }, [state.activeTeamId]);

  const value = useMemo(() => ({
    state,
    setProviders: (providers: ApiProviderConfig[]) => dispatch({ type: 'setProviders', providers }),
    setTeamPresets: (teamPresets: TeamPreset[]) => dispatch({ type: 'setTeamPresets', teamPresets }),
    setActiveTeam: (teamId: string) => dispatch({ type: 'setActiveTeam', teamId }),
  }), [state]);

  return (
    <AppStoreContext.Provider value={value}>
      {children}
    </AppStoreContext.Provider>
  );
};

export function useAppStore() {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error('useAppStore must be used within AppStoreProvider');
  return ctx;
}

