import { useEffect, useRef, useState } from 'react';
import { init, dispose, ECharts } from 'echarts';
import { IRootState } from 'locust-ui';
import { useSelector } from 'react-redux';

interface IGauge {
  name: string;
  gaugeValue: string | number;
}

const colors = [
  [0, '#00C853'],
  [10, '#ffc40c'],
  [50, '#f44336'],
  [99, '#a91409'],
  [1, '#790e07'],
];

const getColor = (value: string | number) => {
  const color = colors.find(([threshold]) => Number(value) <= (threshold as number)) as (
    | number
    | string
  )[];

  return color ? color[1] : colors[colors.length - 1][1];
};

const createOptions = ({ name }: { name: IGauge['name'] }) => ({
  series: [
    {
      type: 'gauge',
      center: ['50%', '60%'],
      startAngle: 200,
      endAngle: -20,
      min: 0,
      max: 100,
      splitNumber: 10,
      axisTick: { show: false },
      splitLine: { show: false },
      pointer: { show: false },
      axisLabel: { show: false },
      itemStyle: {
        color: colors[0][1],
      },
      progress: {
        show: true,
        width: 10,
      },
      detail: {
        valueAnimation: true,
        width: '60%',
        lineHeight: 40,
        borderRadius: 8,
        offsetCenter: [0, '-15%'],
        fontSize: 40,
        fontWeight: 'bolder',
        formatter: '{value}%',
        color: 'inherit',
      },
      data: [{ value: 0, name }],
    },
  ],
});

export default function Gauge({ name, gaugeValue }: IGauge) {
  const isDarkMode = useSelector(({ theme: { isDarkMode } }: IRootState) => isDarkMode);
  const [gauge, setGauge] = useState<ECharts | null>(null);

  const gaugeContainer = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!gaugeContainer.current) {
      return;
    }

    const initGauge = init(gaugeContainer.current, 'locust');
    initGauge.setOption(createOptions({ name }));

    const handleChartResize = () => initGauge.resize();
    window.addEventListener('resize', handleChartResize);

    setGauge(initGauge);

    return () => {
      dispose(initGauge);
      window.removeEventListener('resize', handleChartResize);
    };
  }, []);

  useEffect(() => {
    if (gauge) {
      gauge.setOption({
        series: [
          {
            data: [{ value: gaugeValue, name }],
            itemStyle: { color: getColor(gaugeValue) },
          },
        ],
      });
    }
  }, [gauge, gaugeValue]);

  useEffect(() => {
    if (gauge) {
      const chartTextColor = isDarkMode ? '#b3c3bc' : '#000';

      gauge.setOption({
        textStyle: { color: chartTextColor },
        title: {
          textStyle: { color: chartTextColor },
        },
        series: [
          {
            title: {
              color: chartTextColor,
            },
          },
        ],
      });
    }
  }, [gauge, isDarkMode]);

  return <div ref={gaugeContainer} style={{ width: '100%', height: '250px' }}></div>;
}
