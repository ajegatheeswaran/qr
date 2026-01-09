import React, { useState, useEffect, useRef } from 'react';
import { Text, View, StyleSheet, Button, Alert, ActivityIndicator, Platform, TouchableOpacity, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { API_BASE_URL } from './config';

export default function QRScanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scannedData, setScannedData] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [patientInfo, setPatientInfo] = useState(null);
  const [authToken, setAuthToken] = useState(null); // Store JWT token for API calls
  const [lastScanTime, setLastScanTime] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [mode, setMode] = useState('qr'); // 'qr', 'photo', 'medication'
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef(null);

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
        setAuthToken(token); // Store the ORIGINAL scanned token for API calls
        setScanned(true);
        // Don't auto-dismiss, show confirmation UI
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
    // Handle medication barcode scanning
    if (mode === 'medication') {
      console.log('Medication barcode scanned:', { type, data });
      
      Alert.alert(
        '💊 Medication Scanned',
        `Barcode Type: ${type}\nData: ${data}\n\nLink this medication to ${patientInfo?.fullName}?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setMode('qr')
          },
          {
            text: 'Add Medication',
            onPress: async () => {
              await addMedicationToPatient(data, type);
            }
          }
        ]
      );
      return;
    }

    // Only process QR codes for patient verification
    if (type !== 'qr' && type !== 256) {
      return;
    }
    
    // Validate that the scanned data looks like a JWT token
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

  const addMedicationToPatient = async (barcodeData, barcodeType) => {
    try {
      setUploading(true);
      
      console.log('Adding medication to patient:', {
        patientId: patientInfo.id,
        barcode: barcodeData,
        type: barcodeType
      });
      
      // TODO: Integrate with existing medication history system
      // Need to map barcode to medication_history_types table
      
      setUploading(false);
      
      Alert.alert(
        '✅ Success',
        `Medication barcode scanned for ${patientInfo.fullName}!\n\nBarcode: ${barcodeData}\nType: ${barcodeType}\n\n(Integration with medication history pending)`,
        [
          {
            text: 'Scan Another',
            onPress: () => {} // Stay in medication mode
          },
          {
            text: 'Done',
            onPress: () => resetScanner()
          }
        ]
      );
    } catch (error) {
      setUploading(false);
      console.error('Add medication error:', error);
      Alert.alert('Error', 'Failed to add medication: ' + error.message);
    }
  };

  const handleConfirmPatient = () => {
    setConfirmed(true);
  };

  const handleTakePhoto = async () => {
    setMode('photo');
  };

  const capturePhoto = async () => {
    if (cameraRef.current) {
      try {
        setUploading(true);
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false, // We'll use URI for FormData
        });
        
        console.log('Photo captured:', photo.uri);
        setCapturedPhoto(photo);
        
        // Upload photo to backend
        await uploadPhotoToBackend(photo);
        
      } catch (error) {
        console.error('Photo capture error:', error);
        Alert.alert('Error', 'Failed to capture photo: ' + error.message);
        setUploading(false);
      }
    }
  };

  const uploadPhotoToBackend = async (photo) => {
    try {
      const formData = new FormData();
      
      // Get current date in DD/MM/YYYY format
      const now = new Date();
      const dateImage = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      
      // Append photo file
      formData.append('image', {
        uri: photo.uri,
        type: 'image/jpeg',
        name: `patient_${patientInfo.id}_${Date.now()}.jpg`,
      });
      
      formData.append('patientId', patientInfo.id);
      formData.append('woundId', patientInfo.woundId || ''); // Optional wound ID
      formData.append('imageTypeOfWound', 'QR_SCAN'); // Type identifier
      formData.append('dateImage', dateImage);
      
      console.log('Uploading photo to:', `${API_BASE_URL}/photo/send-photo-qr`);
      
      const response = await fetch(`${API_BASE_URL}/photo/send-photo-qr`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: formData,
      });
      
      const result = await response.json();
      
      setUploading(false);
      
      if (result.message === 'Success photo data saved' || response.ok) {
        Alert.alert(
          '✅ Success',
          `Photo uploaded successfully for ${patientInfo.fullName}!`,
          [
            {
              text: 'Take Another',
              onPress: () => setCapturedPhoto(null)
            },
            {
              text: 'Done',
              onPress: () => resetScanner()
            }
          ]
        );
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      setUploading(false);
      console.error('Upload error:', error);
      Alert.alert(
        'Upload Failed',
        `Failed to upload photo: ${error.message}\n\nPlease try again.`,
        [
          {
            text: 'Retry',
            onPress: () => uploadPhotoToBackend(photo)
          },
          {
            text: 'Cancel',
            onPress: () => {
              setCapturedPhoto(null);
              setMode('qr');
            }
          }
        ]
      );
    }
  };

  const handleScanMedication = () => {
    setMode('medication');
  };

  const resetScanner = () => {
    setScanned(false);
    setPatientInfo(null);
    setAuthToken(null);
    setConfirmed(false);
    setMode('qr');
    setCapturedPhoto(null);
    setUploading(false);
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
      {/* Only show camera when appropriate */}
      {(!scanned || mode === 'photo' || mode === 'medication') && !capturedPhoto && (
        <CameraView
          ref={cameraRef}
          facing="back"
          onBarcodeScanned={mode === 'photo' ? undefined : (mode === 'medication' ? handleBarCodeScanned : ((scanned && confirmed) ? undefined : handleBarCodeScanned))}
          barcodeScannerSettings={{
            barcodeTypes: mode === 'medication' ? ['qr', 'ean13', 'ean8', 'code128', 'code39'] : ['qr'],
          }}
          style={StyleSheet.absoluteFillObject}
        />
      )}
      
      {/* Show captured photo preview */}
      {capturedPhoto && (
        <Image source={{ uri: capturedPhoto.uri }} style={StyleSheet.absoluteFillObject} />
      )}
      
      <View style={styles.header}>
        <Text style={styles.title}>
          {mode === 'photo' ? '📷 Take Photo' : mode === 'medication' ? '💊 Scan Medication' : '🔍 Patient QR Scanner'}
        </Text>
        <Text style={styles.subtitle}>
          {mode === 'photo' ? 'Capture patient photo' : mode === 'medication' ? 'Scan medication barcode' : 'Secure JWT Verification'}
        </Text>
      </View>
      
      {/* Only show scan area when actively scanning */}
      {(!scanned || mode === 'medication') && !capturedPhoto && (
        <View style={styles.overlay}>
          <View style={styles.scanArea} />
        </View>
      )}
      
      {verifying && (
        <View style={styles.verifyingContainer}>
          <ActivityIndicator size="large" color="#00ff00" />
          <Text style={styles.verifyingText}>Verifying QR Code...</Text>
        </View>
      )}
      
      {/* Patient Confirmation Screen */}
      {scanned && !verifying && patientInfo && !confirmed && (
        <View style={styles.confirmationContainer}>
          <Text style={styles.confirmTitle}>✅ Patient Verified</Text>
          <View style={styles.patientCard}>
            <Text style={styles.patientLabel}>Name:</Text>
            <Text style={styles.patientValue}>{patientInfo.fullName}</Text>
            
            <Text style={styles.patientLabel}>Date of Birth:</Text>
            <Text style={styles.patientValue}>{patientInfo.dob}</Text>
            
            <Text style={styles.patientLabel}>Gender:</Text>
            <Text style={styles.patientValue}>{patientInfo.gender}</Text>
          </View>
          
          <Text style={styles.confirmQuestion}>Is this the correct patient?</Text>
          
          <View style={styles.confirmButtons}>
            <TouchableOpacity 
              style={[styles.confirmButton, styles.cancelButton]} 
              onPress={resetScanner}
            >
              <Text style={styles.buttonText}>❌ Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.confirmButton, styles.confirmButtonGreen]} 
              onPress={handleConfirmPatient}
            >
              <Text style={styles.buttonText}>✓ Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Action Menu After Confirmation */}
      {scanned && confirmed && patientInfo && mode === 'qr' && (
        <View style={styles.actionContainer}>
          <Text style={styles.actionTitle}>Patient: {patientInfo.fullName}</Text>
          <Text style={styles.actionSubtitle}>Select an action:</Text>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.photoButton]} 
            onPress={handleTakePhoto}
          >
            <Text style={styles.actionButtonText}>📷 Take Photograph</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.medicationButton]} 
            onPress={handleScanMedication}
          >
            <Text style={styles.actionButtonText}>💊 Scan Medication</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.backButton]} 
            onPress={resetScanner}
          >
            <Text style={styles.actionButtonText}>⬅️ Scan Another Patient</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Photo Capture Controls */}
      {mode === 'photo' && !capturedPhoto && !uploading && (
        <View style={styles.photoControlsContainer}>
          <Text style={styles.photoTitle}>Take photo for {patientInfo?.fullName}</Text>
          <View style={styles.photoButtons}>
            <TouchableOpacity 
              style={[styles.photoControlButton, styles.cancelPhotoButton]} 
              onPress={() => setMode('qr')}
            >
              <Text style={styles.buttonText}>❌ Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.photoControlButton, styles.captureButton]} 
              onPress={capturePhoto}
            >
              <Text style={styles.buttonText}>📸 Capture</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Uploading Indicator */}
      {uploading && (
        <View style={styles.uploadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.uploadingText}>Uploading photo...</Text>
        </View>
      )}
      
      {/* Medication Scanning Mode */}
      {mode === 'medication' && !uploading && (
        <View style={styles.medicationScanContainer}>
          <Text style={styles.medicationTitle}>Scan Medication Barcode</Text>
          <Text style={styles.medicationSubtitle}>Patient: {patientInfo?.fullName}</Text>
          <Text style={styles.medicationInstruction}>
            Point camera at medication barcode
          </Text>
          <Text style={styles.medicationFormats}>
            Supported: EAN-13, EAN-8, Code-128, Code-39, QR
          </Text>
          <TouchableOpacity 
            style={[styles.photoControlButton, styles.cancelPhotoButton]}
            onPress={() => setMode('qr')}
          >
            <Text style={styles.buttonText}>❌ Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {!scanned && !verifying && mode === 'qr' && (
        <View style={styles.instructionContainer}>
          <Text style={styles.instruction}>
            {mode === 'medication' 
              ? 'Point camera at medication barcode'
              : 'Point your camera at a patient QR code to scan and verify'}
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
  confirmationContainer: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    padding: 25,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  confirmTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00aa00',
    textAlign: 'center',
    marginBottom: 20,
  },
  patientCard: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  patientLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    fontWeight: '600',
  },
  patientValue: {
    fontSize: 18,
    color: '#000',
    marginTop: 5,
    fontWeight: 'bold',
  },
  confirmQuestion: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '600',
  },
  confirmButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  confirmButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#ff4444',
  },
  confirmButtonGreen: {
    backgroundColor: '#00aa00',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionContainer: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    padding: 25,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  actionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 5,
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  actionButton: {
    padding: 18,
    borderRadius: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  photoButton: {
    backgroundColor: '#2196F3',
  },
  medicationButton: {
    backgroundColor: '#4CAF50',
  },
  backButton: {
    backgroundColor: '#757575',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  photoControlsContainer: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: 25,
    borderRadius: 15,
  },
  photoTitle: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: 'bold',
  },
  photoButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  photoControlButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelPhotoButton: {
    backgroundColor: '#ff4444',
  },
  captureButton: {
    backgroundColor: '#2196F3',
  },
  uploadingContainer: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(33, 150, 243, 0.95)',
    padding: 30,
    borderRadius: 15,
    alignItems: 'center',
  },
  uploadingText: {
    fontSize: 18,
    marginTop: 15,
    color: '#fff',
    fontWeight: 'bold',
  },
  medicationScanContainer: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(76, 175, 80, 0.95)',
    padding: 25,
    borderRadius: 15,
    alignItems: 'center',
  },
  medicationTitle: {
    fontSize: 22,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  medicationSubtitle: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 15,
  },
  medicationInstruction: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  medicationFormats: {
    fontSize: 12,
    color: '#e0e0e0',
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
});
