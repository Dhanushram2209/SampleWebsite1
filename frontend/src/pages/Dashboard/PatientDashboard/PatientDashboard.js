import React, { useState, useEffect } from 'react';
import { 
  Layout, Menu, Typography, Card, Row, Col, Statistic, Progress, Alert, 
  Table, Button, Modal, Form, Input, Select, DatePicker, Badge, message, 
  Spin, Tabs, Avatar, List, Tag, Divider, Collapse, Space, Popconfirm, Tooltip,
  InputNumber, Switch, Radio, FloatButton
} from 'antd';
import { 
  UserOutlined, HeartOutlined, MedicineBoxOutlined, BellOutlined, 
  DashboardOutlined, PlusOutlined, LineChartOutlined, VideoCameraOutlined,
  TrophyOutlined, FireOutlined, CheckOutlined, CloseOutlined, 
  CalendarOutlined, ClockCircleOutlined, ExclamationCircleOutlined,
  FileTextOutlined, SyncOutlined, CheckCircleOutlined, TeamOutlined,
  ArrowUpOutlined, ArrowDownOutlined, InfoCircleOutlined, RobotOutlined,
  BarChartOutlined, QuestionCircleOutlined, WarningOutlined, MessageOutlined
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../../../components/Header';
import './PatientDashboard.css';
import api from '../../../services/api';
import HealthTrendsChart from './components/HealthTrendsChart';
import RewardsProgram from './components/RewardsProgram';
import moment from 'moment';
import { TimePicker } from 'antd';
import AIPredictionChart from './components/AIPredictionChart';
import VideoCall from '../../../components/video_call_components/VideoCall';

const { Header: AntHeader, Content, Sider } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;
const { Panel } = Collapse;

const HealthAssistant = ({ healthData, vitals, onClose, medications, riskScore }) => {
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState(null);

  const analyzeHealthData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const latestVitals = vitals || (healthData.length > 0 ? healthData[0] : null);
      
      if (!latestVitals) {
        throw new Error('No health data available for analysis');
      }

      // Extract values from vitals
      const [systolic, diastolic] = latestVitals.bloodPressure ? 
        latestVitals.bloodPressure.split('/').map(Number) : [120, 80];
      const heartRate = latestVitals.heartRate || 72;
      const bloodSugar = latestVitals.bloodSugar || 100;
      const oxygenLevel = latestVitals.oxygenLevel || 98;
      const bmi = 25; // Mock BMI - in real app this would come from profile

      // For demo purposes, we'll use mock data
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate mock prediction based on values
      const mockPrediction = {
        diseases: [],
        recommendations: []
      };

      if (systolic > 140 || diastolic > 90) {
        mockPrediction.diseases.push({
          name: 'Hypertension',
          description: 'Your blood pressure is higher than normal, which increases risk of heart disease and stroke.',
          confidence: Math.min(90, Math.floor(70 + (systolic - 140) / 2)),
          severity: (systolic > 160 || diastolic > 100) ? 'high' : 'medium'
        });
      }

      if (heartRate > 100) {
        mockPrediction.diseases.push({
          name: 'Tachycardia',
          description: 'Your heart rate is elevated, which could indicate stress or other conditions.',
          confidence: Math.min(85, Math.floor(60 + (heartRate - 100) / 2)),
          severity: heartRate > 120 ? 'high' : 'medium'
        });
      }

      if (bloodSugar > 200) {
        mockPrediction.diseases.push({
          name: 'Hyperglycemia',
          description: 'Your blood sugar levels are high, which may indicate diabetes or prediabetes.',
          confidence: Math.min(80, Math.floor(60 + (bloodSugar - 200) / 5)),
          severity: 'high'
        });
        mockPrediction.recommendations.push({
          action: 'Get diabetes screening',
          details: 'Visit your primary care physician for a diabetes screening test.',
          urgency: 'soon'
        });
      }

      if (oxygenLevel < 94) {
        mockPrediction.diseases.push({
          name: 'Hypoxemia',
          description: 'Your blood oxygen level is lower than normal, which may affect your breathing.',
          confidence: Math.min(75, Math.floor(60 + (94 - oxygenLevel) * 5)),
          severity: oxygenLevel < 90 ? 'high' : 'medium'
        });
      }

      // Check medication adherence
      const pendingMeds = medications.filter(m => m.Status !== 'Taken' && 
        m.NextDose && new Date(m.NextDose) < new Date());
      
      if (pendingMeds.length > 0) {
        mockPrediction.recommendations.push({
          action: 'Medication adherence',
          details: `You have ${pendingMeds.length} overdue medications. Please take them as prescribed.`,
          urgency: pendingMeds.length > 2 ? 'immediate' : 'soon'
        });
      }

      // Consider risk score
      if (riskScore > 70) {
        mockPrediction.recommendations.push({
          action: 'High risk consultation',
          details: 'Your health risk score is elevated. Consider scheduling a consultation with your doctor.',
          urgency: 'soon'
        });
      }

      if (mockPrediction.diseases.length === 0) {
        mockPrediction.diseases.push({
          name: 'Healthy',
          description: 'Your vitals appear to be within normal ranges.',
          confidence: 95,
          severity: 'low'
        });
        mockPrediction.recommendations.push({
          action: 'Maintain healthy habits',
          details: 'Continue with your current health regimen and regular checkups.',
          urgency: 'none'
        });
      }

      setPrediction(mockPrediction);
    } catch (err) {
      console.error('Error analyzing health data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    analyzeHealthData();
  }, [healthData, vitals]);

  return (
    <Modal
      title={
        <Space>
          <RobotOutlined />
          <span>AI Health Assistant</span>
        </Space>
      }
      visible={true}
      onCancel={onClose}
      footer={null}
      width={800}
    >
      <Card>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
            <Title level={4} style={{ marginTop: '16px' }}>Analyzing your health data...</Title>
            <Text type="secondary">This may take a few moments</Text>
          </div>
        ) : error ? (
          <Alert
            message="Analysis Error"
            description={error}
            type="error"
            showIcon
          />
        ) : prediction ? (
          <>
            <Title level={4} style={{ marginBottom: '16px' }}>
              <HeartOutlined /> Health Assessment
            </Title>
            
            {prediction.diseases && prediction.diseases.length > 0 ? (
              <>
                {prediction.diseases[0].name !== 'Healthy' && (
                  <Alert
                    message="Potential Health Risks Detected"
                    description="Based on your recent health data, the AI assistant has identified the following potential risks:"
                    type="warning"
                    showIcon
                    style={{ marginBottom: '16px' }}
                  />
                )}
                
                <List
                  dataSource={prediction.diseases}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<WarningOutlined style={{ 
                          color: item.severity === 'high' ? '#ff4d4f' : 
                                 item.severity === 'medium' ? '#faad14' : '#52c41a',
                          fontSize: '20px' 
                        }} />}
                        title={<Text strong>{item.name}</Text>}
                        description={
                          <>
                            <Text>{item.description}</Text>
                            <div style={{ marginTop: '8px' }}>
                              <Tag color={
                                item.severity === 'high' ? 'error' : 
                                item.severity === 'medium' ? 'warning' : 'success'
                              }>
                                {item.severity === 'high' ? 'High Risk' : 
                                 item.severity === 'medium' ? 'Medium Risk' : 'Low Risk'}
                              </Tag>
                              <Tag color="blue">Confidence: {item.confidence}%</Tag>
                            </div>
                          </>
                        }
                      />
                    </List.Item>
                  )}
                />
                
                {prediction.recommendations && prediction.recommendations.length > 0 && (
                  <div style={{ marginTop: '24px' }}>
                    <Title level={5}>Recommended Actions</Title>
                    <List
                      dataSource={prediction.recommendations}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta
                            title={<Text strong>{item.action}</Text>}
                            description={
                              <>
                                <Text>{item.details}</Text>
                                {item.urgency && item.urgency !== 'none' && (
                                  <Tag color={item.urgency === 'immediate' ? 'red' : 'blue'}>
                                    {item.urgency === 'immediate' ? 'Urgent' : 'Recommended'}
                                  </Tag>
                                )}
                              </>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  </div>
                )}
              </>
            ) : (
              <Alert
                message="No Significant Health Risks Detected"
                description="Your recent health data appears to be within normal ranges. Keep up the good work!"
                type="success"
                showIcon
              />
            )}
          </>
        ) : null}
      </Card>
      
      <div style={{ marginTop: '16px', textAlign: 'center' }}>
        <Button type="primary" onClick={analyzeHealthData} loading={loading}>
          Re-run Analysis
        </Button>
        <Button style={{ marginLeft: '8px' }} onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
};

