// ============================================
// FILE: src/types/api.types.ts
// ============================================
export interface User {
    employeeId: string;
    employeeName: string;
    baseEmployeeId: string | null;
    email: string;
    mobileNumber: string;
    photoPath: string | null;
    designation: string;
    designationId: number;
    department: string;
    isSuperAdmin: boolean;
    isAdmin: boolean;
    ulbCode: string | null;
    ulbGradeId: number | null;
    employeeDesignationId: string | null;
    ulbList: ULBEntity[];
    permissions: Permission[];
    modules: string[];
    hasWritePermission: boolean;
    token: string;
    hasAgreedTerms: boolean;
    labels: AppLabels;
    address: string | null;
    panNumber: string | null;
    aadharNumber: string | null;
    alertDays: number;
  }
  
  export interface ULBEntity {
    ulbCode: string;
    ulbName: string;
    ulbGradeId: number;
    designationId: number;
    designationName: string;
    employeeDesignationId: string;
    totalWorks: number;
  }
  
  export interface Permission {
    permission: string;
    canCreate: boolean;
    canRead: boolean;
    canUpdate: boolean;
    canDelete: boolean;
  }
  
  export interface AppLabels {
    adminSanctionLabel: string;
    adminSanctionAbbrevation: string;
    technicalSanctionLabel: string;
    technicalSanctionAbbrevation: string;
    wardLabel: string;
    workNameLabel: string;
    ulbLabel: string;
    departmentLabel: string;
  }
  
  export interface LoginRequest {
    employeeId: string;
    password: string;
    regId: string;
    deviceModel: string;
    deviceId: string;
    versionName: string;
    mobileIpAddress: string;
    mobileLastLocation: string;
  }
  
  export interface LoginResponse extends User {}
  
  export enum AuthStatus {
    SUCCESS = 200,
    FAILURE = 400,
    UNAUTHORISED = 401,
    SESSION_OPEN = 409,
    NO_WORKS = 404,
    ACCOUNT_LOCKED = 423,
  }
  