import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Card, Row, Col, Typography, Table, Tabs, Tag, Badge, Spin, 
  Descriptions, Divider, Statistic, Progress, Button 
} from 'antd';
import { 
  UserOutlined, HeartOutlined, MedicineBoxOutlined, 
  AlertOutlined, LineChartOutlined, ArrowLeftOutlined 
} from '@ant-design/icons';
import api from '../../../services/api';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const DoctorPatientDetail = () => {
  const { id } = useParams();
  const [patientData, setPatientData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPatientData();
  }, [id]);

  const fetchPatientData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/doctor/patient/${id}`);
      setPatientData(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching patient data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!patientData) {
    return <Text>No patient data available</Text>;
  }

  return (
    <div className="patient-detail-container">
      <Button 
        type="text" 
        icon={<ArrowLeftOutlined />} 
        onClick={() => navigate(-1)}
        style={{ marginBottom: '16px' }}
      >
        Back to Patients
      </Button>
      
      <Card title="Patient Profile">
        <Descriptions bordered column={2}>
          <Descriptions.Item label="Name">{patientData.profile.name}</Descriptions.Item>
          <Descriptions.Item label="Gender">{patientData.profile.gender || 'N/A'}</Descriptions.Item>
          <Descriptions.Item label="Date of Birth">
            {patientData.profile.dob ? new Date(patientData.profile.dob).toLocaleDateString() : 'N/A'}
          </Descriptions.Item>
          <Descriptions.Item label="Email">{patientData.profile.email}</Descriptions.Item>
          <Descriptions.Item label="Phone">{patientData.profile.phone || 'N/A'}</Descriptions.Item>
          <Descriptions.Item label="Address">{patientData.profile.address || 'N/A'}</Descriptions.Item>
          <Descriptions.Item label="Emergency Contact">
            {patientData.profile.emergencyContact || 'N/A'}
          </Descriptions.Item>
          <Descriptions.Item label="Emergency Phone">
            {patientData.profile.emergencyPhone || 'N/A'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Divider />

      <Tabs defaultActiveKey="health">
        <TabPane tab="Health Data" key="health" icon={<HeartOutlined />}>
          {/* Health data table */}
        </TabPane>
        <TabPane tab="Medications" key="medications" icon={<MedicineBoxOutlined />}>
          {/* Medications table */}
        </TabPane>
        <TabPane tab="Risk History" key="risk" icon={<AlertOutlined />}>
          {/* Risk score chart */}
        </TabPane>
      </Tabs>
    </div>
  );
};

export default DoctorPatientDetail;