const PatientDashboard = () => {
  const [healthData, setHealthData] = useState([]);
  const [medications, setMedications] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [riskScore, setRiskScore] = useState(0);
  const [points, setPoints] = useState(0);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [vitals, setVitals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [profileData, setProfileData] = useState(null);
  const [trendsData, setTrendsData] = useState([]);
  const navigate = useNavigate();
  const [isAppointmentModalVisible, setIsAppointmentModalVisible] = useState(false);
  const [appointmentForm] = Form.useForm();
  const [aiPredictions, setAiPredictions] = useState(null);
  const [healthRecommendations, setHealthRecommendations] = useState([]);
  const [isAssistantVisible, setIsAssistantVisible] = useState(false);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [simulationParams, setSimulationParams] = useState({
    days: 30,
    includeExercise: true,
    includeDiet: true,
    includeMedication: true
  });
  const [videoCallVisible, setVideoCallVisible] = useState(false);
  const [currentAppointment, setCurrentAppointment] = useState(null);

  useEffect(() => {
    fetchPatientData();
    fetchDoctors();
    fetchProfileData();
    fetchAIPredictions();
    fetchHealthRecommendations();
    
    const interval = setInterval(fetchPatientData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAIPredictions = async () => {
    try {
      setPredictionLoading(true);
      const response = await api.get('/patient/ai-predictions');
      setAiPredictions(response.data);
    } catch (error) {
      console.error('Error fetching AI predictions:', error);
      message.error('Failed to load AI predictions');
    } finally {
      setPredictionLoading(false);
    }
  };

  const fetchHealthRecommendations = async () => {
    try {
      const response = await api.get('/patient/ai-recommendations');
      setHealthRecommendations(response.data);
    } catch (error) {
      console.error('Error fetching health recommendations:', error);
    }
  };

  const runHealthSimulation = async () => {
    try {
      setPredictionLoading(true);
      const response = await api.post('/patient/ai-simulate', simulationParams);
      setAiPredictions(response.data);
      message.success('Health simulation completed');
    } catch (error) {
      console.error('Error running health simulation:', error);
      message.error('Failed to run health simulation');
    } finally {
      setPredictionLoading(false);
    }
  };

  const handleCreateAppointment = async (values) => {
    try {
      await api.post('/patient/appointments', {
        doctorId: selectedDoctor,
        dateTime: values.dateTime.format('YYYY-MM-DDTHH:mm:ss'),
        type: values.type,
        notes: values.notes
      });
      message.success('Appointment created successfully');
      setIsAppointmentModalVisible(false);
      appointmentForm.resetFields();
      fetchPatientData();
    } catch (error) {
      console.error('Error creating appointment:', error);
      message.error('Failed to create appointment');
    }
  };

  const fetchPatientData = async () => {
    try {
      setLoading(true);
      
      const [
        healthResponse, 
        medsResponse, 
        alertsResponse, 
        appointmentsResponse, 
        riskResponse, 
        pointsResponse, 
        vitalsResponse
      ] = await Promise.all([
        api.get('/patient/health-data?limit=0'),
        api.get('/patient/medications'),
        api.get('/patient/alerts'),
        api.get('/patient/appointments'),
        api.get('/patient/risk-score'),
        api.get('/patient/points'),
        api.get('/patient/vitals')
      ]);

      setHealthData(healthResponse.data || []);
      setMedications(medsResponse.data || []);
      setAlerts(alertsResponse.data || []);
      setAppointments(appointmentsResponse.data || []);
      setRiskScore(riskResponse.data?.score || 0);
      setPoints(pointsResponse.data?.points || 0);
      
      const processedTrendsData = healthResponse.data?.map(item => ({
        RecordedAt: item.RecordedAt,
        BloodPressure: item.BloodPressure,
        HeartRate: item.HeartRate,
        BloodSugar: item.BloodSugar,
        OxygenLevel: item.OxygenLevel,
        Notes: item.Notes
      })) || [];
      setTrendsData(processedTrendsData);
      
      const unread = alertsResponse.data?.filter(a => !a.IsRead)?.length || 0;
      setUnreadAlerts(unread);
      
      if (vitalsResponse.data) {
        setVitals(vitalsResponse.data);
      } else if (healthResponse.data?.length > 0) {
        const latest = healthResponse.data[0];
        setVitals({
          bloodPressure: latest.BloodPressure,
          heartRate: latest.HeartRate,
          bloodSugar: latest.BloodSugar,
          oxygenLevel: latest.OxygenLevel
        });
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching patient data:', error);
      setLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const response = await api.get('/doctors');
      setDoctors(response.data || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const fetchProfileData = async () => {
    try {
      const response = await api.get('/patient/profile');
      setProfileData(response.data || null);
    } catch (error) {
      console.error('Error fetching profile data:', error);
    }
  };

  const handleAddHealthData = async (values) => {
    try {
      await api.post('/patient/health-data', values);
      message.success('Health data added successfully');
      setIsModalVisible(false);
      form.resetFields();
      fetchPatientData();
    } catch (error) {
      console.error('Error adding health data:', error);
      message.error('Failed to add health data');
    }
  };

  const handleMarkMedicationTaken = async (medicationId) => {
    try {
      await api.post(`/patient/medications/${medicationId}/taken`);
      message.success('Medication marked as taken');
      fetchPatientData();
    } catch (error) {
      console.error('Error marking medication:', error);
      message.error('Failed to mark medication');
    }
  };

  const handleMarkAlertRead = async (alertId) => {
    try {
      await api.post(`/patient/alerts/${alertId}/read`);
      message.success('Alert marked as read');
      fetchPatientData();
    } catch (error) {
      console.error('Error marking alert:', error);
      message.error('Failed to mark alert');
    }
  };

  const handleTabChange = (key) => {
    setActiveTab(key);
  };

  const renderAIPredictions = () => (
    <Card 
      title={
        <Space>
          <RobotOutlined />
          <span>AI Health Predictions</span>
          <Tooltip title="These predictions are based on your health data and machine learning models">
            <QuestionCircleOutlined />
          </Tooltip>
        </Space>
      }
      className="dashboard-section-card"
      hoverable
      extra={
        <Space>
          <Button 
            type="primary" 
            size="small" 
            onClick={() => setIsAssistantVisible(true)}
            icon={<RobotOutlined />}
            loading={predictionLoading}
          >
            Analyze Health
          </Button>
          <Button 
            size="small" 
            onClick={runHealthSimulation}
            icon={<LineChartOutlined />}
            loading={predictionLoading}
          >
            Run Simulation
          </Button>
        </Space>
      }
    >
      {predictionLoading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin size="large" />
          <div>Analyzing your health data...</div>
        </div>
      ) : aiPredictions ? (
        <>
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <AIPredictionChart data={aiPredictions} />
            </Col>
          </Row>
          <Divider />
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Title level={5}>Simulation Parameters</Title>
              <Form layout="inline">
                <Form.Item label="Projection Days">
                  <InputNumber 
                    min={7} 
                    max={365} 
                    value={simulationParams.days} 
                    onChange={(value) => setSimulationParams({...simulationParams, days: value})} 
                  />
                </Form.Item>
                <Form.Item label="Include Exercise">
                  <Switch 
                    checked={simulationParams.includeExercise} 
                    onChange={(checked) => setSimulationParams({...simulationParams, includeExercise: checked})} 
                  />
                </Form.Item>
                <Form.Item label="Include Diet">
                  <Switch 
                    checked={simulationParams.includeDiet} 
                    onChange={(checked) => setSimulationParams({...simulationParams, includeDiet: checked})} 
                  />
                </Form.Item>
                <Form.Item label="Include Medication">
                  <Switch 
                    checked={simulationParams.includeMedication} 
                    onChange={(checked) => setSimulationParams({...simulationParams, includeMedication: checked})} 
                  />
                </Form.Item>
              </Form>
            </Col>
          </Row>
        </>
      ) : (
        <Alert
          message="No AI predictions available"
          description="We need more health data to generate accurate predictions. Please add your health readings."
          type="info"
          showIcon
        />
      )}
    </Card>
  );

  const renderAIRecommendations = () => (
    <Card 
      title={
        <Space>
          <BarChartOutlined />
          <span>Personalized Recommendations</span>
        </Space>
      }
      className="dashboard-section-card"
      hoverable
    >
      {healthRecommendations.length > 0 ? (
        <List
          itemLayout="horizontal"
          dataSource={healthRecommendations}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                avatar={
                  item.priority === 'high' ? (
                    <WarningOutlined style={{ color: '#ff4d4f', fontSize: '20px' }} />
                  ) : (
                    <InfoCircleOutlined style={{ color: '#1890ff', fontSize: '20px' }} />
                  )
                }
                title={<Text strong>{item.category}</Text>}
                description={
                  <>
                    <Text>{item.recommendation}</Text>
                    <div style={{ marginTop: '8px' }}>
                      <Tag color={item.priority === 'high' ? 'error' : 'processing'}>
                        {item.priority === 'high' ? 'High Priority' : 'Suggestion'}
                      </Tag>
                      {item.expectedImpact && (
                        <Tag color="blue">Impact: {item.expectedImpact}%</Tag>
                      )}
                    </div>
                  </>
                }
              />
            </List.Item>
          )}
        />
      ) : (
        <Alert
          message="No recommendations available"
          description="Complete your health profile and add more data to get personalized recommendations."
          type="info"
          showIcon
        />
      )}
    </Card>
  );

  const renderDoctorInfo = (doctorId) => {
    const doctor = doctors.find(d => d.id === doctorId);
    if (!doctor) return null;

    return (
      <Card 
        size="small" 
        style={{ marginTop: '16px', backgroundColor: '#f0f8ff' }}
      >
        <List size="small">
          <List.Item>
            <List.Item.Meta
              title="Specialization"
              description={doctor.specialization}
            />
          </List.Item>
          <List.Item>
            <List.Item.Meta
              title="Hospital Affiliation"
              description={doctor.hospital}
            />
          </List.Item>
          <List.Item>
            <List.Item.Meta
              title="Contact"
              description={
                <>
                  <div>{doctor.phone}</div>
                  <div>{doctor.email}</div>
                </>
              }
            />
          </List.Item>
        </List>
      </Card>
    );
  };

  const healthDataColumns = [
    {
      title: 'Date',
      dataIndex: 'RecordedAt',
      key: 'date',
      render: (text) => new Date(text).toLocaleString(),
      sorter: (a, b) => new Date(a.RecordedAt) - new Date(b.RecordedAt)
    },
    {
      title: 'Blood Pressure',
      dataIndex: 'BloodPressure',
      key: 'bloodPressure',
      render: (text) => {
        if (!text) return '--/--';
        const [systolic, diastolic] = text.split('/').map(Number);
        let color = 'default';
        if (systolic > 140 || diastolic > 90) color = 'error';
        else if (systolic > 130 || diastolic > 85) color = 'warning';
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: 'Heart Rate',
      dataIndex: 'HeartRate',
      key: 'heartRate',
      render: (text) => {
        if (!text) return '--';
        let color = 'default';
        if (text > 100 || text < 60) color = 'error';
        else if (text > 90 || text < 65) color = 'warning';
        return <Tag color={color}>{text} bpm</Tag>;
      }
    },
    {
      title: 'Blood Sugar',
      dataIndex: 'BloodSugar',
      key: 'bloodSugar',
      render: (text) => {
        if (!text) return '--';
        let color = 'default';
        if (text > 140) color = 'error';
        else if (text > 120) color = 'warning';
        return <Tag color={color}>{text} mg/dL</Tag>;
      }
    },
    {
      title: 'Oxygen Level',
      dataIndex: 'OxygenLevel',
      key: 'oxygenLevel',
      render: (text) => {
        if (!text) return '--';
        let color = 'default';
        if (text < 92) color = 'error';
        else if (text < 95) color = 'warning';
        return <Tag color={color}>{text}%</Tag>;
      }
    },
    {
      title: 'Notes',
      dataIndex: 'Notes',
      key: 'notes',
      render: (text) => text || '--'
    }
  ];

  const medicationColumns = [
    {
      title: 'Medication',
      dataIndex: 'Name',
      key: 'name'
    },
    {
      title: 'Dosage',
      dataIndex: 'Dosage',
      key: 'dosage'
    },
    {
      title: 'Frequency',
      dataIndex: 'Frequency',
      key: 'frequency'
    },
    {
      title: 'Next Dose',
      dataIndex: 'NextDose',
      key: 'nextDose',
      render: (text, record) => (
        <div>
          <div>{text ? new Date(text).toLocaleDateString() : '--'}</div>
          <Text type="secondary">{text ? new Date(text).toLocaleTimeString() : ''}</Text>
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'Status',
      key: 'status',
      render: (text, record) => (
        text === 'Taken' ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            Taken
          </Tag>
        ) : (
          <Space>
            <Tag icon={<SyncOutlined spin />} color="processing">
              Pending
            </Tag>
            <Popconfirm
              title="Mark this medication as taken?"
              onConfirm={() => handleMarkMedicationTaken(record.MedicationID)}
              okText="Yes"
              cancelText="No"
            >
              <Button size="small" icon={<CheckOutlined />}>Mark Taken</Button>
            </Popconfirm>
          </Space>
        )
      )
    }
  ];

  const alertColumns = [
    {
      title: 'Time',
      dataIndex: 'Timestamp',
      key: 'timestamp',
      render: (text) => text ? new Date(text).toLocaleString() : '--',
      sorter: (a, b) => new Date(a.Timestamp) - new Date(b.Timestamp)
    },
    {
      title: 'Message',
      dataIndex: 'Message',
      key: 'message',
      render: (text, record) => (
        <div>
          <div>{text || '--'}</div>
          {record.Severity && (
            <Tag color={
              record.Severity === 'High' ? 'error' : 
              record.Severity === 'Medium' ? 'warning' : 'processing'
            }>
              {record.Severity}
            </Tag>
          )}
        </div>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        record.IsRead ? (
          <Tag color="default">Read</Tag>
        ) : (
          <Button 
            size="small" 
            onClick={() => handleMarkAlertRead(record.AlertID)}
          >
            Mark Read
          </Button>
        )
      )
    }
  ];

  const appointmentColumns = [
    {
      title: 'Date & Time',
      dataIndex: 'DateTime',
      key: 'datetime',
      render: (text) => (
        <div>
          <div>{text ? new Date(text).toLocaleDateString() : '--'}</div>
          <Text type="secondary">{text ? new Date(text).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</Text>
        </div>
      ),
      sorter: (a, b) => new Date(a.DateTime) - new Date(b.DateTime)
    },
    {
      title: 'Doctor',
      dataIndex: 'DoctorName',
      key: 'doctorName',
      render: (text, record) => (
        <div>
          <div>{text}</div>
          <Text type="secondary">{record.DoctorSpecialization || record.Type}</Text>
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'Status',
      key: 'status',
      render: (text) => (
        <Tag 
          color={
            text === 'Completed' ? 'success' : 
            text === 'Cancelled' ? 'error' : 'processing'
          }
        >
          {text}
        </Tag>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {record.Status === 'Scheduled' && (
            <Button 
              type="primary" 
              size="small"
              onClick={() => {
                setCurrentAppointment(record);
                setVideoCallVisible(true);
              }}
            >
              Start
            </Button>
          )}
          <Button 
            size="small"
            onClick={() => {
              Modal.info({
                title: 'Appointment Details',
                content: (
                  <div>
                    <p><strong>Doctor:</strong> {record.DoctorName}</p>
                    <p><strong>Time:</strong> {new Date(record.DateTime).toLocaleString()}</p>
                    <p><strong>Type:</strong> {record.Type}</p>
                    <p><strong>Status:</strong> {record.Status}</p>
                    {record.Notes && <p><strong>Notes:</strong> {record.Notes}</p>}
                  </div>
                )
              });
            }}
          >
            Details
          </Button>
        </Space>
      )
    }
  ];

  const renderDashboard = () => (
    <>
      {alerts.some(alert => alert.Severity === 'High' && !alert.IsRead) && (
        <Alert
          message="Critical Alert"
          description="You have high priority alerts that require immediate attention."
          type="error"
          showIcon
          closable
          style={{ marginBottom: '24px' }}
          action={
            <Button 
              type="primary" 
              size="small" 
              onClick={() => setActiveTab('alerts')}
            >
              View Alerts
            </Button>
          }
        />
      )}
      
      <Row gutter={[16, 16]} className="dashboard-stats">
        <Col xs={24} sm={12} md={8}>
          <Card className="dashboard-card" hoverable>
            <Statistic 
              title="AI Health Risk Score" 
              value={riskScore} 
              suffix="/100" 
              prefix={
                riskScore > 70 ? <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} /> : 
                riskScore > 40 ? <ExclamationCircleOutlined style={{ color: '#faad14' }} /> : 
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
              }
            />
            <Progress 
              percent={riskScore} 
              showInfo={false} 
              strokeColor={
                riskScore > 70 ? '#ff4d4f' : 
                riskScore > 40 ? '#faad14' : '#52c41a'
              } 
            />
            <Text type="secondary">
              {riskScore > 70 ? 'High Risk - Contact your doctor' : 
               riskScore > 40 ? 'Moderate Risk - Monitor closely' : 'Low Risk - Good condition'}
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card className="dashboard-card" hoverable>
            <Statistic 
              title="Medications Today" 
              value={
                medications.filter(m => m.NextDose && new Date(m.NextDose).toDateString() === new Date().toDateString()).length
              }
              prefix={<MedicineBoxOutlined />}
            />
            <Text type="secondary">
              {medications.filter(m => m.Status === 'Taken').length} taken, {
                medications.filter(m => m.Status !== 'Taken' && 
                  m.NextDose && new Date(m.NextDose).toDateString() === new Date().toDateString()
                ).length
              } remaining
            </Text>
            <Button 
              type="link" 
              size="small" 
              onClick={() => setActiveTab('medications')}
              style={{ padding: 0 }}
            >
              View all medications
            </Button>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card className="dashboard-card" hoverable>
            <Statistic 
              title="New Alerts" 
              value={unreadAlerts}
              prefix={<BellOutlined />}
            />
            <Text type="secondary">
              {alerts.filter(a => a.Severity === 'High' && !a.IsRead).length} critical, {
                alerts.filter(a => a.Severity === 'Medium' && !a.IsRead).length
              } warnings
            </Text>
            <Button 
              type="link" 
              size="small" 
              onClick={() => setActiveTab('alerts')}
              style={{ padding: 0 }}
            >
              View all alerts
            </Button>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="dashboard-sections">
        <Col xs={24} md={12}>
          <Card 
            title="Current Vitals" 
            className="dashboard-section-card" 
            hoverable
            extra={
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={() => setIsModalVisible(true)}
                loading={loading}
              >
                Add Manual Reading
              </Button>
            }
          >
            {loading ? (
              <Spin />
            ) : vitals ? (
              <Row gutter={[16, 16]}>
                <Col xs={12} sm={12} md={12}>
                  <Card size="small">
                    <Statistic 
                      title="Blood Pressure" 
                      value={vitals.bloodPressure || '--/--'} 
                      prefix={
                        vitals.bloodPressure ? (
                          vitals.bloodPressure.split('/')[0] > 140 || vitals.bloodPressure.split('/')[1] > 90 ? 
                            <ArrowUpOutlined style={{ color: '#ff4d4f' }} /> : 
                            vitals.bloodPressure.split('/')[0] > 130 || vitals.bloodPressure.split('/')[1] > 85 ? 
                            <ArrowUpOutlined style={{ color: '#faad14' }} /> : 
                            null
                        ) : null
                      }
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={12} md={12}>
                  <Card size="small">
                    <Statistic 
                      title="Heart Rate" 
                      value={vitals.heartRate || '--'} 
                      suffix="bpm"
                      prefix={
                        vitals.heartRate ? (
                          vitals.heartRate > 100 || vitals.heartRate < 60 ? 
                            <ArrowUpOutlined style={{ color: '#ff4d4f' }} /> : 
                            vitals.heartRate > 90 || vitals.heartRate < 65 ? 
                            <ArrowUpOutlined style={{ color: '#faad14' }} /> : 
                            null
                        ) : null
                      }
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={12} md={12}>
                  <Card size="small">
                    <Statistic 
                      title="Blood Sugar" 
                      value={vitals.bloodSugar || '--'} 
                      suffix="mg/dL"
                      prefix={
                        vitals.bloodSugar ? (
                          vitals.bloodSugar > 140 ? 
                            <ArrowUpOutlined style={{ color: '#ff4d4f' }} /> : 
                            vitals.bloodSugar > 120 ? 
                            <ArrowUpOutlined style={{ color: '#faad14' }} /> : 
                            null
                        ) : null
                      }
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={12} md={12}>
                  <Card size="small">
                    <Statistic 
                      title="Oxygen Level" 
                      value={vitals.oxygenLevel || '--'} 
                      suffix="%"
                      prefix={
                        vitals.oxygenLevel ? (
                          vitals.oxygenLevel < 92 ? 
                            <ArrowDownOutlined style={{ color: '#ff4d4f' }} /> : 
                            vitals.oxygenLevel < 95 ? 
                            <ArrowDownOutlined style={{ color: '#faad14' }} /> : 
                            null
                        ) : null
                      }
                    />
                  </Card>
                </Col>
              </Row>
            ) : (
              <Alert
                message="No recent vitals data"
                description="Add your health readings to see current vitals"
                type="info"
                showIcon
              />
            )}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card 
            title="Health Trends" 
            className="dashboard-section-card" 
            hoverable
            extra={
              <Button 
                type="link" 
                onClick={() => setActiveTab('health-data')}
              >
                View All Data
              </Button>
            }
          >
            {trendsData.length > 0 ? (
              <HealthTrendsChart data={trendsData} />
            ) : (
              <Alert
                message="No health trends data available"
                description="Add your health readings to see trends over time"
                type="info"
                showIcon
              />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="dashboard-sections">
        <Col xs={24} lg={12}>
          {renderAIPredictions()}
        </Col>
        <Col xs={24} lg={12}>
          {renderAIRecommendations()}
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="dashboard-sections">
        <Col span={24}>
          <Card 
            title={
              <Space>
                <CalendarOutlined />
                <span>Upcoming Appointments</span>
              </Space>
            }
            className="dashboard-section-card"
            hoverable
            extra={
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={() => setIsAppointmentModalVisible(true)}
              >
                New Appointment
              </Button>
            }
          >
            {appointments.length > 0 ? (
              <Table 
                columns={appointmentColumns} 
                dataSource={appointments.filter(a => a.Status === 'Scheduled')} 
                rowKey="AppointmentID"
                pagination={false}
                size="small"
              />
            ) : (
              <Alert
                message="No upcoming appointments"
                description="Schedule an appointment with your doctor"
                type="info"
                showIcon
              />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="dashboard-sections">
        <Col span={24}>
          <RewardsProgram points={points} />
        </Col>
      </Row>
    </>
  );

  const renderHealthDataTab = () => (
    <Card title="Health Data History" className="dashboard-section-card">
      <Table 
        columns={healthDataColumns} 
        dataSource={healthData} 
        rowKey="HealthDataID"
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );

  const renderMedicationsTab = () => (
    <Card title="Medication Schedule" className="dashboard-section-card">
      <Table 
        columns={medicationColumns} 
        dataSource={medications} 
        rowKey="MedicationID"
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );

  const renderAlertsTab = () => (
    <Card title="Health Alerts" className="dashboard-section-card">
      <Table 
        columns={alertColumns} 
        dataSource={alerts} 
        rowKey="AlertID"
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );

  const renderAppointmentsTab = () => (
    <Card title="Appointment History" className="dashboard-section-card">
      <Table 
        columns={appointmentColumns} 
        dataSource={appointments} 
        rowKey="AppointmentID"
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );

  const renderProfileTab = () => (
    <Card title="Profile Information" className="dashboard-section-card">
      {profileData ? (
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <Avatar size={100} icon={<UserOutlined />} />
                <Title level={4} style={{ marginTop: '16px' }}>
                  {profileData.firstName} {profileData.lastName}
                </Title>
              </div>
            </Card>
          </Col>
          <Col span={16}>
            <Card title="Personal Information">
              <List>
                <List.Item>
                  <List.Item.Meta
                    title="Email"
                    description={profileData.email || 'Not provided'}
                  />
                </List.Item>
                <List.Item>
                  <List.Item.Meta
                    title="Phone"
                    description={profileData.phoneNumber || 'Not provided'}
                  />
                </List.Item>
                <List.Item>
                  <List.Item.Meta
                    title="Date of Birth"
                    description={profileData.dateOfBirth ? new Date(profileData.dateOfBirth).toLocaleDateString() : 'Not provided'}
                  />
                </List.Item>
                <List.Item>
                  <List.Item.Meta
                    title="Gender"
                    description={profileData.gender || 'Not provided'}
                  />
                </List.Item>
              </List>
            </Card>
          </Col>
        </Row>
      ) : (
        <Spin />
      )}
    </Card>
  );

  return (
    <Layout className="patient-dashboard-layout">
      <Header />
      <Layout>
        <Sider width={200} className="dashboard-sider">
          <Menu
            mode="inline"
            defaultSelectedKeys={['dashboard']}
            selectedKeys={[activeTab]}
            style={{ height: '100%', borderRight: 0 }}
            onSelect={({ key }) => handleTabChange(key)}
          >
            <Menu.Item key="dashboard" icon={<DashboardOutlined />}>
              Dashboard
            </Menu.Item>
            <Menu.Item key="profile" icon={<UserOutlined />}>
              Profile
            </Menu.Item>
            <Menu.Item key="health-data" icon={<LineChartOutlined />}>
              Health Data
            </Menu.Item>
            <Menu.Item key="medications" icon={<MedicineBoxOutlined />}>
              Medications
            </Menu.Item>
            <Menu.Item key="alerts" icon={<BellOutlined />}>
              Alerts <Badge count={unreadAlerts} style={{ backgroundColor: '#52c41a' }} />
            </Menu.Item>
            <Menu.Item key="appointments" icon={<CalendarOutlined />}>
              Appointments
            </Menu.Item>
          </Menu>
        </Sider>
        <Layout style={{ padding: '0 24px 24px' }}>
          <Content
            className="dashboard-content"
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
            }}
          >
            {loading ? (
              <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" />
                <div>Loading your health data...</div>
              </div>
            ) : (
              <>
                {activeTab === 'dashboard' && renderDashboard()}
                {activeTab === 'profile' && renderProfileTab()}
                {activeTab === 'health-data' && renderHealthDataTab()}
                {activeTab === 'medications' && renderMedicationsTab()}
                {activeTab === 'alerts' && renderAlertsTab()}
                {activeTab === 'appointments' && renderAppointmentsTab()}
              </>
            )}
          </Content>
        </Layout>
      </Layout>

      {/* Add Health Data Modal */}
      <Modal
        title="Add Manual Health Data"
        visible={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        okText="Submit"
        cancelText="Cancel"
      >
        <Form form={form} onFinish={handleAddHealthData} layout="vertical">
          <Form.Item 
            name="bloodPressure" 
            label="Blood Pressure" 
            rules={[
              { required: true, message: 'Please input your blood pressure!' },
              {
                pattern: /^\d{2,3}\/\d{2,3}$/,
                message: 'Format: systolic/diastolic (e.g., 120/80)'
              },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value) return Promise.resolve();
                  const [systolic, diastolic] = value.split('/').map(Number);
                  
                  if (systolic < 70 || systolic > 250) {
                    return Promise.reject('Systolic must be between 70-250');
                  }
                  if (diastolic < 40 || diastolic > 150) {
                    return Promise.reject('Diastolic must be between 40-150');
                  }
                  if (systolic <= diastolic) {
                    return Promise.reject('Systolic must be higher than diastolic');
                  }
                  return Promise.resolve();
                },
              }),
            ]}
            tooltip="Normal range: 90/60 to 120/80 mmHg"
          >
            <Input placeholder="e.g. 120/80" />
          </Form.Item>
          
          <Form.Item 
            name="heartRate" 
            label="Heart Rate (bpm)" 
            rules={[
              { required: true, message: 'Please input your heart rate!' },
              {
                type: 'number',
                min: 30,
                max: 200,
                message: 'Heart rate must be between 30-200 bpm'
              }
            ]}
            tooltip="Normal range: 60-100 bpm"
          >
            <InputNumber 
              style={{ width: '100%' }}
              min={30}
              max={200}
            />
          </Form.Item>
          
          <Form.Item 
            name="bloodSugar" 
            label="Blood Sugar (mg/dL)" 
            rules={[
              { required: true, message: 'Please input your blood sugar level!' },
              {
                type: 'number',
                min: 50,
                max: 500,
                message: 'Blood sugar must be between 50-500 mg/dL'
              }
            ]}
            tooltip={
              <>
                Normal ranges:<br />
                Fasting: 70-99 mg/dL<br />
                After meal: 140 mg/dL
              </>
            }
          >
            <InputNumber 
              style={{ width: '100%' }}
              min={50}
              max={500}
            />
          </Form.Item>
          
          <Form.Item 
            name="oxygenLevel" 
            label="Oxygen Level (%)" 
            rules={[
              { required: true, message: 'Please input your oxygen level!' },
              {
                type: 'number',
                min: 70,
                max: 100,
                message: 'Oxygen level must be between 70-100%'
              }
            ]}
            tooltip="Normal range: 95-100%"
          >
            <InputNumber 
              style={{ width: '100%' }}
              min={70}
              max={100}
              formatter={value => `${value}%`}
              parser={value => value.replace('%', '')}
            />
          </Form.Item>
          
          <Form.Item name="notes" label="Notes">
            <Input.TextArea placeholder="Any additional notes about your readings" />
          </Form.Item>
        </Form>
      </Modal>

      {/* New Appointment Modal */}
      <Modal
        title="Schedule New Appointment"
        visible={isAppointmentModalVisible}
        onCancel={() => setIsAppointmentModalVisible(false)}
        footer={null}
        width={700}
      >
        <Form
          form={appointmentForm}
          layout="vertical"
          onFinish={handleCreateAppointment}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Doctor"
                name="doctorId"
                rules={[{ required: true, message: 'Please select a doctor' }]}
              >
                <Select
                  placeholder="Select doctor"
                  onChange={setSelectedDoctor}
                  showSearch
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                  }
                >
                  {doctors.map(doctor => (
                    <Option key={doctor.id} value={doctor.id}>
                      {doctor.name} ({doctor.specialization})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              {selectedDoctor && renderDoctorInfo(selectedDoctor)}
            </Col>
            <Col span={12}>
              <Form.Item
                label="Appointment Type"
                name="type"
                rules={[{ required: true, message: 'Please select appointment type' }]}
              >
                <Select placeholder="Select type">
                  <Option value="Checkup">Regular Checkup</Option>
                  <Option value="Follow-up">Follow-up</Option>
                  <Option value="Consultation">Consultation</Option>
                  <Option value="Emergency">Emergency</Option>
                  <Option value="Other">Other</Option>
                </Select>
              </Form.Item>
              <Form.Item
                label="Date & Time"
                name="dateTime"
                rules={[{ required: true, message: 'Please select date and time' }]}
              >
                <DatePicker 
                  showTime 
                  format="YYYY-MM-DD HH:mm"
                  disabledDate={(current) => current && current < moment().startOf('day')}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="Notes"
            name="notes"
          >
            <Input.TextArea rows={4} placeholder="Any specific concerns or details..." />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Schedule Appointment
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* AI Health Assistant Modal */}
      {isAssistantVisible && (
        <HealthAssistant 
          healthData={healthData} 
          vitals={vitals}
          medications={medications}
          riskScore={riskScore}
          onClose={() => setIsAssistantVisible(false)} 
        />
      )}

      {/* Video Call Component */}
      <VideoCall
        visible={videoCallVisible}
        onClose={() => setVideoCallVisible(false)}
        appointment={currentAppointment}
        userRole="patient"
      />

      {/* Floating Action Button for Health Assistant */}
      <FloatButton
        icon={<RobotOutlined />}
        type="primary"
        tooltip="AI Health Assistant"
        onClick={() => setIsAssistantVisible(true)}
        style={{
          right: 24,
          bottom: 100,
          width: 60,
          height: 60
        }}
      />
    </Layout>
  );
};

export default PatientDashboard;