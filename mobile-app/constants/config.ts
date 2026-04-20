
export const SUPABASE_URL = 'https://rpcyfnfdtmwffzinvdpp.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwY3lmbmZkdG13ZmZ6aW52ZHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNjk0ODcsImV4cCI6MjA3OTg0NTQ4N30.uIwVZmJU6Yymw3_cvTIIf7kXKQtxMSbF3q2O-asd6kw';

export const Timeouts = {

  AUTH_CHECK: 5000,

  /** Login request timeout */
  LOGIN: 30000,

  /** Fallback redirect delay after login */
  REDIRECT_FALLBACK: 3000,

  /** Connection check timeout */
  CONNECTION_CHECK: 5000,

  /** Session sync delay after timeout */
  SESSION_SYNC: 2000,
};

// Medication Configuration
export const MedicationConfig = {
  /** Time threshold (ms) after which a missed med is marked as 'not taken' */
  MISSED_THRESHOLD: 60 * 60 * 1000, // 1 hour

  /** Early warning notification delay (ms) */
  WARNING_DELAY: 30 * 60 * 1000, // 30 minutes

  /** Auto-submit notification delay (ms) */
  AUTO_SUBMIT_DELAY: 45 * 60 * 1000, // 45 minutes

  /** Number of days to schedule notifications in advance */
  NOTIFICATION_DAYS_AHEAD: 3,
};

// Vitals Measurement Configuration
export const VitalsConfig = {
  /** 
   * Django backend API URL - UPDATE THIS with your server IP!
   * Find your IP by running 'ipconfig' and looking for IPv4 Address
   * Example: 'http://192.168.1.100:8000'
   */
  API_BASE_URL: 'http://192.168.100.17:8000',

  /** Measurement duration in seconds */
  MEASUREMENT_DURATION: 30,

  /** API endpoint for PPG video processing */
  PPG_ENDPOINT: '/api/ppg/fingertip',

  /** Request timeout in milliseconds */
  REQUEST_TIMEOUT: 60000,
};

// Emergency Dispatch Configuration
export const EmergencyConfig = {
  /** 
   * n8n webhook URL for emergency dispatch
   * UPDATE THIS with your n8n instance URL!
   * Find by: n8n dashboard → your workflow → Webhook node → Production URL
   */
  N8N_WEBHOOK_URL: 'http://192.168.100.17:5678/webhook/fall-emergency',

  /** Timeout for GPS location fetch (ms) */
  LOCATION_TIMEOUT: 10000,
};
