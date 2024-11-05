import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { updateStateWithPayload } from 'redux/utils';

export const UI_VIEW_TYPES = {
  CLOUD: 'CLOUD',
  CLASSIC: 'CLASSIC',
};

export interface IUiState {
  viewType: (typeof UI_VIEW_TYPES)[keyof typeof UI_VIEW_TYPES];
  hasDismissedSwarmForm: boolean;
}

export type UiAction = PayloadAction<Partial<IUiState>>;

const initialState = {
  viewType: UI_VIEW_TYPES.CLOUD,
  hasDismissedSwarmForm: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setUi: updateStateWithPayload,
  },
});

export const uiActions = uiSlice.actions;
export default uiSlice.reducer;
