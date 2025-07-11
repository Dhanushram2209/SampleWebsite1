import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../../../services/api';
import './Login.css';

const { Title, Text } = Typography;

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      await login(values);
      messageApi.success({
        content: 'Login successful! Redirecting...',
        duration: 2,
      });
      
      // Wait for the message to show before redirecting
      setTimeout(() => {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user.role === 'patient') {
          navigate('/patient-dashboard');
        } else if (user.role === 'doctor') {
          navigate('/doctor-dashboard');
        } 
      }, 2000);
    } catch (error) {
      messageApi.error({
        content: error.response?.data?.message || 'Login failed. Please check your credentials.',
        duration: 3,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {contextHolder}
      <Card className="login-card" hoverable>
        <div className="login-header">
          <Title level={2} className="login-title">Chronic Disease Management</Title>
          <Text type="secondary" className="login-subtitle">AI-Powered Health Monitoring</Text>
        </div>
        
        <Form
          name="login"
          initialValues={{ remember: true }}
          onFinish={onFinish}
          layout="vertical"
          className="login-form"
        >
          <Form.Item
            name="email"
            rules={[
              { 
                required: true, 
                message: 'Please input your email!' 
              },
              {
                type: 'email',
                message: 'Please enter a valid email address!',
              }
            ]}
          >
            <Input 
              prefix={<UserOutlined className="site-form-item-icon" />} 
              placeholder="Email" 
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { 
                required: true, 
                message: 'Please input your password!' 
              },
              {
                min: 6,
                message: 'Password must be at least 6 characters!',
              }
            ]}
          >
            <Input.Password 
              prefix={<LockOutlined className="site-form-item-icon" />} 
              placeholder="Password" 
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading} 
              block
              size="large"
              className="login-button"
            >
              Log in
            </Button>
          </Form.Item>
        </Form>

        <div className="login-footer">
          Don't have an account? <Link to="/register" className="login-link">Register now</Link>
        </div>
      </Card>
    </div>
  );
};

export default Login;