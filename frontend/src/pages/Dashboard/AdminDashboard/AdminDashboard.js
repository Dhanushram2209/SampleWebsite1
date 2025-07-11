import React from 'react';
import { Layout, Menu, Typography } from 'antd';
import { DashboardOutlined, TeamOutlined, SettingOutlined, SafetyOutlined } from '@ant-design/icons';
import Header from '../../../components/Header';
import './AdminDashboard.css';

const { Header: AntHeader, Content, Sider } = Layout;
const { Title } = Typography;

const AdminDashboard = () => {
  return (
    <Layout className="admin-dashboard">
      <Sider width={250} className="dashboard-sider">
        <div className="dashboard-logo">
          <Title level={4} className="dashboard-title">
            <DashboardOutlined /> Admin Portal
          </Title>
        </div>
        <Menu
          theme="light"
          mode="inline"
          defaultSelectedKeys={['1']}
          className="dashboard-menu"
        >
          <Menu.Item key="1" icon={<DashboardOutlined />}>Dashboard</Menu.Item>
          <Menu.Item key="2" icon={<TeamOutlined />}>Users</Menu.Item>
          <Menu.Item key="3" icon={<SafetyOutlined />}>Doctors</Menu.Item>
          <Menu.Item key="4" icon={<SettingOutlined />}>Settings</Menu.Item>
        </Menu>
      </Sider>
      <Layout>
        <AntHeader className="dashboard-header">
          <Header />
        </AntHeader>
        <Content className="dashboard-content">
          <div className="dashboard-container">
            <Title level={3} className="dashboard-page-title">Welcome to Admin Dashboard</Title>
            <div style={{ padding: 24, minHeight: 360 }}>
              <p>Welcome to your admin dashboard!</p>
            </div>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminDashboard;