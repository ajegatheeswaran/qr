# Patient QR Code Scanner

A secure React Native Expo app for scanning and verifying patient QR codes with JWT authentication.

## Features

- 📱 QR Code scanning with camera
- 🔐 JWT token verification with backend
- ✅ Real-time patient data validation
- ⏰ 30-minute token expiry detection
- 🚫 Tamper-proof verification

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API URL:**
   - Open `config.js`
   - Update `API_BASE_URL` to your backend server:
     - For local development: `http://localhost:9000/api`
     - For testing on physical device: `http://YOUR_COMPUTER_IP:9000/api`
     - For production: `https://your-api.com/api`

3. **Run the app:**
   ```bash
   # Start Expo
   npm start

   # Or run directly on Android
   npm run android

   # Or run on iOS
   npm run ios
   ```

## How It Works

1. **Web App** generates a signed JWT token with patient data (30 min expiry)
2. **QR Code** displays the JWT token
3. **Phone App** scans the QR code
4. **Backend** verifies the JWT signature and expiry
5. **Phone App** displays patient information if valid

## Security

- ✅ JWT signed with secret key (server-side)
- ✅ Tokens expire after 30 minutes
- ✅ Backend verification prevents tampering
- ✅ No authentication required for QR verification endpoint

## API Endpoint

**POST** `/api/patient/verifyQRToken`

**Request:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "QR code verified successfully",
  "data": {
    "patientId": "123",
    "patientData": {
      "fullName": "John Doe",
      "dob": "01-01-1990",
      "gender": "Male"
    },
    "generatedAt": "2026-01-04T10:00:00.000Z",
    "expiresAt": "2026-01-04T10:30:00.000Z"
  }
}
```

**Response (Expired):**
```json
{
  "success": false,
  "message": "QR code has expired",
  "errorCode": "TOKEN_EXPIRED"
}
```

**Response (Invalid):**
```json
{
  "success": false,
  "message": "Invalid QR code",
  "errorCode": "INVALID_TOKEN"
}
```


A simple QR code scanner built with Expo and React Native.

## Features

- Real-time QR code scanning using device camera
- Camera permission handling
- Visual scan area indicator
- Displays scanned QR code data
- Support for QR codes and PDF417 barcodes

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npx expo start
```

3. Run on your device:
   - Scan the QR code with the Expo Go app (Android/iOS)
   - Or press `a` for Android emulator
   - Or press `i` for iOS simulator

## Usage

1. Launch the app
2. Grant camera permissions when prompted
3. Point your camera at a QR code
4. The app will automatically scan and display the data
5. Tap "Tap to Scan Again" to scan another code

## Requirements

- Node.js
- npm or yarn
- Expo Go app (for testing on physical device)
- Android Studio or Xcode (for emulator/simulator)

## Permissions

The app requires camera access to scan QR codes. Make sure to grant camera permissions when prompted.
