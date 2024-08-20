import { useCallback } from 'react';
import { ActionCreator } from '@reduxjs/toolkit';
import { IRootState as ILocustState } from 'locust-ui';
import { TypedUseSelectorHook, useSelector as useBaseSelector } from 'react-redux';
import { createSelectorHook } from 'react-redux';

import { ReduxContext } from 'redux/slice/root.slice';
import { IRootState, Action, store } from 'redux/store';

export const useLocustSelector: TypedUseSelectorHook<ILocustState> = useBaseSelector;
export const useSelector: TypedUseSelectorHook<IRootState> = createSelectorHook(ReduxContext);
export const useDispatch = () => (action: Action) => store.dispatch(action);

export function useAction<T extends ActionCreator<Action>>(action: T, dispatch?: any) {
  const dispatchAction = dispatch ? dispatch : useDispatch();

  return useCallback(
    (payload?: Parameters<T>[0]) => {
      dispatchAction(action(payload));
    },
    [action, dispatchAction],
  );
}
