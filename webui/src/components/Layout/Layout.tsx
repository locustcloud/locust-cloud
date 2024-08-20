import { ReactNode } from 'react';
import { Navbar } from 'locust-ui';

import Toolbar from 'components/Toolbar/Toolbar';

interface ILayout {
  children: ReactNode;
}

export default function Layout({ children }: ILayout) {
  return (
    <>
      <Navbar />
      <Toolbar />
      <main>{children}</main>
    </>
  );
}
