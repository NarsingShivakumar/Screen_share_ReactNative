import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const backendURL = 'http://192.168.0.151:8200/reach/';//Ahki? 
//  export const backendURL = 'https://reachaimedtech.com/reach_ai_newbe/';//new? 

//  export const backendURL = 'https://reachaimedtech.com/reach_campbe/';  
  // export const backendURL = 'https://reachaimedtech.in/reach_camp_gpicbe/';  

  // export const backendURL = 'https://reachaimedtech.in/reach_camp_sskactbe/'; 
    // export const backendURL = 'https://reachaimedtech.in/reach_camp_anthargangebe/'; 

//  export const backendURL ='https://reachlife24.in/reach_camp_sskactbe/';
//  export const backendURL = 'https://reachaimedtech.com/reach_camp_anthargangebe/';

//  export const backendURL = 'https://reachaimedtech.com/reach_camptestbe/';
//  export const backendURL = 'http://192.168.0.94:8200/reach/';//Ahki
//  export const backendURL = 'http://192.168.0.136:8200/reach/';//Prudvi
//  export const backendURL = 'http://192.168.0.57:8200/reach/';//naredra
//  export const backendURL = 'http://192.168.0.197:8200/reach/';//sai
//  export const backendURL ='https://reachlife24.com/reach_medibuddybe/';
//  export const backendURL ='https://reachlife24.in/medibuddybe/';
//  export const backendURL ='https://reachlife24.com/reachbe/';
// export const backendURL ='https://reachlife24.com/reach_demobe/';
// export const backendURL ='https://reachlife24.com/reach_sravanibe/';
// export const backendURL ='https://reachaimedtech.com/reach_testbe/';





const apiService = axios.create({
  baseURL: backendURL,
  // baseURL :'https://reachlife24.com/reach_testbe/mobile/',
  //  baseURL : 'http://192.168.0.98:8200/reach/mobile/',

  headers: {
    'Content-Type': 'application/json',
  },

});
// Use an interceptor to modify headers before each request
apiService.interceptors.request.use(
  async (config) => {
    // Add your other request interceptor logic here
    const isLoggedIn = await AsyncStorage.getItem('isLoggedIn');
    if (isLoggedIn == 1) {
      const loginInfoo = await AsyncStorage.getItem('loginInfo');
      const loginInfo = JSON.parse(loginInfoo);
      const kioskId = await AsyncStorage.getItem('kioskId');

      if (loginInfo && loginInfo != null) {
        // Add headers from loginInfo
        const ulbList = loginInfo.ulbList[0]
        if (ulbList) {
        //  Add headers from loginInfo
          config.headers['employeeDesignationId'] = ulbList.employeeDesignationId;
          config.headers['employeeId'] = ulbList.employeeId;
          config.headers['adminId'] = ulbList.adminId;
          config.headers['designationId'] = String(ulbList.designationId);
          config.headers['kioskId'] = kioskId;
        }
     }

   }
    return config;
  },
  (error) => {
    // Do something with request error
    return Promise.reject(error);
  }
);

// Add a response interceptor
apiService.interceptors.response.use(
  function (response) {
    if (response) return response;
    else {
      var message = 'We had trouble connecting to the server';
      if (response.data.message) message = response.data.message;
      return Promise.reject(response);
    }
  },
  function (error) {
    return Promise.reject(error);
  },

);

export default apiService;
