import React from 'react';
import { Card, Row, Col, Typography, Progress, List, Avatar, Badge } from 'antd';
import { TrophyOutlined, FireOutlined, CheckCircleOutlined, StarOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const RewardsProgram = ({ points }) => {
  const rewards = [
    {
      level: 'Bronze',
      points: 100,
      icon: <TrophyOutlined style={{ color: '#cd7f32' }} />,
      benefits: ['Basic health tips', 'Monthly newsletter']
    },
    {
      level: 'Silver',
      points: 250,
      icon: <TrophyOutlined style={{ color: '#c0c0c0' }} />,
      benefits: ['Personalized health recommendations', 'Priority email support']
    },
    {
      level: 'Gold',
      points: 500,
      icon: <TrophyOutlined style={{ color: '#ffd700' }} />,
      benefits: ['Free telemedicine consultation', 'Health coaching session']
    },
    {
      level: 'Platinum',
      points: 1000,
      icon: <StarOutlined style={{ color: '#e5e4e2' }} />,
      benefits: ['Annual health checkup', 'Personal health assistant']
    }
  ];

  const currentLevel = rewards.reduce((acc, reward) => {
    return points >= reward.points ? reward : acc;
  }, rewards[0]);

  const nextLevel = rewards.find(reward => reward.points > currentLevel.points) || null;

  const activities = [
    { name: 'Record health data', points: 5, frequency: 'Daily' },
    { name: 'Take medication on time', points: 5, frequency: 'Per dose' },
    { name: 'Complete telemedicine', points: 10, frequency: 'Per session' },
    { name: 'Read health articles', points: 2, frequency: 'Daily' },
    { name: 'Complete health survey', points: 15, frequency: 'Monthly' }
  ];

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="Your Rewards Status" hoverable>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <Badge count={currentLevel.icon} offset={[-20, 80]} size="large">
                <Avatar size={100} icon={<FireOutlined />} style={{ backgroundColor: '#ff4d4f' }} />
              </Badge>
              <Title level={3} style={{ marginTop: '16px' }}>{currentLevel.level} Member</Title>
              <Text type="secondary">You have {points} points</Text>
            </div>

            {nextLevel && (
              <div style={{ marginBottom: '24px' }}>
                <Text strong>Progress to {nextLevel.level}:</Text>
                <Progress 
                  percent={Math.min(100, (points / nextLevel.points) * 100)} 
                  status="active" 
                  format={() => `${points}/${nextLevel.points}`}
                />
                <Text type="secondary">{nextLevel.points - points} points to reach {nextLevel.level}</Text>
              </div>
            )}

            <div>
              <Text strong>Current Benefits:</Text>
              <List
                size="small"
                dataSource={currentLevel.benefits}
                renderItem={item => (
                  <List.Item>
                    <CheckCircleOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
                    {item}
                  </List.Item>
                )}
              />
            </div>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Earn More Points" hoverable>
            <List
              itemLayout="horizontal"
              dataSource={activities}
              renderItem={item => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar icon={<TrophyOutlined />} />}
                    title={item.name}
                    description={`${item.points} points - ${item.frequency}`}
                  />
                  <div>+{item.points}</div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default RewardsProgram;