import { ru } from 'date-fns/locale';
import { StatsSnapshotData } from '../api';

const toPoint = (s: StatsSnapshotData, value: number) => ({ x: new Date(s.timestamp), y: value });

const SEVENTY_TWO_HOURS = 72 * 60 * 60 * 1000;

function filterLast72h(data: StatsSnapshotData[]): StatsSnapshotData[] {
  const cutoff = Date.now() - SEVENTY_TWO_HOURS;
  return data.filter((s) => new Date(s.timestamp).getTime() >= cutoff);
}

function computeDeltas(
  data: StatsSnapshotData[],
  field: 'networkRxBytes' | 'networkTxBytes',
): { x: Date; y: number }[] {
  if (data.length === 0) return [];
  const result: { x: Date; y: number }[] = [{ x: new Date(data[0].timestamp), y: 0 }];
  for (let i = 1; i < data.length; i++) {
    const delta = data[i][field] - data[i - 1][field];
    result.push({ x: new Date(data[i].timestamp), y: +(Math.max(0, delta) / 1048576).toFixed(2) });
  }
  return result;
}

export function buildChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    interaction: { intersect: false, mode: 'index' as const },
    plugins: {
      legend: { position: 'top' as const },
      tooltip: { mode: 'index' as const, intersect: false },
      zoom: {
        pan: { enabled: true, mode: 'x' as const },
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'x' as const,
        },
        limits: { x: { minRange: 10 * 60 * 1000 } },
      },
    },
    scales: {
      x: {
        type: 'time' as const,
        time: {
          tooltipFormat: 'dd.MM HH:mm',
          displayFormats: { minute: 'HH:mm', hour: 'dd.MM HH:mm' },
        },
        adapters: { date: { locale: ru } },
        ticks: { maxTicksLimit: 12 },
      },
      y: {
        type: 'linear' as const,
        position: 'left' as const,
        title: { display: true, text: 'Подключения / CPU %' },
      },
      y1: {
        type: 'linear' as const,
        position: 'right' as const,
        title: { display: true, text: 'МБ' },
        grid: { drawOnChartArea: false },
      },
    },
  };
}

export function buildChartData(statsHistory: StatsSnapshotData[]) {
  const data = filterLast72h(statsHistory);

  return {
    datasets: [
      {
        label: 'Подключения',
        data: data.map((s) => toPoint(s, s.connectedCount)),
        yAxisID: 'y',
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        fill: false,
        pointRadius: 1,
        tension: 0.3,
      },
      {
        label: 'CPU %',
        data: data.map((s) => toPoint(s, s.cpuPercent)),
        yAxisID: 'y',
        borderColor: 'rgb(255, 159, 64)',
        fill: false,
        pointRadius: 1,
        tension: 0.3,
      },
      {
        label: 'Δ Вход (MB)',
        data: computeDeltas(data, 'networkRxBytes'),
        yAxisID: 'y1',
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.1)',
        fill: false,
        pointRadius: 1,
        tension: 0.3,
      },
      {
        label: 'Δ Исход (MB)',
        data: computeDeltas(data, 'networkTxBytes'),
        yAxisID: 'y1',
        borderColor: 'rgb(255, 99, 132)',
        fill: false,
        pointRadius: 1,
        tension: 0.3,
      },
      {
        label: 'Память (MB)',
        data: data.map((s) => toPoint(s, +(s.memoryBytes / 1048576).toFixed(2))),
        yAxisID: 'y1',
        borderColor: 'rgb(153, 102, 255)',
        fill: false,
        pointRadius: 1,
        tension: 0.3,
      },
    ],
  };
}
