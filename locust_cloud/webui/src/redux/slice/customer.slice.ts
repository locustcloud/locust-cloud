import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { updateStateWithPayload } from 'redux/utils';
import { ICustomer } from 'types/customer.types';

export interface ICustomerState extends Partial<ICustomer> {
  username: string;
  maxUsers?: number;
  maxVuh?: number;
  maxWorkers?: number;
  usersPerWorker?: number;
  totalVuh?: string;
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
