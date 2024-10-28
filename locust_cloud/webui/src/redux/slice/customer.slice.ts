import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { ICustomer } from 'types/customer.types';

import { updateStateWithPayload } from 'redux/utils';

export interface ICustomerState extends Partial<ICustomer> {
  username: string;
}

export type CustomerAction = PayloadAction<Partial<ICustomerState>>;

const initialState = {
  username: window.templateArgs.username,
};

const customerSlice = createSlice({
  name: 'customer',
  initialState,
  reducers: {
    setCustomer: updateStateWithPayload,
  },
});

export const customerActions = customerSlice.actions;
export default customerSlice.reducer;
