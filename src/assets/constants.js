import { backendURL } from "../AxiosClient";
import io from 'socket.io-client';

export const AUTH_ACCOUNT_LOCKED = -2;
export const AUTH_UNAUTHORISED = -1;
export const AUTH_FAILURE = 0;
export const AUTH_SUCCESS = 1;
export const AUTH_SESSION_OPEN = 2;
export const AUTH_USER_TRANSFERRED = 3;
export const AUTH_USER_DELETED = 4;
export const AUTH_USER_ACCESS_DENIED = 5;
export const AUTH_USER_NO_ROLES = 10;
export const isDevelopment = false; // This variable is true in development mode
export const omronsdkApiKey = '7C431FD1-7282-41D9-A062-100E16E5FD28';
export const partnerId = '57GI9BFj6Lb65WQ3qJXrd1hailer784o';
export const teamId = 'iblqCP8Jddu06ItUTFUjd1hailavif0k';
export const bundleId = 'com.lwc.reach';
export const isForMobile = false;
export const isForCamp = true;
// export const imageServerUrl = backendURL + 'projectsimages/';
// export const socketURI= 'https://socket.reachlife24.com';
// export const socketURI = 'https://camptestsocket.reachaimedtech.com/';
// export const socketURI ='https://meddybuddyprod.reachlife24.in';
// export const socketURI ='https://reachcampavishkar.reachlife24.in/';
// export const socketURI= 'https://reachaisocket.reachaimedtech.com/';
// export const socketURI ='http://http://192.168.0.35:8080:8081/socket-server/'; 
// export const socketURI ='https://sskact.reachaimedtech.in';
// export const socketURI ='https://anthargange.reachaimedtech.in';

// export const socketURI = 'https://reachcampgpic.reachaimedtech.in';

// export const socketURI = 'https://anthargange.reachaimedtech.in/';



// export const socketURI ='https://shravani.reachlife24.com';
// export const socketURI ='https://prodsocket.reachlife24.com/';
// export const socketURI ='https://medibuddy.reachlife24.com/';
// export const socketURI = 'https://campsocket.reachaimedtech.com/';
export const socketURI ='http://192.168.0.118:8000/';
// export const socketURI = 'http://10.226.54.246:8000/';

export const iceServers = {
  iceServers: [
    // { urls: 'stun:52.140.52.186:3478' },
    { urls: 'stun:45.114.246.115:3478' },
    {
      // urls: 'turn:52.140.52.186:3478',
      urls: 'turn:45.114.246.115:3478',
      username: 'deal',
      credential: 'deal@niw',
    },
    {
      // urls: 'turn:52.140.52.186:5349?transport=tcp',
      urls: 'turn:45.114.246.115:5349?transport=tcp',
      username: 'deal',
      credential: 'deal@niw',
    },
  ],
};

export const EMPLOYEE_EXCEL_HEADERS = {
  sNo: 'S.No',
  employeeId: 'Employee Id',
  designation: 'Designation',
  department: 'Department',
  fullName: 'Full Name',
  dateOfBirth: 'Date Of Birth',
  gender: 'Gender',
  nationality: 'Nationality',
  mobileNumber: 'Mobile Number',
  email: 'Email',
  address: 'Address',
};

export const SYNC_STATUS = {
  PENDING: 'PENDING',
  SUCCESS: 'SYNC',
  FAILED: 'TRANSFERED',
  RETRYING: 'RETRYING',
  SYNC_FAILED: "SYNC FAILED"
}

export const DEVICE_ROLE = {
  KIOSK: "kiosk",
  CENTRAL_DEVICE: "central_device"

}
export const CONNECTION_STATUS = {
  CONNECTED: 'connected',
  HANDSHAKING: 'handshaking',
  DISCONNECTED: 'disconnected',
  SERVER_STOPPED: 'server_stopped',
  CONNECTING: "connecting"
};

export const ACKNOWLEDGEMENTS = {
  CLIENT_EXCEL_UNIQUE_ID: "CLIENT_EXCEL_UNIQUE_ID",
  SERVER_LAST_EXCEL_UNQIUE_ID: "SERVER_LAST_EXCEL_UNQIUE_ID"
}
export const VITAL_ACTIONS = {
  VITALS_DELETED: "Vital Delete",
  EYE_PDF_DELETED: "Eye Pdf Delete",
  SPYRO_PDF_DELETED: "Spyro Pdf Delete",
  ECG_PDF_DELETED: "ECG Pdf Delete",
  VITALS_CREATED: "Vitals Added"

}
export const VITAL_ACTION_TOAST_MESSAGES = {
  [VITAL_ACTIONS.VITALS_DELETED]:
    'Vitals data has been removed from this device by the central system',

  [VITAL_ACTIONS.EYE_PDF_DELETED]:
    'Eye report PDF has been removed from this device by the central system',

  [VITAL_ACTIONS.SPYRO_PDF_DELETED]:
    'Spirometry report PDF has been removed from this device by the central system',
};










