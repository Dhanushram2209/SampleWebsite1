import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, Input, Button, Typography, List, Avatar, Spin, 
  Alert, Tabs, Badge, Space, message, notification, Tooltip 
} from 'antd';
import { 
  RobotOutlined, UserOutlined, SendOutlined,
  NotificationOutlined, WifiOutlined, DisconnectOutlined,
  ExclamationCircleOutlined, DashboardOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;

const HealthAssistant = ({ healthData, medications = [], vitals = {}, alerts = [] }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [unreadAlerts, setUnreadAlerts] = useState(alerts.filter(a => !a.IsRead));
  const messagesEndRef = useRef(null);

  const commonQuestions = [
    "What do my recent vitals mean?",
    "Should I be concerned about my risk score?",
    "How can I improve my blood pressure?",
    "What's the best time to take my medications?",
    "Can you explain this alert I received?"
  ];

  // Initialize with welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        sender: 'ai',
        content: "Hello! I'm your AI Health Assistant. How can I help you today? You can ask about your health data, medications, or recent alerts.",
        timestamp: new Date().toISOString()
      }]);
    }
  }, []);

  // Simulate connection status changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setConnectionStatus('connected');
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    const userMessage = {
      sender: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const response = {
        content: `I'm analyzing your question about "${input}". Here's some general information... Always consult your doctor for medical advice.`
      };
      
      const aiMessage = {
        sender: 'ai',
        content: response.content,
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      message.error('Failed to get response from assistant');
      setMessages(prev => [...prev, {
        sender: 'ai',
        content: "I'm having trouble connecting right now. Please try again later.",
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickQuestion = (question) => {
    setInput(question);
    if (activeTab === 'chat') {
      sendMessage();
    }
  };

  const renderConnectionStatus = () => {
    return connectionStatus === 'connected' ? (
      <Tooltip title="Connected">
        <WifiOutlined style={{ color: '#52c41a' }} />
      </Tooltip>
    ) : (
      <Tooltip title="Disconnected">
        <DisconnectOutlined style={{ color: '#ff4d4f' }} />
      </Tooltip>
    );
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        tabBarExtraContent={renderConnectionStatus()}
      >
        <TabPane 
          tab={
            <span>
              <RobotOutlined /> Chat
            </span>
          } 
          key="chat"
        >
          <Card 
            style={{ marginBottom: 16, height: 400, overflowY: 'auto' }}
            bodyStyle={{ padding: 12 }}
          >
            <List
              dataSource={messages}
              renderItem={(item) => (
                <List.Item style={{ 
                  padding: '8px 0',
                  justifyContent: item.sender === 'user' ? 'flex-end' : 'flex-start'
                }}>
                  <div style={{ 
                    maxWidth: '80%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: item.sender === 'user' ? 'flex-end' : 'flex-start'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                      {item.sender === 'ai' ? (
                        <Avatar 
                          icon={<RobotOutlined />} 
                          style={{ marginRight: 8, backgroundColor: '#1890ff', color: 'white' }} 
                        />
                      ) : (
                        <Avatar 
                          icon={<UserOutlined />} 
                          style={{ marginRight: 8, backgroundColor: '#e6f7ff' }} 
                        />
                      )}
                      <Text strong>{item.sender === 'ai' ? 'Health Assistant' : 'You'}</Text>
                    </div>
                    <Card 
                      size="small" 
                      style={{ 
                        backgroundColor: item.sender === 'ai' ? '#f0f8ff' : '#e6f7ff',
                        textAlign: item.sender === 'user' ? 'right' : 'left',
                        borderColor: item.sender === 'ai' ? '#1890ff' : '#d9d9d9'
                      }}
                    >
                      {item.content}
                    </Card>
                    <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </div>
                </List.Item>
              )}
            />
            <div ref={messagesEndRef} />
            {loading && (
              <div style={{ textAlign: 'center', padding: 10 }}>
                <Spin size="small" />
                <Text type="secondary">Assistant is thinking...</Text>
              </div>
            )}
          </Card>
          
          <div style={{ display: 'flex', marginBottom: 16 }}>
            <TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask your health assistant anything..."
              autoSize={{ minRows: 2, maxRows: 4 }}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <Button 
              type="primary" 
              icon={<SendOutlined />} 
              onClick={sendMessage}
              loading={loading}
              style={{ marginLeft: 8, height: 'auto' }}
              disabled={!input.trim()}
            />
          </div>
        </TabPane>
        
        <TabPane 
          tab={
            <Badge count={unreadAlerts.length} offset={[10, -5]}>
              <span>
                <ExclamationCircleOutlined /> Quick Questions
              </span>
            </Badge>
          } 
          key="questions"
        >
          <Title level={4} style={{ marginBottom: 16 }}>
            <DashboardOutlined /> Common Health Questions
          </Title>
          <Space direction="vertical" style={{ width: '100%' }}>
            {commonQuestions.map((question, index) => (
              <Card
                key={index}
                hoverable
                onClick={() => handleQuickQuestion(question)}
                style={{ marginBottom: 8, cursor: 'pointer' }}
              >
                <Text>{question}</Text>
              </Card>
            ))}
          </Space>
        </TabPane>
      </Tabs>
      
      <Alert
        message="AI Assistant Disclaimer"
        description="The health assistant provides information based on your data and general medical knowledge, but it's not a substitute for professional medical advice. Always consult with your healthcare provider for medical decisions."
        type="warning"
        showIcon
        style={{ marginTop: 16 }}
      />
      
      {connectionStatus !== 'connected' && (
        <Alert
          message="Assistant Connection Issues"
          description="Some real-time features may not be available. Your messages will be sent when connection is restored."
          type="error"
          showIcon
          style={{ marginTop: 16 }}
        />
      )}
    </div>
  );
};

export default HealthAssistant;