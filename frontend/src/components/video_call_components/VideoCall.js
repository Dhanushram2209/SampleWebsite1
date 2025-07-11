// src/components/VideoCall/VideoCall.js
import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Space, Typography, message } from 'antd';
import { VideoCameraOutlined, PhoneOutlined, AudioOutlined, AudioMutedOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const VideoCallComponent = ({ visible, onClose, appointment, userRole }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setIsConnecting(true);
      const timer = setTimeout(() => {
        setIsConnecting(false);
        message.success('Call connected');
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const toggleAudio = () => {
    setIsMuted(!isMuted);
    message.info(isMuted ? 'Microphone on' : 'Microphone muted');
  };

  const toggleVideo = () => {
    setIsVideoOff(!isVideoOff);
    message.info(isVideoOff ? 'Video on' : 'Video off');
  };

  const endCall = () => {
    onClose();
  };

  return (
    <Modal
      visible={visible}
      onCancel={endCall}
      footer={null}
      width={800}
      bodyStyle={{ padding: 0 }}
      destroyOnClose
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '600px' }}>
        {/* Remote Video */}
        <div
          ref={remoteVideoRef}
          style={{
            flex: 1,
            backgroundColor: '#f0f2f5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {isConnecting ? (
            <Title level={4}>Connecting...</Title>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <Title level={4}>Video Call Active</Title>
              <Text>Connected with {appointment?.DoctorName || 'Doctor'}</Text>
            </div>
          )}
        </div>

        {/* Local Video */}
        <div
          ref={localVideoRef}
          style={{
            position: 'absolute',
            bottom: '80px',
            right: '20px',
            width: '200px',
            height: '150px',
            backgroundColor: '#000',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}
        >
          {isVideoOff ? 'Video Off' : 'Your Camera'}
        </div>

        {/* Call Controls */}
        <div style={{
          padding: '16px',
          backgroundColor: '#fff',
          textAlign: 'center',
          borderTop: '1px solid #f0f0f0'
        }}>
          <Space size="large">
            <Button
              shape="circle"
              size="large"
              icon={isMuted ? <AudioMutedOutlined /> : <AudioOutlined />}
              onClick={toggleAudio}
              type={isMuted ? 'primary' : 'default'}
              danger={isMuted}
              disabled={isConnecting}
            />
            <Button
              shape="circle"
              size="large"
              icon={<PhoneOutlined />}
              onClick={endCall}
              type="primary"
              danger
            />
            <Button
              shape="circle"
              size="large"
              icon={<VideoCameraOutlined />}
              onClick={toggleVideo}
              type={isVideoOff ? 'primary' : 'default'}
              danger={isVideoOff}
              disabled={isConnecting}
            />
          </Space>
        </div>
      </div>
    </Modal>
  );
};

export default VideoCallComponent;