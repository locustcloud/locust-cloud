import { createContext } from 'react';
import { combineReducers } from '@reduxjs/toolkit';
import { ReactReduxContextValue } from 'react-redux';

import toolbar, { IToolbarState, ToolbarAction } from 'redux/slice/toolbar.slice';
import ui, { IUiState, UiAction } from 'redux/slice/ui.slice';

export interface IRootState {
  toolbar: IToolbarState;
  ui: IUiState;
}

export type Action = ToolbarAction | UiAction;
export const ReduxContext = createContext<ReactReduxContextValue<IRootState, any> | null>(null);

const rootReducer = combineReducers({
  toolbar,
  ui,
});

export default rootReducer;
