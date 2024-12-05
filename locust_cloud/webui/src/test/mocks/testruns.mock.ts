export const mockRunIds = [
  '2024-11-30 10:09:10.771147+00:00',
  '2024-10-30 05:58:31.234505+00:00',
  '2024-10-30 06:00:44.325405+00:00',
];

export const mockTestrunsForDisplay = mockRunIds.map(runId => new Date(runId).toLocaleString());

export const mockTestrunsResponse = [
  {
    endTime: '2024-11-30 11:00:37.653931+00:00',
    locustfile: 'locustfile.py',
    profile: null,
    runId: mockRunIds[0],
  },
  {
    endTime: '2024-10-30 08:39:22.358997+00:00',
    locustfile: 'locustfile.py',
    profile: null,
    runId: mockRunIds[1],
  },
  {
    endTime: '2024-10-30 08:39:22.358997+00:00',
    locustfile: 'different_locustfile.py',
    profile: 'myprofile',
    runId: mockRunIds[2],
  },
];

export const mockTestruns = {
  [mockTestrunsForDisplay[0]]: {
    runId: mockRunIds[0],
    endTime: mockTestrunsResponse[0].endTime,
    index: 0,
  },
  [mockTestrunsForDisplay[1]]: {
    runId: mockRunIds[1],
    endTime: mockTestrunsResponse[1].endTime,
    index: 1,
  },
  [mockTestrunsForDisplay[2]]: {
    runId: mockRunIds[2],
    endTime: mockTestrunsResponse[2].endTime,
    index: 2,
  },
};
