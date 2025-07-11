import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Select, DatePicker, Row, Col, message } from 'antd';
import { UserOutlined, MailOutlined, LockOutlined, PhoneOutlined, HomeOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../../../services/api';
import './Register.css';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const Register = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState('patient');
  const [messageApi, contextHolder] = message.useMessage();
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      await register(values);
      messageApi.success({
        content: 'Registration successful! Redirecting to login...',
        duration: 2,
      });
      
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error) {
      let errorMessage = 'Registration failed. Please try again.';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      messageApi.error({
        content: errorMessage,
        duration: 4,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (value) => {
    setRole(value);
  };

  return (
    <div className="register-container">
      {contextHolder}
      <Card className="register-card" hoverable>
        <div className="register-header">
          <Title level={2} className="register-title">Create Account</Title>
          <Text type="secondary" className="register-subtitle">Join our chronic disease management platform</Text>
        </div>
        
        <Form
          form={form}
          name="register"
          onFinish={onFinish}
          layout="vertical"
          scrollToFirstError
          className="register-form"
        >
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="firstName"
                label="First Name"
                rules={[
                  { 
                    required: true, 
                    message: 'Please input your first name!' 
                  },
                  {
                    max: 50,
                    message: 'First name cannot exceed 50 characters!',
                  }
                ]}
              >
                <Input prefix={<UserOutlined />} placeholder="First Name" size="large" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="lastName"
                label="Last Name"
                rules={[
                  { 
                    required: true, 
                    message: 'Please input your last name!' 
                  },
                  {
                    max: 50,
                    message: 'Last name cannot exceed 50 characters!',
                  }
                ]}
              >
                <Input prefix={<UserOutlined />} placeholder="Last Name" size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { 
                required: true, 
                message: 'Please input your email!' 
              },
              { 
                type: 'email', 
                message: 'Please enter a valid email!' 
              }
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="Email" size="large" />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="password"
                label="Password"
                rules={[
                  { 
                    required: true, 
                    message: 'Please input your password!' 
                  },
                  { 
                    min: 6, 
                    message: 'Password must be at least 6 characters!' 
                  }
                ]}
                hasFeedback
              >
                <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="confirm"
                label="Confirm Password"
                dependencies={['password']}
                hasFeedback
                rules={[
                  { 
                    required: true, 
                    message: 'Please confirm your password!' 
                  },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('The two passwords do not match!'));
                    },
                  }),
                ]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="Confirm Password" size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="role"
            label="Register as"
            rules={[{ required: true, message: 'Please select your role!' }]}
          >
            <Select 
              onChange={handleRoleChange} 
              placeholder="Select your role" 
              size="large"
            >
              <Option value="patient">Patient</Option>
              <Option value="doctor">Doctor</Option>
            </Select>
          </Form.Item>

          {role === 'patient' && (
            <>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="dateOfBirth"
                    label="Date of Birth"
                    rules={[{ required: true, message: 'Please select your date of birth!' }]}
                  >
                    <DatePicker 
                      style={{ width: '100%' }} 
                      size="large" 
                      disabledDate={(current) => {
                        return current && current > new Date();
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="gender"
                    label="Gender"
                    rules={[{ required: true, message: 'Please select your gender!' }]}
                  >
                    <Select placeholder="Select gender" size="large">
                      <Option value="male">Male</Option>
                      <Option value="female">Female</Option>
                      <Option value="other">Other</Option>
                      <Option value="prefer-not-to-say">Prefer not to say</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="phoneNumber"
                    label="Phone Number"
                    rules={[
                      { 
                        required: true, 
                        message: 'Please input your phone number!' 
                      },
                      {
                        pattern: /^[0-9]{10,15}$/,
                        message: 'Please enter a valid phone number!',
                      }
                    ]}
                  >
                    <Input prefix={<PhoneOutlined />} placeholder="Phone Number" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="emergencyPhone"
                    label="Emergency Contact Phone"
                    rules={[
                      { 
                        required: true, 
                        message: 'Please input emergency contact phone!' 
                      },
                      {
                        pattern: /^[0-9]{10,15}$/,
                        message: 'Please enter a valid phone number!',
                      }
                    ]}
                  >
                    <Input prefix={<PhoneOutlined />} placeholder="Emergency Contact Phone" size="large" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="address"
                label="Address"
                rules={[
                  { 
                    required: true, 
                    message: 'Please input your address!' 
                  },
                  {
                    max: 255,
                    message: 'Address cannot exceed 255 characters!',
                  }
                ]}
              >
                <TextArea prefix={<HomeOutlined />} placeholder="Address" rows={3} />
              </Form.Item>

              <Form.Item
                name="emergencyContact"
                label="Emergency Contact Name"
                rules={[
                  { 
                    required: true, 
                    message: 'Please input emergency contact name!' 
                  },
                  {
                    max: 100,
                    message: 'Name cannot exceed 100 characters!',
                  }
                ]}
              >
                <Input placeholder="Emergency Contact Name" size="large" />
              </Form.Item>
            </>
          )}

          {role === 'doctor' && (
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="specialization"
                  label="Specialization"
                  rules={[
                    { 
                      required: true, 
                      message: 'Please input your specialization!' 
                    },
                    {
                      max: 100,
                      message: 'Specialization cannot exceed 100 characters!',
                    }
                  ]}
                >
                  <Input placeholder="Specialization" size="large" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="licenseNumber"
                  label="License Number"
                  rules={[
                    { 
                      required: true, 
                      message: 'Please input your license number!' 
                    },
                    {
                      max: 50,
                      message: 'License number cannot exceed 50 characters!',
                    }
                  ]}
                >
                  <Input placeholder="License Number" size="large" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="phoneNumber"
                  label="Phone Number"
                  rules={[
                    { 
                      required: true, 
                      message: 'Please input your phone number!' 
                    },
                    {
                      pattern: /^[0-9]{10,15}$/,
                      message: 'Please enter a valid phone number!',
                    }
                  ]}
                >
                  <Input prefix={<PhoneOutlined />} placeholder="Phone Number" size="large" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="hospitalAffiliation"
                  label="Hospital Affiliation"
                  rules={[
                    { 
                      required: true, 
                      message: 'Please input your hospital affiliation!' 
                    },
                    {
                      max: 100,
                      message: 'Hospital name cannot exceed 100 characters!',
                    }
                  ]}
                >
                  <Input placeholder="Hospital Affiliation" size="large" />
                </Form.Item>
              </Col>
            </Row>
          )}

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading} 
              block
              size="large"
              className="register-button"
            >
              Register
            </Button>
          </Form.Item>
        </Form>

        <div className="register-footer">
          Already have an account? <Link to="/login" className="register-link">Login now</Link>
        </div>
      </Card>
    </div>
  );
};

export default Register;