import { User } from '../types';

const API_BASE = '/api/auth';
const DIRECT_API_FALLBACK = 'http://127.0.0.1:8000/api/auth';

/**
 * Helper to fetch with fallback between relative path and direct port 8000
 */
async function apiFetch(endpoint: string, options?: RequestInit): Promise<Response> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, options);
    // If not a 404 or 502/503 from missing proxy, return it
    if (res.status !== 404) {
      return res;
    }
    // Fallback to direct backend
    return await fetch(`${DIRECT_API_FALLBACK}${endpoint}`, options);
  } catch {
    // If fetch failed completely (e.g. network/proxy error), try direct backend
    return await fetch(`${DIRECT_API_FALLBACK}${endpoint}`, options);
  }
}

export interface RegisterAdminData {
  name: string;
  employeeId: string;
  email: string;
  phone?: string;
  department?: string;
  password?: string;
  securityPasskey: string;
}

export interface RegisterManagerData {
  name: string;
  employeeId: string;
  email: string;
  phone?: string;
  department?: string;
  title?: string;
  password?: string;
}

export interface RegisterEmployeeData {
  name: string;
  employeeId: string;
  email: string;
  phone?: string;
  department?: string;
  managerId?: string;
  managerName?: string;
  password?: string;
  faceRegistered?: boolean;
  faceVector?: string;
  avatarUrl?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user: User;
}

export const authApi = {
  /**
   * Log in user using email or Employee ID and optional password
   */
  login: async (identifier: string, password?: string, role?: string): Promise<AuthResponse> => {
    const res = await apiFetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password, role }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Login failed. Please check credentials.');
    }
    return data;
  },

  /**
   * Register a new Administrator in MongoDB Atlas
   */
  registerAdmin: async (data: RegisterAdminData): Promise<AuthResponse> => {
    const res = await apiFetch('/register/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const resData = await res.json();
    if (!res.ok) {
      throw new Error(resData.detail || resData.message || 'Administrator registration failed.');
    }
    return resData;
  },

  /**
   * Register a new Manager in MongoDB Atlas
   */
  registerManager: async (data: RegisterManagerData): Promise<AuthResponse> => {
    const res = await apiFetch('/register/manager', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const resData = await res.json();
    if (!res.ok) {
      throw new Error(resData.detail || resData.message || 'Manager registration failed.');
    }
    return resData;
  },

  /**
   * Register a new Employee in MongoDB Atlas
   */
  registerEmployee: async (data: RegisterEmployeeData): Promise<AuthResponse> => {
    const res = await apiFetch('/register/employee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const resData = await res.json();
    if (!res.ok) {
      throw new Error(resData.detail || resData.message || 'Employee registration failed.');
    }
    return resData;
  },

  /**
   * Request OTP code for forgot password
   */
  requestForgotPasswordOtp: async (identifier: string): Promise<{ success: boolean; message: string; code: string; email: string }> => {
    const res = await apiFetch('/forgot-password/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Failed to request reset OTP.');
    }
    return data;
  },

  /**
   * Verify reset OTP code
   */
  verifyResetCode: async (identifier: string, code: string): Promise<{ success: boolean; message: string }> => {
    const res = await apiFetch('/forgot-password/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, code }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Invalid or expired OTP code.');
    }
    return data;
  },

  /**
   * Complete password reset in MongoDB Atlas
   */
  resetPassword: async (identifier: string, code: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    const res = await apiFetch('/forgot-password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, code, newPassword }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Failed to update password.');
    }
    return data;
  },

  /**
   * Get all live users from MongoDB Atlas
   */
  getAllUsers: async (): Promise<User[]> => {
    const res = await apiFetch('/users');
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to fetch users from MongoDB Atlas');
    }
    return data.users || [];
  },

  /**
   * Get all department managers from MongoDB Atlas
   */
  getManagers: async (): Promise<User[]> => {
    const res = await apiFetch('/managers');
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to fetch managers from MongoDB Atlas');
    }
    return data.managers || [];
  },

  /**
   * Update User Profile details in MongoDB Atlas
   */
  updateProfile: async (payload: {
    employeeId: string;
    phone?: string;
    avatarUrl?: string;
    department?: string;
    name?: string;
  }): Promise<{ success: boolean; message: string; user: User }> => {
    const res = await apiFetch('/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Failed to update user profile in MongoDB Atlas');
    }
    return data;
  },
};
