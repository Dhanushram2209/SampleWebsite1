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
import api from '../services/api';

const { Header } = Layout;
const { Text } = Typography;

const AppHeader = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.role === 'patient') {
      fetchAlerts();
    }
  }, [user]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/patient/alerts?limit=5');
      setAlerts(response.data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAlertRead = async (alertId) => {
    try {
      await api.post(`/patient/alerts/${alertId}/read`);
      setAlerts(alerts.map(alert => 
        alert.AlertID === alertId ? { ...alert, IsRead: true } : alert
      ));
    } catch (error) {
      console.error('Error marking alert:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const unreadCount = alerts.filter(alert => !alert.IsRead).length;

  const alertsMenu = (
    <Menu className="header-alerts-menu">
      <Menu.Item key="header" className="alerts-menu-header">
        <div className="alerts-menu-title">
          <BellOutlined /> Notifications
          {unreadCount > 0 && (
            <Tag color="red" className="alerts-count-badge">
              {unreadCount} new
            </Tag>
          )}
        </div>
      </Menu.Item>
      <Divider className="alerts-menu-divider" />
      
      {loading ? (
        <Menu.Item key="loading" className="alerts-menu-item">
          <div className="alert-loading">Loading alerts...</div>
        </Menu.Item>
      ) : alerts.length === 0 ? (
        <Menu.Item key="empty" className="alerts-menu-item">
          <div className="alert-empty">No alerts to display</div>
        </Menu.Item>
      ) : (
        alerts.map(alert => (
          <Menu.Item key={alert.AlertID} className="alerts-menu-item">
            <div className={`alert-item ${alert.IsRead ? 'read' : 'unread'}`}>
              <div className="alert-icon">
                {alert.Severity === 'High' ? (
                  <ExclamationCircleOutlined className="alert-icon-high" />
                ) : alert.Severity === 'Medium' ? (
                  <WarningOutlined className="alert-icon-medium" />
                ) : (
                  <BellOutlined className="alert-icon-low" />
                )}
              </div>
              <div className="alert-content">
                <div className="alert-message">{alert.Message}</div>
                <div className="alert-meta">
                  <span className="alert-time">
                    {new Date(alert.Timestamp).toLocaleString()}
                  </span>
                  <span className="alert-severity">
                    <Tag 
                      color={
                        alert.Severity === 'High' ? 'error' : 
                        alert.Severity === 'Medium' ? 'warning' : 'processing'
                      }
                    >
                      {alert.Severity}
                    </Tag>
                  </span>
                </div>
              </div>
              {!alert.IsRead && (
                <div className="alert-actions">
                  <Tag 
                    className="mark-read-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkAlertRead(alert.AlertID);
                    }}
                  >
                    <CheckOutlined /> Mark read
                  </Tag>
                </div>
              )}
            </div>
          </Menu.Item>
        ))
      )}
      
      <Divider className="alerts-menu-divider" />
      <Menu.Item 
        key="view-all" 
        className="alerts-menu-footer"
        onClick={() => navigate('/patient-dashboard/alerts')}
      >
        View all alerts
      </Menu.Item>
    </Menu>
  );

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
        {user?.role === 'patient' && (
          <Dropdown 
            overlay={alertsMenu} 
            placement="bottomRight" 
            trigger={['click']}
            overlayClassName="alerts-dropdown"
          >
            <Badge count={unreadCount} className="header-notification">
              <BellOutlined className="header-notification-icon" />
            </Badge>
          </Dropdown>
        )}
        
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