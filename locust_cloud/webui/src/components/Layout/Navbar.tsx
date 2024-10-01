import { AppBar, Box, Container, Link, Toolbar } from '@mui/material';
import { Logo, DarkLightToggle, SwarmMonitor } from 'locust-ui';

import StateButtons from 'components/Layout/StateButtons';

export default function Navbar() {
  return (
    <AppBar position='static'>
      <Container maxWidth='xl'>
        <Toolbar
          disableGutters
          sx={{ display: 'flex', justifyContent: 'space-between', columnGap: 2 }}
        >
          <Link
            color='inherit'
            href='/'
            sx={{ display: 'flex', alignItems: 'center' }}
            underline='none'
          >
            <Logo />
          </Link>
          <Box sx={{ display: 'flex', columnGap: 6 }}>
            {!window.templateArgs.isGraphViewer && (
              <>
                <SwarmMonitor />
                <StateButtons />
              </>
            )}
            <DarkLightToggle />
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
