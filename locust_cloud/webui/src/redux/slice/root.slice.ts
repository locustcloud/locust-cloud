import { createContext } from 'react';
import { combineReducers } from '@reduxjs/toolkit';
import { ReactReduxContextValue } from 'react-redux';

import { cloudStats } from 'redux/api/cloud-stats';
import snackbar, { ISnackbarSlice, SnackbarAction } from 'redux/slice/snackbar.slice';
import toolbar, { IToolbarState, ToolbarAction } from 'redux/slice/toolbar.slice';
import ui, { IUiState, UiAction } from 'redux/slice/ui.slice';

export interface IRootState {
  snackbar: ISnackbarSlice;
  toolbar: IToolbarState;
  ui: IUiState;
}

export type Action = SnackbarAction | ToolbarAction | UiAction;
export const ReduxContext = createContext<ReactReduxContextValue<IRootState, any> | null>(null);

const rootReducer = combineReducers({
  [cloudStats.reducerPath]: cloudStats.reducer,
  snackbar,
  toolbar,
  ui,
});

export default rootReducer;
