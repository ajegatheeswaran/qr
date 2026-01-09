// API Configuration
// Automatically switches between environments

// ============ CONFIGURATION ============
// Change this to switch environments:
const ENVIRONMENT = 'local'; // Options: 'local', 'test', 'production'

// Your local development IP (update this when needed)
const LOCAL_IP = '10.230.52.37';

// ============ API URLs ============
const API_URLS = {
  // Local development (your computer via ngrok)
  local: 'https://jacques-azoic-tammy.ngrok-free.dev/api',
  
  // Test server
  test: 'https://172.187.170.17/api',
  
  // Production server
  production: 'https://nutissux.e-plaster.com/api'
};

// Export the selected environment's API URL
export const API_BASE_URL = API_URLS[ENVIRONMENT];

// For debugging - logs current configuration
console.log('🔧 QR Scanner Config:');
console.log('Environment:', ENVIRONMENT);
console.log('API URL:', API_BASE_URL);

// ============ HOW TO USE ============
// 1. Local Development: Set ENVIRONMENT = 'local'
//    - Phone must be on same WiFi as computer
//    - Update LOCAL_IP if your IP changes (run: ipconfig)
//
// 2. Test Server: Set ENVIRONMENT = 'test'
//    - Update the 'test' URL in API_URLS
//
// 3. Production: Set ENVIRONMENT = 'production'
//    - Uses live production server

