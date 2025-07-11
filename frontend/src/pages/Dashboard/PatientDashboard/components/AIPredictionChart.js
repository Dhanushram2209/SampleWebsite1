import React from 'react';
import { Line } from '@ant-design/charts';
import { Card, Typography } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

const AIPredictionChart = ({ data }) => {
  const config = {
    data,
    xField: 'date',
    yField: 'value',
    seriesField: 'metric',
    yAxis: {
      label: {
        formatter: (v) => `${v}${v === 'bloodPressure' ? '' : v === 'heartRate' ? ' bpm' : v === 'bloodSugar' ? ' mg/dL' : '%'}`,
      },
    },
    legend: {
      position: 'top',
    },
    smooth: true,
    animation: {
      appear: {
        animation: 'path-in',
        duration: 5000,
      },
    },
    color: ({ metric }) => {
      switch (metric) {
        case 'bloodPressure': return '#ff4d4f';
        case 'heartRate': return '#1890ff';
        case 'bloodSugar': return '#722ed1';
        case 'oxygenLevel': return '#52c41a';
        case 'riskScore': return '#faad14';
        default: return '#000';
      }
    },
    point: {
      size: 4,
      shape: 'circle',
    },
  };

  return (
    <div>
      <Line {...config} />
      <div style={{ marginTop: '16px' }}>
        <Text type="secondary">
          <InfoCircleOutlined /> Predictions are based on your historical data and may vary based on lifestyle changes.
        </Text>
      </div>
    </div>
  );
};

export default AIPredictionChart;