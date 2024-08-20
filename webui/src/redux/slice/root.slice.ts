import { createContext } from 'react';
import { combineReducers } from '@reduxjs/toolkit';

import toolbar, { IToolbarState, ToolbarAction } from 'redux/slice/toolbar.slice';

export interface IRootState {
  toolbar: IToolbarState;
}

export type Action = ToolbarAction;

export const ReduxContext = createContext(null);

const rootReducer = combineReducers({
  toolbar,
});

export default rootReducer;
