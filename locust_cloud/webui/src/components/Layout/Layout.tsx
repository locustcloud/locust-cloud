import { ReactNode } from 'react';
import { Box } from '@mui/material';
import { Navbar } from 'locust-ui';

import Footer from 'components/Layout/Footer';

interface ILayout {
  children: ReactNode;
}

export default function Layout({ children }: ILayout) {
  return (
    <>
      <Box sx={{ minHeight: 'calc(100vh - var(--footer-height))' }}>
        <Navbar />
        <main>{children}</main>
      </Box>
      <Footer />
    </>
  );
}
