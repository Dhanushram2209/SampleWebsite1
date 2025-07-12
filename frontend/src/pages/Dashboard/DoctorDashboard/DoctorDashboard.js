import React, { useState, useEffect } from 'react';
import { 
  Layout, Menu, Typography, Card, Row, Col, Table, Statistic, 
  Badge, Tabs, Avatar, List, Tag, Divider, Collapse, Spin, Button, message
} from 'antd';
import { 
  UserOutlined, TeamOutlined, MedicineBoxOutlined, DashboardOutlined, 
  ClockCircleOutlined, CalendarOutlined, BellOutlined, FileTextOutlined,
  SafetyCertificateOutlined, PhoneOutlined, HomeOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import Header from '../../../components/Header';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import './DoctorDashboard.css';
import moment from 'moment';
import VideoCall from '../../../components/video_call_components/VideoCall';

import { Modal, Space } from 'antd';
import { SyncOutlined } from '@ant-design/icons';

const { Header: AntHeader, Content, Sider } = Layout;
const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Panel } = Collapse;

const DoctorDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState([]);
  const [stats, setStats] = useState({
    totalPatients: 0,
    criticalPatients: 0,
    pendingActions: 0
  });
  const [appointments, setAppointments] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const navigate = useNavigate();
  const [videoCallVisible, setVideoCallVisible] = useState(false);
  const [currentAppointment, setCurrentAppointment] = useState(null);


  useEffect(() => {
    if (activeTab === 'profile') {
      fetchProfileData();
    } else if (activeTab === 'dashboard') {
      fetchDashboardData();
    } else if (activeTab === 'patients') {
      fetchPatientsData();
    } else if (activeTab === 'appointments') {
      fetchAppointments();
    } else if (activeTab === 'alerts') {
      fetchAlerts();
    }
  }, [activeTab]);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/doctor/profile');
      setProfileData(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching profile data:', error);
      message.error('Failed to fetch profile data');
      setLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      await fetchPatientsData();
      await fetchRecentAppointments();
      await fetchUnreadAlerts();
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      message.error('Failed to load dashboard data');
      setLoading(false);
    }
  };

  const fetchPatientsData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/doctor/patients');
      
      if (response.data && response.data.patients) {
        const processedPatients = response.data.patients.map(patient => ({
          ...patient,
          key: patient.id,
          lastChecked: patient.lastChecked || 'Not available',
          status: getStatusFromRiskScore(patient.riskScore)
        }));
        
        setPatients(processedPatients);
        
        // Calculate statistics
        const criticalPatients = processedPatients.filter(
          p => p.status === 'Critical'
        ).length;
        
        const pendingActions = processedPatients.reduce(
          (total, patient) => total + (patient.pendingActions || 0), 0
        );
        
        setStats({
          totalPatients: processedPatients.length,
          criticalPatients,
          pendingActions
        });
      } else {
        setPatients([]);
        setStats({
          totalPatients: 0,
          criticalPatients: 0,
          pendingActions: 0
        });
      }
    } catch (error) {
      console.error('Error fetching patients data:', error);
      message.error('Failed to fetch patients data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/doctor/appointments');
      setAppointments(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      message.error('Failed to fetch appointments');
      setLoading(false);
    }
  };

  const fetchRecentAppointments = async () => {
    try {
      const response = await api.get('/doctor/appointments?limit=5');
      setAppointments(response.data);
    } catch (error) {
      console.error('Error fetching recent appointments:', error);
    }
  };

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/doctor/alerts');
      setAlerts(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      message.error('Failed to fetch alerts');
      setLoading(false);
    }
  };

  const fetchUnreadAlerts = async () => {
    try {
      const response = await api.get('/doctor/alerts?unread=true&limit=5');
      setAlerts(response.data);
    } catch (error) {
      console.error('Error fetching unread alerts:', error);
    }
  };

  const markAlertAsRead = async (alertId) => {
    try {
      await api.post(`/doctor/alerts/${alertId}/read`);
      setAlerts(alerts.filter(alert => alert.alertId !== alertId));
      message.success('Alert marked as read');
    } catch (error) {
      console.error('Error marking alert as read:', error);
      message.error('Failed to mark alert as read');
    }
  };

  const getStatusFromRiskScore = (score) => {
    if (!score) return 'Normal';
    if (score > 70) return 'Critical';
    if (score > 40) return 'Warning';
    return 'Normal';
  };

  const patientColumns = [
    {
      title: 'Patient',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          <div style={{ fontSize: 12 }}>
            {record.gender}, {record.dob ? moment(record.dob).format('MMM D, YYYY') : 'No DOB'}
          </div>
        </div>
      ),
    },
    {
      title: 'Contact',
      dataIndex: 'contact',
      key: 'contact',
      render: (_, record) => (
        <div>
          <div>{record.email}</div>
          <div>{record.phone || 'No phone'}</div>
        </div>
      ),
    },
    {
      title: 'Risk Score',
      dataIndex: 'riskScore',
      key: 'riskScore',
      render: (score) => (
        <Tag color={
          !score ? 'default' : 
          score > 70 ? 'error' : 
          score > 40 ? 'warning' : 'success'
        }>
          {score || 'N/A'}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Badge 
          status={
            status === 'Critical' ? 'error' : 
            status === 'Warning' ? 'warning' : 'success'
          } 
          text={status}
        />
      ),
    },
    {
      title: 'Actions Needed',
      dataIndex: 'pendingActions',
      key: 'pendingActions',
      render: (count) => (
        <Tag color={count > 0 ? 'gold' : 'default'}>
          {count} pending
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button 
          type="link" 
          onClick={() => navigate(`/doctor-dashboard/patient/${record.id}`)}
        >
          View Details
        </Button>
      ),
    },
  ];

  const appointmentColumns = [
  {
    title: 'Patient',
    dataIndex: 'patientName',
    key: 'patientName',
    render: (text) => <Text strong>{text}</Text>,
  },
  {
    title: 'Date & Time',
    dataIndex: 'dateTime',
    key: 'dateTime',
    render: (date) => moment(date).format('MMM D, YYYY h:mm A'),
    sorter: (a, b) => new Date(a.dateTime) - new Date(b.dateTime)
  },
  {
    title: 'Type',
    dataIndex: 'type',
    key: 'type',
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status) => (
      <Tag 
        color={
          status === 'Completed' ? 'green' : 
          status === 'Cancelled' ? 'red' : 'blue'
        }
      >
        {status}
      </Tag>
    ),
  },
  {
    title: 'Actions',
    key: 'actions',
    render: (_, record) => (
      <Space>
        {record.status === 'Scheduled' && (
          <Button 
            type="primary" 
            onClick={() => {
              setCurrentAppointment(record);
              setVideoCallVisible(true);
            }}
          >
            Start
          </Button>
        )}
        <Button onClick={() => handleAppointmentAction(record, 'details')}>
          Details
        </Button>
      </Space>
    ),
  }
];

  const alertColumns = [
    {
      title: 'Patient',
      dataIndex: 'patientName',
      key: 'patientName',
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      render: (text, record) => (
        <div>
          <ExclamationCircleOutlined 
            style={{ 
              color: record.severity === 'High' ? '#ff4d4f' : 
                     record.severity === 'Medium' ? '#faad14' : '#52c41a',
              marginRight: 8 
            }} 
          />
          {text}
        </div>
      ),
    },
    {
      title: 'Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (date) => moment(date).fromNow(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button type="link" onClick={() => markAlertAsRead(record.alertId)}>
          Mark as Read
        </Button>
      ),
    },
  ];

  const handleAppointmentAction = async (appointment, action) => {
  try {
    if (action === 'start') {
      message.info(`Starting appointment with ${appointment.patientName}`);
      // You would typically navigate to a telemedicine session here
      // For now, we'll mark it as completed
      await api.put(`/appointments/${appointment.appointmentId}/status`, {
        status: 'Completed'
      });
      message.success('Appointment marked as completed');
      fetchAppointments();
    } else if (action === 'cancel') {
      await api.put(`/appointments/${appointment.appointmentId}/status`, {
        status: 'Cancelled'
      });
      message.success('Appointment cancelled');
      fetchAppointments();
    } else if (action === 'details') {
      Modal.info({
        title: 'Appointment Details',
        content: (
          <div>
            <p><strong>Patient:</strong> {appointment.patientName}</p>
            <p><strong>Time:</strong> {moment(appointment.dateTime).format('MMMM Do YYYY, h:mm a')}</p>
            <p><strong>Type:</strong> {appointment.type}</p>
            <p><strong>Status:</strong> {appointment.status}</p>
            {appointment.notes && <p><strong>Notes:</strong> {appointment.notes}</p>}
          </div>
        )
      });
    }
  } catch (error) {
    console.error('Error handling appointment action:', error);
    message.error('Failed to perform action');
  }
};


  const renderDashboard = () => (
    <>
      <Row gutter={[16, 16]} className="dashboard-stats">
        <Col xs={24} sm={12} md={8}>
          <Card className="dashboard-card" hoverable>
            <Statistic title="Total Patients" value={stats.totalPatients} />
            <Text type="secondary">{patients.length} under your care</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card className="dashboard-card" hoverable>
            <Statistic title="Critical Patients" value={stats.criticalPatients} />
            <Text type="secondary">Require immediate attention</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card className="dashboard-card" hoverable>
            <Statistic title="Pending Actions" value={stats.pendingActions} />
            <Text type="secondary">Prescriptions to review</Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="dashboard-sections">
        <Col xs={24} md={12}>
          <Card 
            title="Recent Alerts" 
            className="dashboard-section-card" 
            hoverable
            extra={<a onClick={() => setActiveTab('alerts')}>View All</a>}
          >
            <Table 
              columns={alertColumns}
              dataSource={alerts.slice(0, 5)}
              size="middle" 
              pagination={false}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card 
            title="Upcoming Appointments" 
            className="dashboard-section-card" 
            hoverable
            extra={<a onClick={() => setActiveTab('appointments')}>View All</a>}
          >
            <Table 
              columns={appointmentColumns}
              dataSource={appointments.slice(0, 5)}
              size="middle" 
              pagination={false}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24}>
          <Card 
            title="Patient List" 
            className="dashboard-section-card" 
            hoverable
            extra={<a onClick={() => setActiveTab('patients')}>View All</a>}
          >
            <Table 
              columns={patientColumns}
              dataSource={patients}
              size="middle" 
              pagination={{ pageSize: 5 }}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>
    </>
  );

  const renderPatients = () => (
    <Card 
      title="Your Patients" 
      className="dashboard-section-card" 
      hoverable
    >
      <Table 
        columns={patientColumns}
        dataSource={patients}
        size="middle" 
        pagination={{ pageSize: 10 }}
        loading={loading}
      />
    </Card>
  );

  const renderAppointments = () => (
  <Card 
    title="Appointments" 
    className="dashboard-section-card" 
    hoverable
    extra={
      <Button 
        icon={<SyncOutlined />} 
        onClick={fetchAppointments}
        loading={loading}
      >
        Refresh
      </Button>
    }
  >
    <Tabs defaultActiveKey="upcoming">
      <TabPane tab="Upcoming" key="upcoming">
        <Table 
          columns={appointmentColumns}
          dataSource={appointments.filter(a => a.status === 'Scheduled')}
          size="middle" 
          pagination={{ pageSize: 10 }}
          loading={loading}
        />
      </TabPane>
      <TabPane tab="Completed" key="completed">
        <Table 
          columns={appointmentColumns}
          dataSource={appointments.filter(a => a.status === 'Completed')}
          size="middle" 
          pagination={{ pageSize: 10 }}
          loading={loading}
        />
      </TabPane>
      <TabPane tab="Cancelled" key="cancelled">
        <Table 
          columns={appointmentColumns}
          dataSource={appointments.filter(a => a.status === 'Cancelled')}
          size="middle" 
          pagination={{ pageSize: 10 }}
          loading={loading}
        />
      </TabPane>
      <TabPane tab="All" key="all">
        <Table 
          columns={appointmentColumns}
          dataSource={appointments}
          size="middle" 
          pagination={{ pageSize: 10 }}
          loading={loading}
        />
      </TabPane>
    </Tabs>
  </Card>
);

  const renderAlerts = () => (
    <Card 
      title="Patient Alerts" 
      className="dashboard-section-card" 
      hoverable
    >
      <Tabs defaultActiveKey="unread">
        <TabPane tab="Unread" key="unread">
          <Table 
            columns={alertColumns}
            dataSource={alerts.filter(a => !a.isRead)}
            size="middle" 
            pagination={{ pageSize: 10 }}
            loading={loading}
          />
        </TabPane>
        <TabPane tab="All Alerts" key="all">
          <Table 
            columns={alertColumns}
            dataSource={alerts}
            size="middle" 
            pagination={{ pageSize: 10 }}
            loading={loading}
          />
        </TabPane>
      </Tabs>
    </Card>
  );

  const renderProfile = () => (
    <Card title="Your Profile" className="dashboard-section-card" hoverable>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px' }}>
          <Spin />
        </div>
      ) : profileData ? (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <Avatar size={100} icon={<UserOutlined />} />
                <Title level={4} style={{ marginTop: '16px' }}>
                  {profileData.firstName} {profileData.lastName}
                </Title>
                <Tag color="blue" style={{ marginBottom: '16px' }}>
                  Doctor
                </Tag>
              </div>
              
              <List size="small">
                <List.Item>
                  <List.Item.Meta
                    title="Email"
                    description={profileData.email}
                  />
                </List.Item>
                <List.Item>
                  <List.Item.Meta
                    title="Phone"
                    description={profileData.phoneNumber || 'Not provided'}
                  />
                </List.Item>
              </List>
            </Card>
          </Col>
          <Col xs={24} md={16}>
            <Card title="Professional Information">
              <Collapse defaultActiveKey={['1']}>
                <Panel header="Basic Information" key="1">
                  <Row gutter={16}>
                    <Col span={12}>
                      <List.Item>
                        <List.Item.Meta
                          avatar={<SafetyCertificateOutlined />}
                          title="Specialization"
                          description={profileData.specialization || 'Not specified'}
                        />
                      </List.Item>
                    </Col>
                    <Col span={12}>
                      <List.Item>
                        <List.Item.Meta
                          avatar={<FileTextOutlined />}
                          title="License Number"
                          description={profileData.licenseNumber || 'Not provided'}
                        />
                      </List.Item>
                    </Col>
                  </Row>
                </Panel>
                <Panel header="Contact Information" key="2">
                  <Row gutter={16}>
                    <Col span={12}>
                      <List.Item>
                        <List.Item.Meta
                          avatar={<PhoneOutlined />}
                          title="Phone Number"
                          description={profileData.phoneNumber || 'Not provided'}
                        />
                      </List.Item>
                    </Col>
                    <Col span={12}>
                      <List.Item>
                        <List.Item.Meta
                          avatar={<HomeOutlined />}
                          title="Hospital Affiliation"
                          description={profileData.hospitalAffiliation || 'Not specified'}
                        />
                      </List.Item>
                    </Col>
                  </Row>
                </Panel>
              </Collapse>
            </Card>
          </Col>
        </Row>
      ) : (
        <Text type="secondary">No profile data available</Text>
      )}
    </Card>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return renderDashboard();
      case 'patients':
        return renderPatients();
      case 'appointments':
        return renderAppointments();
      case 'alerts':
        return renderAlerts();
      case 'profile':
        return renderProfile();
      default:
        return renderDashboard();
    }
  };

  return (
    <Layout className="doctor-dashboard">
      <Sider width={250} className="dashboard-sider">
        <div className="dashboard-logo">
          <Title level={4} className="dashboard-title">
            <DashboardOutlined /> Doctor Portal
          </Title>
        </div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[activeTab]}
          onClick={({ key }) => setActiveTab(key)}
          className="dashboard-menu"
        >
          <Menu.Item key="dashboard" icon={<DashboardOutlined />}>Dashboard</Menu.Item>
          <Menu.Item key="patients" icon={<TeamOutlined />}>Patients</Menu.Item>
          <Menu.Item key="appointments" icon={<CalendarOutlined />}>Appointments</Menu.Item>
          <Menu.Item key="alerts" icon={<BellOutlined />}>Alerts</Menu.Item>
          <Menu.Item key="profile" icon={<UserOutlined />}>Profile</Menu.Item>
        </Menu>
      </Sider>
      <Layout>
        <AntHeader className="dashboard-header">
          <Header />
        </AntHeader>
        <Content className="dashboard-content">
          <div className="dashboard-container">
            <Title level={3} className="dashboard-page-title">
              {activeTab === 'dashboard' ? 'Doctor Dashboard' : 
               activeTab === 'patients' ? 'Patient Management' :
               activeTab === 'appointments' ? 'Appointments' :
               activeTab === 'alerts' ? 'Patient Alerts' :
               activeTab === 'profile' ? 'Your Profile' : ''}
            </Title>
            {renderContent()}
          </div>
        </Content>
        <VideoCall
      visible={videoCallVisible}
      onClose={() => setVideoCallVisible(false)}
      appointment={currentAppointment}
      userRole="doctor"
    />
      </Layout>
    </Layout>
  );
};

export default DoctorDashboard;