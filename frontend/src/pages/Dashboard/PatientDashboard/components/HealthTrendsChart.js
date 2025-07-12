import React from 'react';
import { Line } from '@ant-design/charts';
import { Card, Typography, Tabs } from 'antd';
import { HeartOutlined } from '@ant-design/icons';

const { Text } = Typography;
const { TabPane } = Tabs;

const HealthTrendsChart = ({ data }) => {
  // Process data for charts
  const processData = () => {
    return data.map(item => ({
      date: item.RecordedAt,
      bloodPressure: item.BloodPressure,
      systolic: item.BloodPressure ? parseInt(item.BloodPressure.split('/')[0]) : null,
      diastolic: item.BloodPressure ? parseInt(item.BloodPressure.split('/')[1]) : null,
      heartRate: item.HeartRate,
      bloodSugar: item.BloodSugar,
      oxygenLevel: item.OxygenLevel,
      notes: item.Notes
    })).sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort by date
  };

  const chartData = processData();

  const commonConfig = {
    xField: 'date',
    yField: 'value',
    seriesField: 'category',
    xAxis: {
      type: 'time',
      label: {
        formatter: (text, item) => {
          const date = new Date(item.date);
          return isNaN(date.getTime()) ? text : `${date.getMonth() + 1}/${date.getDate()}`;
        }
      },
      mask: 'MM/DD'
    },
    yAxis: {
      label: {
        formatter: (text) => `${text}`,
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
    tooltip: {
      formatter: (datum) => {
        return {
          name: datum.category,
          value: datum.value,
          title: new Date(datum.date).toLocaleString()
        };
      }
    },
    interactions: [{ type: 'marker-active' }],
  };

  return (
    <div>
      <Tabs defaultActiveKey="1">
        <TabPane tab="Blood Pressure" key="1">
          <Line
            {...commonConfig}
            data={chartData.flatMap(item => [
              {
                date: item.date,
                value: item.systolic,
                category: 'Systolic'
              },
              {
                date: item.date,
                value: item.diastolic,
                category: 'Diastolic'
              }
            ])}
            color={['#ff4d4f', '#1890ff']}
            meta={{
              value: {
                alias: 'mmHg'
              }
            }}
          />
          <div style={{ marginTop: '16px' }}>
            <Text type="secondary">
              <HeartOutlined /> Normal range: 90-120 (systolic) / 60-80 (diastolic)
            </Text>
          </div>
        </TabPane>
        <TabPane tab="Heart Rate" key="2">
          <Line
            {...commonConfig}
            data={chartData.map(item => ({
              date: item.date,
              value: item.heartRate,
              category: 'Heart Rate'
            }))}
            color={['#52c41a']}
            meta={{
              value: {
                alias: 'bpm'
              }
            }}
          />
          <div style={{ marginTop: '16px' }}>
            <Text type="secondary">
              <HeartOutlined /> Normal range: 60-100 bpm
            </Text>
          </div>
        </TabPane>
        <TabPane tab="Blood Sugar" key="3">
          <Line
            {...commonConfig}
            data={chartData.map(item => ({
              date: item.date,
              value: item.bloodSugar,
              category: 'Blood Sugar'
            }))}
            color={['#faad14']}
            meta={{
              value: {
                alias: 'mg/dL'
              }
            }}
          />
          <div style={{ marginTop: '16px' }}>
            <Text type="secondary">
              <HeartOutlined /> Normal fasting range: 70-100 mg/dL
            </Text>
          </div>
        </TabPane>
        <TabPane tab="Oxygen Level" key="4">
          <Line
            {...commonConfig}
            data={chartData.map(item => ({
              date: item.date,
              value: item.oxygenLevel,
              category: 'Oxygen Level'
            }))}
            color={['#13c2c2']}
            meta={{
              value: {
                alias: '%'
              }
            }}
          />
          <div style={{ marginTop: '16px' }}>
            <Text type="secondary">
              <HeartOutlined /> Normal range: 95-100%
            </Text>
          </div>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default HealthTrendsChart;