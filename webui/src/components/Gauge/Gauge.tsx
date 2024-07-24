import { useEffect, useRef, useState } from "react";

import { init, registerTheme, dispose, ECharts } from "echarts";

const CHART_TEXT_COLOR = "#b3c3bc";
const CHART_AXIS_COLOR = "#999";

registerTheme("locust", {
  backgroundColor: "#27272a",
  textStyle: { color: CHART_TEXT_COLOR },
  title: {
    textStyle: { color: CHART_TEXT_COLOR },
  },
});

const createOptions = ({ name }) => ({
  series: [
    {
      type: "gauge",
      center: ["50%", "60%"],
      startAngle: 200,
      endAngle: -20,
      min: 0,
      max: 100,
      splitNumber: 10,
      itemStyle: {
        color: "#FFAB91",
      },
      progress: {
        show: true,
        width: 10,
      },
      pointer: {
        show: false,
      },
      axisLine: {
        lineStyle: {
          width: 10,
        },
      },
      axisTick: {
        distance: -25,
        splitNumber: 5,
        lineStyle: {
          width: 2,
          color: CHART_AXIS_COLOR,
        },
      },
      splitLine: {
        distance: -32,
        length: 14,
        lineStyle: {
          width: 3,
          color: CHART_AXIS_COLOR,
        },
      },
      axisLabel: {
        distance: -45,
        color: CHART_AXIS_COLOR,
        fontSize: 16,
      },
      anchor: {
        color: "Red",
      },
      title: {
        color: "inherit",
      },
      detail: {
        valueAnimation: true,
        width: "60%",
        lineHeight: 40,
        borderRadius: 8,
        offsetCenter: [0, "-15%"],
        fontSize: 40,
        fontWeight: "bolder",
        formatter: "{value}%",
        color: "inherit",
      },
      data: [{ value: 0, name }],
    },
  ],
});

interface IGauge {
  name: string;
  gaugeValue: string | number;
}

export default function Gauge({ name, gaugeValue }: IGauge) {
  const [gauge, setGauge] = useState<ECharts | null>(null);

  const gaugeContainer = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!gaugeContainer.current) {
      return;
    }

    const initGauge = init(gaugeContainer.current, "locust");
    initGauge.setOption(createOptions({ name }));

    const handleChartResize = () => initGauge.resize();
    window.addEventListener("resize", handleChartResize);

    setGauge(initGauge);

    return () => {
      dispose(initGauge);
      window.removeEventListener("resize", handleChartResize);
    };
  }, []);

  useEffect(() => {
    if (gauge) {
      gauge.setOption({
        series: [{ data: [{ value: gaugeValue, name }] }],
      });
    }
  }, [gauge, gaugeValue]);

  return (
    <div ref={gaugeContainer} style={{ width: "100%", height: "300px" }}></div>
  );
}
