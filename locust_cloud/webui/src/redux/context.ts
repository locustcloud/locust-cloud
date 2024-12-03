import { createContext } from 'react';
import { ReactReduxContextValue } from 'react-redux';

export const ReduxContext = createContext<ReactReduxContextValue | null>(null);
