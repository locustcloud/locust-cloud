import { LineChart, useInterval, IRootState, SWARM_STATE } from "locust-ui";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import {
  IPerRequestData,
  IPerRequestResponse,
  IRequestBody,
  adaptPerNameChartData,
  fetchQuery,
  perRequestValueFormatter,
} from "utils/api";

interface IScatterplotData {
  name: string;
  responseTime: number;
  time: string;
}

interface IScatterplotResponse extends IPerRequestResponse {
  responseTime: number;
}

interface IRequestLines {
  name: string;
  key: string;
}

export default function Scatterplot() {
  const swarmState = useSelector(({ swarm }: IRootState) => swarm.state);
  const startTime = useSelector(({ swarm }: IRootState) => swarm.startTime);

  const [timestamp, setTimestamp] = useState(new Date().toISOString());
  const [scatterplot, setScatterplot] = useState<IPerRequestData>();
  const [requestLines, setRequestLines] = useState<IRequestLines[]>();

  const getScatterplot = (body: IRequestBody) =>
    fetchQuery<IScatterplotData[]>(
      "/cloud-stats/scatterplot",
      body,
      (scatterplot) =>
        setScatterplot(
          adaptPerNameChartData<IScatterplotResponse>(
            scatterplot,
            "responseTime"
          )
        )
    );

  const getRequestNames = (body: IRequestBody) =>
    fetchQuery<{ name: string }[]>(
      "/cloud-stats/request-names",
      body,
      (requestNames) => {
        (!requestLines ||
          (requestLines &&
            !requestNames.every(
              ({ name }, index) => requestLines[index].name === name
            ))) &&
          setRequestLines(
            requestNames.map(({ name: requestName }) => ({
              name: `${requestName}`,
              key: requestName,
            }))
          );
      }
    );

  const fetchScatterplot = () => {
    const currentTimestamp = new Date().toISOString();

    getRequestNames({ start: startTime, end: timestamp });
    getScatterplot({ start: startTime, end: timestamp });

    setTimestamp(currentTimestamp);
  };

  useInterval(
    () => {
      fetchScatterplot();
    },
    5000,
    {
      shouldRunInterval:
        swarmState === SWARM_STATE.SPAWNING ||
        swarmState == SWARM_STATE.RUNNING,
    }
  );

  useEffect(() => {
    fetchScatterplot();
  }, []);

  return (
    <div>
      {scatterplot && requestLines && (
        <LineChart<IPerRequestData>
          colors={[
            "#8A2BE2",
            "#0000FF",
            "#00ca5a",
            "#FFA500",
            "#FFFF00",
            "#EE82EE",
          ]}
          lines={requestLines}
          scatterplot
          title="Scatterplot"
          charts={scatterplot}
          chartValueFormatter={perRequestValueFormatter}
        />
      )}
    </div>
  );
}
