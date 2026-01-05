import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, Button, Alert, ActivityIndicator, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { API_BASE_URL } from './config';

export default function QRScanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scannedData, setScannedData] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [patientInfo, setPatientInfo] = useState(null);
  const [lastScanTime, setLastScanTime] = useState(0);

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  const verifyQRToken = async (token) => {
    try {
      setVerifying(true);
      
      console.log('Verifying QR token with backend:', API_BASE_URL);
      
      const response = await fetch(`${API_BASE_URL}/patient/verifyQRToken`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const result = await response.json();
      
      console.log('Verification result:', result);
      
      setVerifying(false);

      if (result.success) {
        const { patientData, generatedAt, expiresAt } = result.data;
        setPatientInfo(patientData);
        
        Alert.alert(
          '✅ Valid Patient QR Code',
          `Name: ${patientData.fullName}\nDOB: ${patientData.dob}\nGender: ${patientData.gender}\n\nGenerated: ${new Date(generatedAt).toLocaleString()}\nExpires: ${new Date(expiresAt).toLocaleString()}`,
          [
            {
              text: 'OK',
              onPress: () => {
                setScanned(false);
                setPatientInfo(null);
              }
            }
          ]
        );
      } else {
        let errorMessage = result.message || 'Failed to verify QR code';
        
        if (result.errorCode === 'TOKEN_EXPIRED') {
          errorMessage = '⏰ QR Code Expired\n\nThis QR code has expired (30 min limit). Please generate a new one.';
        } else if (result.errorCode === 'INVALID_TOKEN') {
          errorMessage = '❌ Invalid QR Code\n\nThis QR code is not valid or has been tampered with.';
        } else if (result.errorCode === 'INVALID_TOKEN_TYPE') {
          errorMessage = '❌ Wrong Token Type\n\nThis is not a valid patient QR code.';
        }
        
        Alert.alert(
          'Verification Failed',
          errorMessage,
          [
            {
              text: 'Scan Again',
              onPress: () => {
                setScanned(false);
                setPatientInfo(null);
              }
            }
          ]
        );
      }
    } catch (error) {
      setVerifying(false);
      console.error('Verification error:', error);
      Alert.alert(
        'Connection Error',
        `Unable to verify QR code. Please check your internet connection.\n\nError: ${error.message}\n\nAPI URL: ${API_BASE_URL}`,
        [
          {
            text: 'Try Again',
            onPress: () => {
              setScanned(false);
              setPatientInfo(null);
            }
          }
        ]
      );
    }
  };

  const handleBarCodeScanned = ({ type, data }) => {
    // Only process QR codes (ignore other barcode types)
    if (type !== 'qr' && type !== 256) { // 256 is QR code type number
      return;
    }
    
    // Validate that the scanned data looks like a JWT token
    // JWT tokens have 3 parts separated by dots
    const jwtPattern = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
    if (!jwtPattern.test(data)) {
      console.log('Scanned data is not a valid JWT token, ignoring');
      return;
    }
    
    // Prevent duplicate scans within 2 seconds
    const now = Date.now();
    if (now - lastScanTime < 2000) {
      return;
    }
    setLastScanTime(now);
    
    setScanned(true);
    setScannedData(data);
    
    console.log('QR Code scanned:', { type, dataLength: data.length });
    
    // Verify the JWT token with backend
    verifyQRToken(data);
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No access to camera</Text>
        <Button
          title="Grant Permission"
          onPress={requestPermission}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'pdf417'],
        }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.header}>
        <Text style={styles.title}>Patient QR Code Scanner</Text>
        <Text style={styles.subtitle}>Secure JWT Verification</Text>
      </View>
      <View style={styles.overlay}>
        <View style={styles.scanArea} />
      </View>
      
      {verifying && (
        <View style={styles.verifyingContainer}>
          <ActivityIndicator size="large" color="#00ff00" />
          <Text style={styles.verifyingText}>Verifying QR Code...</Text>
        </View>
      )}
      
      {scanned && !verifying && patientInfo && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>✅ Verified Patient</Text>
          <Text style={styles.resultText}>Name: {patientInfo.fullName}</Text>
          <Text style={styles.resultText}>DOB: {patientInfo.dob}</Text>
          <Text style={styles.resultText}>Gender: {patientInfo.gender}</Text>
          <Button 
            title="Scan Another" 
            onPress={() => {
              setScanned(false);
              setPatientInfo(null);
            }} 
          />
        </View>
      )}
      
      {!scanned && !verifying && (
        <View style={styles.instructionContainer}>
          <Text style={styles.instruction}>
            Point your camera at a patient QR code to scan and verify
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    zIndex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#00ff00',
    marginTop: 5,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#00ff00',
    backgroundColor: 'transparent',
  },
  text: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 20,
  },
  instructionContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  instruction: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
  },
  verifyingContainer: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: 30,
    borderRadius: 10,
    alignItems: 'center',
  },
  verifyingText: {
    fontSize: 16,
    marginTop: 15,
    color: '#00ff00',
  },
  resultContainer: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 20,
    borderRadius: 10,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#00aa00',
    textAlign: 'center',
  },
  resultText: {
    fontSize: 16,
    marginBottom: 8,
    color: '#000',
  },
});
