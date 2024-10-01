import { ReactNode } from 'react';
import { Navbar, SWARM_STATE } from 'locust-ui';

import ViewTypeSelector from 'components/Layout/ViewTypeSelector';
import { useLocustSelector } from 'redux/hooks';

interface ILayout {
  children: ReactNode;
}

export default function Layout({ children }: ILayout) {
  const swarmState = useLocustSelector(({ swarm }) => swarm.state);

  return (
    <>
      <Navbar />
      {!window.templateArgs.isGraphViewer && swarmState !== SWARM_STATE.READY && (
        <ViewTypeSelector />
      )}
      <main>{children}</main>
    </>
  );
}
