import { Box, SelectChangeEvent } from "@mui/material";
import {
  LineChart,
  Table,
  useInterval,
  roundToDecimalPlaces,
  IRootState,
  SWARM_STATE,
  Select,
} from "locust-ui";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import {
  IRequestBody,
  adaptPerNameChartData,
  fetchQuery,
  IPerRequestResponse,
  IPerRequestData,
  chartValueFormatter,
} from "utils/api";

interface IRequestLines {
  name: string;
  key: string;
}

interface IRpsResponse {
  users: number;
  rps: number;
  errorRate: number;
  time: string;
}

interface IRpsData {
  users: [string, number][];
  rps: [string, number][];
  errorRate: [string, number][];
}

interface IRpsPerRequestResponse extends IPerRequestResponse {
  throughput: number;
}

interface IAvgResponseTimesResponse extends IPerRequestResponse {
  responseTime: number;
}

interface IErrorsPerRequestResponse extends IPerRequestResponse {
  errorRate: number;
}

interface IPerc99ResponseTimesResponse extends IPerRequestResponse {
  perc99: number;
}

interface IResponseLengthResponse extends IPerRequestResponse {
  responseLength: number;
}

export default function Timescale() {
  const swarmState = useSelector(({ swarm }: IRootState) => swarm.state);
  const startTime = useSelector(({ swarm }: IRootState) => swarm.startTime);

  const [timestamp, setTimestamp] = useState(new Date().toISOString());
  const [resolution, setResolution] = useState(5);
  const [requestLines, setRequestLines] = useState<IRequestLines[]>([]);
  const [rpsData, setRpsData] = useState<IRpsData>({} as IRpsData);
  const [rpsPerRequest, setRpsPerRequest] = useState<IPerRequestData>({});
  const [avgResponseTimes, setAvgResponseTimes] = useState<IPerRequestData>({});
  const [errorsPerRequest, setErrorsPerRequest] = useState<IPerRequestData>({});
  const [perc99ResponseTimes, setPerc99ResponseTimes] =
    useState<IPerRequestData>({});
  const [responseLength, setResponseLength] = useState<IPerRequestData>({});

  const getRequestNames = (body: IRequestBody) =>
    fetchQuery<{ name: string }[]>(
      "/cloud-stats/request-names",
      body,
      (requestNames) =>
        setRequestLines(
          requestNames.map(({ name: requestName }) => ({
            name: `${requestName}`,
            key: requestName,
          }))
        )
    );
  const getRps = (body: IRequestBody) =>
    fetchQuery<IRpsResponse[]>("/cloud-stats/rps", body, (rps) =>
      setRpsData(
        rps.reduce(
          (rpsChart, { users, rps, errorRate, time }) => ({
            users: [...(rpsChart.users || []), [time, users]],
            rps: [...(rpsChart.rps || []), [time, rps]],
            errorRate: [...(rpsChart.errorRate || []), [time, errorRate]],
          }),
          {} as IRpsData
        )
      )
    );

  const getRpsPerRequest = (body: IRequestBody) =>
    fetchQuery<IRpsPerRequestResponse[]>(
      "/cloud-stats/rps-per-request",
      body,
      (rpsPerRequest) =>
        setRpsPerRequest(
          adaptPerNameChartData<IRpsPerRequestResponse>(
            rpsPerRequest,
            "throughput"
          )
        )
    );
  const getAvgResponseTimes = (body: IRequestBody) =>
    fetchQuery<IAvgResponseTimesResponse[]>(
      "/cloud-stats/avg-response-times",
      body,
      (avgResponseTimes) =>
        setAvgResponseTimes(
          adaptPerNameChartData<IAvgResponseTimesResponse>(
            avgResponseTimes,
            "responseTime"
          )
        )
    );
  const getErrorsPerRequest = (body: IRequestBody) =>
    fetchQuery<IErrorsPerRequestResponse[]>(
      "/cloud-stats/errors-per-request",
      body,
      (errorsPerRequest) =>
        setErrorsPerRequest(
          adaptPerNameChartData<IErrorsPerRequestResponse>(
            errorsPerRequest,
            "errorRate"
          )
        )
    );
  const getPerc99ResponseTimes = (body: IRequestBody) =>
    fetchQuery<IPerc99ResponseTimesResponse[]>(
      "/cloud-stats/perc99-response-times",
      body,
      (perc99ResponseTimes) =>
        setPerc99ResponseTimes(
          adaptPerNameChartData<IPerc99ResponseTimesResponse>(
            perc99ResponseTimes,
            "perc99"
          )
        )
    );
  const getResponseLength = (body: IRequestBody) =>
    fetchQuery<IResponseLengthResponse[]>(
      "/cloud-stats/response-length",
      body,
      (responseLength) =>
        setResponseLength(
          adaptPerNameChartData<IResponseLengthResponse>(
            responseLength,
            "responseLength"
          )
        )
    );

  const fetchTimescaleGraphs = () => {
    const currentTimestamp = new Date().toISOString();

    getRequestNames({ start: startTime, end: timestamp });
    getRpsPerRequest({ start: startTime, end: timestamp, resolution });
    getAvgResponseTimes({ start: startTime, end: timestamp });
    getErrorsPerRequest({ start: startTime, end: timestamp, resolution });
    getPerc99ResponseTimes({ start: startTime, end: timestamp, resolution });
    getResponseLength({ start: startTime, end: timestamp });
    getRps({ start: startTime, end: timestamp, resolution });

    setTimestamp(currentTimestamp);
  };

  useInterval(fetchTimescaleGraphs, 1000, {
    shouldRunInterval:
      swarmState === SWARM_STATE.SPAWNING || swarmState == SWARM_STATE.RUNNING,
  });

  useEffect(() => {
    fetchTimescaleGraphs();
  }, []);

  return (
    <>
      <Box sx={{ my: 4 }}>
        <Select
          defaultValue={"5"}
          label="Resolution"
          name="resolution"
          sx={{ width: "150px" }}
          onChange={(e: SelectChangeEvent<unknown>) =>
            setResolution(Number(e.target.value))
          }
          options={["1", "2", "5", "10", "30"]}
        />
      </Box>

      <LineChart<IRpsData>
        colors={["#00ca5a", "#0099ff", "#ff6d6d"]}
        lines={[
          {
            name: "Users",
            key: "users",
            yAxisIndex: 0,
          },
          {
            name: "Requests per Second",
            key: "rps",
            yAxisIndex: 1,
            areaStyle: {},
          },
          {
            name: "Errors per Second",
            key: "errorRate",
            yAxisIndex: 1,
            areaStyle: {},
          },
        ]}
        title="Throughput / active users"
        charts={rpsData}
        splitAxis
        yAxisLabels={["Users", "RPS"]}
        chartValueFormatter={chartValueFormatter}
      />
      <LineChart<IPerRequestData>
        colors={[
          "#9966CC",
          "#8A2BE2",
          "#8E4585",
          "#E0B0FF",
          "#C8A2C8",
          "#E6E6FA",
        ]}
        lines={requestLines}
        title="Average Response Times"
        charts={avgResponseTimes}
        chartValueFormatter={(v) =>
          `${roundToDecimalPlaces(Number((v as string[])[1]), 2)}ms`
        }
      />
      <LineChart<IPerRequestData>
        colors={[
          "#9966CC",
          "#8A2BE2",
          "#8E4585",
          "#E0B0FF",
          "#C8A2C8",
          "#E6E6FA",
        ]}
        lines={requestLines}
        title="RPS per Request"
        charts={rpsPerRequest}
        chartValueFormatter={chartValueFormatter}
      />
      <LineChart<IPerRequestData>
        colors={[
          "#ff8080",
          "#ff4d4d",
          "#ff1a1a",
          "#e60000",
          "#b30000",
          "#800000",
        ]}
        lines={requestLines}
        title="Errors per Request"
        charts={errorsPerRequest}
        chartValueFormatter={chartValueFormatter}
      />
      <LineChart<IPerRequestData>
        colors={[
          "#9966CC",
          "#8A2BE2",
          "#8E4585",
          "#E0B0FF",
          "#C8A2C8",
          "#E6E6FA",
        ]}
        lines={requestLines}
        title="99th Percentile Response Times"
        charts={perc99ResponseTimes}
        chartValueFormatter={chartValueFormatter}
      />
      <LineChart<IPerRequestData>
        colors={[
          "#9966CC",
          "#8A2BE2",
          "#8E4585",
          "#E0B0FF",
          "#C8A2C8",
          "#E6E6FA",
        ]}
        lines={requestLines}
        title="Response Length"
        charts={responseLength}
        chartValueFormatter={chartValueFormatter}
      />
    </>
  );
}
