import { useEffect, useRef, useState } from "react";

import { init, dispose, ECharts } from "echarts";
import { useSelector } from "react-redux";
import { IRootState } from "locust-ui";

interface IGauge {
  name: string;
  gaugeValue: string | number;
}

const createOptions = ({ name }: { name: IGauge["name"] }) => ({
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
      },
      splitLine: {
        distance: -32,
        length: 14,
      },
      axisLabel: {
        distance: -45,
        fontSize: 16,
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

export default function Gauge({ name, gaugeValue }: IGauge) {
  const isDarkMode = useSelector(
    ({ theme: { isDarkMode } }: IRootState) => isDarkMode
  );
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

  useEffect(() => {
    if (gauge) {
      const chartTextColor = isDarkMode ? "#b3c3bc" : "#000";
      const chartAxisColor = isDarkMode ? "#b3c3bc" : "#000";

      gauge.setOption({
        textStyle: { color: chartTextColor },
        title: {
          textStyle: { color: chartTextColor },
        },
        series: [
          {
            axisTick: {
              distance: -25,
              splitNumber: 5,
              lineStyle: {
                width: 2,
                color: chartAxisColor,
              },
            },
            splitLine: {
              distance: -32,
              length: 14,
              lineStyle: {
                width: 3,
                color: chartAxisColor,
              },
            },
            axisLabel: {
              color: chartAxisColor,
            },
            title: {
              color: chartTextColor,
            },
          },
        ],
      });
    }
  }, [gauge, isDarkMode]);

  return (
    <div ref={gaugeContainer} style={{ width: "100%", height: "300px" }}></div>
  );
}
