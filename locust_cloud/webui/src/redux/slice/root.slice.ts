import { createContext } from 'react';
import { combineReducers } from '@reduxjs/toolkit';
import { ReactReduxContextValue } from 'react-redux';

import { cloudStats } from 'redux/api/cloud-stats';
import customer, { CustomerAction, ICustomerState } from 'redux/slice/customer.slice';
import snackbar, { ISnackbarState, SnackbarAction } from 'redux/slice/snackbar.slice';
import toolbar, { IToolbarState, ToolbarAction } from 'redux/slice/toolbar.slice';
import ui, { IUiState, UiAction } from 'redux/slice/ui.slice';

export interface IRootState {
  customer: ICustomerState;
  snackbar: ISnackbarState;
  toolbar: IToolbarState;
  ui: IUiState;
}

export type Action = CustomerAction | SnackbarAction | ToolbarAction | UiAction;
export const ReduxContext = createContext<ReactReduxContextValue<IRootState, any> | null>(null);

const rootReducer = combineReducers({
  [cloudStats.reducerPath]: cloudStats.reducer,
  customer,
  snackbar,
  toolbar,
  ui,
});

export default rootReducer;
