import React, { useState, useEffect } from 'react';
import { Layout, Dropdown, Menu, Avatar, Typography, Badge, List, Divider, Tag } from 'antd';
import { 
  UserOutlined, 
  LogoutOutlined, 
  BellOutlined,
  CheckOutlined,
  ExclamationCircleOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { logout } from '../services/api';
import './Header.css';

const { Header } = Layout;
const { Text } = Typography;

const AppHeader = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenu = (
    <Menu className="header-dropdown-menu">
      <Menu.Item key="profile" className="header-dropdown-item">
        <UserOutlined /> Profile
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="logout" className="header-dropdown-item" onClick={handleLogout}>
        <LogoutOutlined /> Logout
      </Menu.Item>
    </Menu>
  );

  return (
    <Header className="app-header">
      <div className="header-right">
        <Dropdown overlay={userMenu} placement="bottomRight" trigger={['click']}>
          <div className="header-user">
            <Avatar 
              icon={<UserOutlined />} 
              className="header-avatar"
              size="default"
            />
            <Text strong className="header-user-name">
              {user?.firstName} {user?.lastName}
            </Text>
          </div>
        </Dropdown>
      </div>
    </Header>
  );
};

export default AppHeader;