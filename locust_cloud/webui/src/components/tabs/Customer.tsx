import { Box, Paper, Typography } from '@mui/material';

import { useSelector } from 'redux/hooks';

export default function Customer() {
  const { maxVuh, totalVuh } = useSelector(({ customer }) => customer);

  return (
    <Paper
      elevation={3}
      sx={{
        py: 4,
        px: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        rowGap: 4,
      }}
    >
      {window.templateArgs.username && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexDirection: 'column',
            rowGap: 1,
          }}
        >
          <Typography sx={{ fontWeight: 'bold' }}>Current User</Typography>
          <Typography>{window.templateArgs.username}</Typography>
        </Box>
      )}

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'column',
          rowGap: 1,
        }}
      >
        <Typography sx={{ fontWeight: 'bold' }}>Current Month Virtual User Time</Typography>
        <Typography>Included in Plan: {maxVuh}</Typography>
        <Typography>Used: {totalVuh || '0 minutes'}</Typography>
      </Box>

      {window.templateArgs.locustVersion && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexDirection: 'column',
            rowGap: 1,
          }}
        >
          <Typography sx={{ fontWeight: 'bold' }}>Locust Version</Typography>
          <Typography>{window.templateArgs.locustVersion}</Typography>
        </Box>
      )}

      {window.templateArgs.locustCloudVersion && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexDirection: 'column',
            rowGap: 1,
          }}
        >
          <Typography sx={{ fontWeight: 'bold' }}>Locust Cloud Version</Typography>
          <Typography>{window.templateArgs.locustCloudVersion}</Typography>
        </Box>
      )}
    </Paper>
  );
}
