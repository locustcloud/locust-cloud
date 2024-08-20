import { ReactNode } from 'react';
import { Navbar, SWARM_STATE } from 'locust-ui';

import Toolbar from 'components/Toolbar/Toolbar';
import { useLocustSelector } from 'redux/hooks';

interface ILayout {
  children: ReactNode;
}

export default function Layout({ children }: ILayout) {
  const swarmState = useLocustSelector(({ swarm }) => swarm.state);

  return (
    <>
      <Navbar />
      {swarmState !== SWARM_STATE.READY && <Toolbar />}
      <main>{children}</main>
    </>
  );
}
