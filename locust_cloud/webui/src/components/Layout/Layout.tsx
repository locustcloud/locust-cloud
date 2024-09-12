import { ReactNode } from 'react';
import { Navbar } from 'locust-ui';

interface ILayout {
  children: ReactNode;
}

export default function Layout({ children }: ILayout) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
    </>
  );
}
