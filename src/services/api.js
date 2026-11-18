/**
 * RED MISSION API Client Service
 * Connects Frontend seamlessly with the Backend REST API.
 */

const API_BASE = '/api';

export function getUserToken() {
  return localStorage.getItem('red_mission_user_token');
}

export function setUserToken(token) {
  if (token) {
    localStorage.setItem('red_mission_user_token', token);
  } else {
    localStorage.removeItem('red_mission_user_token');
  }
}

export function getAdminToken() {
  return localStorage.getItem('red_mission_admin_token');
}

export function setAdminToken(token) {
  if (token) {
    localStorage.setItem('red_mission_admin_token', token);
  } else {
    localStorage.removeItem('red_mission_admin_token');
  }
}

async function request(endpoint, options = {}, tokenType = 'user') {
  const isFormDataBody = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    ...(isFormDataBody ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {})
  };

  const token = tokenType === 'admin' ? getAdminToken() : getUserToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // When tokenType is 'admin', omit browser cookies by default so that simultaneous user session cookies
  // do not shadow the Admin Bearer token on routes using authenticateAny
  const fetchOptions = {
    ...options,
    headers,
    ...(tokenType === 'admin' && options.credentials === undefined ? { credentials: 'omit' } : {})
  };

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, fetchOptions);

    const data = await res.json().catch(() => ({}));
    
    // Automatically clear invalidated/expired token on 401 responses
    if (res.status === 401) {
      if (tokenType === 'admin') {
        setAdminToken(null);
      } else {
        setUserToken(null);
      }
    }

    if (!res.ok) {
      let errorMessage = data.error || data.message;
      if (!errorMessage) {
        if (res.status === 504 || res.status === 502 || res.status === 503) {
          errorMessage = 'Backend API server (Port 5000) is unreachable. Please ensure the backend server is running.';
        } else if (res.status === 500) {
          errorMessage = 'Backend connection error (HTTP 500). Please ensure the backend server is running on port 5000.';
        } else if (res.status === 404) {
          errorMessage = `API endpoint not found: ${endpoint} (HTTP 404).`;
        } else {
          errorMessage = `Request failed with HTTP status ${res.status}.`;
        }
      }
      return {
        ok: false,
        status: res.status,
        success: false,
        error: errorMessage,
        ...data
      };
    }

    return {
      ok: res.ok,
      status: res.status,
      success: data.success !== false,
      ...data
    };
  } catch (err) {
    console.error(`[API ERROR] ${endpoint}:`, err);
    return {
      ok: false,
      status: 0,
      success: false,
      error: 'Network connection error. Please ensure the backend server is running.'
    };
  }
}

// ==========================================
// AUTHENTICATION CONFIGURATION API
// ==========================================
export const authApi = {
  getConfig: () => request('/auth/config', { method: 'GET' })
};

// ==========================================
// USER AUTHENTICATION API
// ==========================================
export const userApi = {
  // Direct Registration (when OTP is disabled)
  registerDirect: (data) =>
    request('/user/register/direct', {
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data)
    }),

  // Multi-step Registration (preserved for full OTP restoration)
  registerStep1: (data) => 
    request('/user/register/step1', {
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data)
    }),

  registerVerifyMobile: (registrationToken, otp) => 
    request('/user/register/verify-mobile', { method: 'POST', body: JSON.stringify({ registrationToken, otp }) }),

  registerVerifyEmail: (registrationToken, otp) => 
    request('/user/register/verify-email', { method: 'POST', body: JSON.stringify({ registrationToken, otp }) }),

  registerComplete: (registrationToken, password, confirmPassword) => 
    request('/user/register/complete', { method: 'POST', body: JSON.stringify({ registrationToken, password, confirmPassword }) }),

  registerResendOtp: (registrationToken, type) => 
    request('/user/register/resend-otp', { method: 'POST', body: JSON.stringify({ registrationToken, type }) }),

  // Login & Session
  login: async (identifier, password, rememberMe = false) => {
    const res = await request('/user/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, rememberMe })
    });
    if (res.success && res.token) {
      setUserToken(res.token);
    }
    return res;
  },

  getProfile: () => request('/user/me', { method: 'GET' }),

  updateProfile: (data) =>
    request('/user/profile', {
      method: 'PUT',
      body: data instanceof FormData ? data : JSON.stringify(data)
    }),

  logout: async () => {
    const res = await request('/user/logout', { method: 'POST' });
    setUserToken(null);
    return res;
  },

  // Password Recovery
  forgotPasswordRequest: (identifier, channel = 'EMAIL') => 
    request('/user/forgot-password/request', { method: 'POST', body: JSON.stringify({ identifier, channel }) }),

  forgotPasswordReset: (data) => 
    request('/user/forgot-password/reset', { method: 'POST', body: JSON.stringify(data) }),

  // Security & Account
  getSecurityActivity: () => 
    request('/user/security/activity', { method: 'GET' }),

  logoutOtherSessions: () => 
    request('/user/security/logout-all', { method: 'POST' }),

  deleteAccount: async (password, reason) => {
    const res = await request('/user/delete-account', {
      method: 'POST',
      body: JSON.stringify({ password, reason })
    });
    if (res.success) {
      setUserToken(null);
    }
    return res;
  }
};

// ==========================================
// DONOR PROFILE & SELFIE API
// ==========================================
export const donorApi = {
  getProfile: () => request('/donor/profile', { method: 'GET' }),
  register: (donorData) => request('/donor/register', {
    method: 'POST',
    body: donorData instanceof FormData ? donorData : JSON.stringify(donorData)
  }),
  updatePhoto: (selfieImage) => request('/donor/photo', {
    method: 'PUT',
    body: selfieImage instanceof FormData ? selfieImage : JSON.stringify({ selfieImage })
  }),
  deletePhoto: () => request('/donor/photo', { method: 'DELETE' }),
  updatePrivacy: (isPhotoPublic) => request('/donor/privacy', { method: 'PATCH', body: JSON.stringify({ isPhotoPublic }) }),
  updateDirectoryConsent: (consent) => request('/donor/directory-consent', { method: 'PATCH', body: JSON.stringify({ consent }) }),
  getPhotoUrl: (identifier) => `/api/donor/photo/${identifier}`,
  search: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.bloodGroup && params.bloodGroup !== 'All' && params.bloodGroup !== 'ALL') {
      qs.append('bloodGroup', params.bloodGroup);
    }
    if (params.city && params.city !== 'All' && params.city !== 'ALL') {
      qs.append('city', params.city);
    }
    if (params.search) {
      qs.append('search', params.search);
    }
    if (params.availableOnly) {
      qs.append('availableOnly', 'true');
    }
    if (params.page) {
      qs.append('page', params.page);
    }
    if (params.limit) {
      qs.append('limit', params.limit);
    }
    const query = qs.toString();
    return request(query ? `/donors?${query}` : '/donors', { method: 'GET' });
  },
  getAdminDonors: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.bloodGroup && params.bloodGroup !== 'All' && params.bloodGroup !== 'ALL') {
      qs.append('bloodGroup', params.bloodGroup);
    }
    if (params.city && params.city !== 'All' && params.city !== 'ALL') {
      qs.append('city', params.city);
    }
    if (params.search) {
      qs.append('search', params.search);
    }
    if (params.availableOnly) {
      qs.append('availableOnly', 'true');
    }
    const query = qs.toString();
    return request(query ? `/admin/donors?${query}` : '/admin/donors', { method: 'GET' }, 'admin');
  }
};

// ==========================================
// ADMIN AUTHENTICATION & MANAGEMENT API
// ==========================================
export const adminApi = {
  // Step 1: Identifier + Password check (handles direct login when OTP is disabled or triggers Step 2 Dual 2FA)
  loginStep1: async (identifier, password) => {
    const res = await request('/admin/login/step1', { method: 'POST', body: JSON.stringify({ identifier, password }) }, 'admin');
    if (res.success && res.token && res.directAuth) {
      setAdminToken(res.token);
    }
    return res;
  },

  // Step 2: Dual OTP verification (Mobile + Email)
  loginVerifyOtps: async (preAuthToken, mobileOtp, emailOtp) => {
    const res = await request('/admin/login/verify-otps', {
      method: 'POST',
      body: JSON.stringify({ preAuthToken, mobileOtp, emailOtp })
    }, 'admin');
    if (res.success && res.token) {
      setAdminToken(res.token);
    }
    return res;
  },

  getProfile: () => request('/admin/me', { method: 'GET' }, 'admin'),

  logout: async () => {
    const res = await request('/admin/logout', { method: 'POST' }, 'admin');
    setAdminToken(null);
    return res;
  },

  changePassword: (currentPassword, newPassword, confirmPassword) => 
    request('/admin/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
    }, 'admin'),

  forgotPasswordRequest: (identifier, channel = 'EMAIL') => 
    request('/admin/forgot-password/request', { method: 'POST', body: JSON.stringify({ identifier, channel }) }, 'admin'),

  forgotPasswordReset: (data) => 
    request('/admin/forgot-password/reset', { method: 'POST', body: JSON.stringify(data) }, 'admin'),

  // Super Admin Management & Governance
  getTeam: () => request('/admin/team', { method: 'GET' }, 'admin'),

  createAccount: (data) => 
    request('/admin/create-account', { method: 'POST', body: JSON.stringify(data) }, 'admin'),

  sendInvitation: (email, roleId) => 
    request('/admin/invite', { method: 'POST', body: JSON.stringify({ email, roleId }) }, 'admin'),

  acceptInvitation: (data) => 
    request('/admin/accept-invite', { method: 'POST', body: JSON.stringify(data) }),

  getAuditLogs: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    const qs = query.toString();
    return request(`/admin/audit-logs${qs ? `?${qs}` : ''}`, { method: 'GET' }, 'admin');
  },

  getStats: () => request('/admin/stats', { method: 'GET' }, 'admin'),

  getAdminSessions: () => request('/admin/governance/sessions', { method: 'GET' }, 'admin'),

  revokeAdminSession: (sessionId) => 
    request(`/admin/governance/sessions/${sessionId}/revoke`, { method: 'POST' }, 'admin')
};

// ==========================================
// EMERGENCY BLOOD REQUESTS API
// ==========================================
export const requestApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    const qs = query.toString();
    return request(`/requests${qs ? `?${qs}` : ''}`, { method: 'GET' });
  },
  getById: (id) => request(`/requests/${id}`, { method: 'GET' }),
  getMyRequests: () => request('/user/my-requests', { method: 'GET' }),
  cancelUserRequest: (id) => request(`/user/my-requests/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
  create: (data) => request('/requests', { method: 'POST', body: JSON.stringify(data) }, 'admin'),
  createUserRequest: (data) => request('/user/requests', { method: 'POST', body: JSON.stringify(data) }),
  approveRequest: (id) => request(`/requests/${encodeURIComponent(id)}/approve`, { method: 'POST' }, 'admin'),
  rejectRequest: (id, reason) => request(`/requests/${encodeURIComponent(id)}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }, 'admin'),
  updateStatus: (id, status) => request(`/requests/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }, 'admin'),
  getMatchingDonors: (requestId, params = {}, tokenType) => {
    const qs = new URLSearchParams();
    if (params.city && params.city !== 'All' && params.city !== 'ALL') qs.append('city', params.city);
    if (params.eligibleOnly) qs.append('eligibleOnly', 'true');
    const query = qs.toString();
    const type = tokenType || (getAdminToken() ? 'admin' : 'user');
    return request(
      query ? `/requests/${encodeURIComponent(requestId)}/matching-donors?${query}` : `/requests/${encodeURIComponent(requestId)}/matching-donors`,
      { method: 'GET' },
      type
    );
  },
  selectDonor: (requestId, payload, tokenType) => {
    const type = tokenType || (getAdminToken() ? 'admin' : 'user');
    return request(
      `/requests/${encodeURIComponent(requestId)}/select-donor`,
      { method: 'POST', body: JSON.stringify(payload) },
      type
    );
  }
};

// ==========================================
// PLEDGE MANAGEMENT API
// ==========================================
export const pledgeApi = {
  create: (requestId) => request(`/requests/${requestId}/pledge`, { method: 'POST' }),
  cancel: (pledgeId, reason) => request(`/pledges/${pledgeId}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  getMyPledges: () => request('/donor/pledges', { method: 'GET' })
};

// ==========================================
// DONATION PROOFS API
// ==========================================
export const proofApi = {
  upload: (pledgeId, proofPhoto) => request(`/pledges/${pledgeId}/proof`, { method: 'POST', body: JSON.stringify({ proofPhoto }) }),
  getPhotoUrl: (proofId) => `/api/proofs/${proofId}/photo`,
  fetchPhotoBlobUrl: async (proofId, { tokenType = 'admin', signal } = {}) => {
    const token = tokenType === 'admin' ? getAdminToken() : getUserToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    // Omit browser cookies for admin requests so simultaneous user session cookies do not shadow Admin Bearer token
    const res = await fetch(`${API_BASE}/proofs/${encodeURIComponent(proofId)}/photo`, {
      method: 'GET',
      headers,
      credentials: tokenType === 'admin' ? 'omit' : 'same-origin',
      signal
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Failed to load proof image (HTTP ${res.status})`);
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
  getAdminProofs: (status = 'PENDING') => request(`/admin/proofs?status=${status}`, { method: 'GET' }, 'admin'),
  reviewProof: (proofId, action, rejectionReason) => 
    request(`/admin/proofs/${proofId}/review`, { method: 'POST', body: JSON.stringify({ action, rejectionReason }) }, 'admin')
};

// ==========================================
// CLINICAL CERTIFICATES API
// ==========================================
function resolveCertificateTokenType(explicitType) {
  if (explicitType === 'admin' || explicitType === 'user') {
    return explicitType;
  }
  const hasAdmin = Boolean(getAdminToken());
  const hasUser = Boolean(getUserToken());
  if (typeof window !== 'undefined' && window.location?.hash) {
    const hash = window.location.hash;
    if ((hash.startsWith('#superadmin-dashboard') || hash.startsWith('#admin-dashboard')) && hasAdmin) {
      return 'admin';
    }
    if (hash.startsWith('#user-dashboard') && hasUser) {
      return 'user';
    }
  }
  return hasAdmin && !hasUser ? 'admin' : 'user';
}

export const certificateApi = {
  getCertificate: (pledgeId, tokenType) => {
    const type = resolveCertificateTokenType(tokenType);
    return request(`/certificates/${pledgeId}`, { method: 'GET' }, type);
  },
  fetchDonorPhotoBlob: async (pledgeId, { donorPhotoUrl, tokenType, signal } = {}) => {
    const primaryType = resolveCertificateTokenType(tokenType);
    const targetUrl = donorPhotoUrl || `${API_BASE}/certificates/${encodeURIComponent(pledgeId)}/donor-photo`;

    const fetchWithRole = async (authType) => {
      const token = authType === 'admin' ? getAdminToken() : getUserToken();
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      return fetch(targetUrl, {
        method: 'GET',
        headers,
        credentials: authType === 'admin' ? 'omit' : 'same-origin',
        signal
      });
    };

    let res = await fetchWithRole(primaryType);
    if (!tokenType && (res.status === 401 || res.status === 403)) {
      const altType = primaryType === 'admin' ? 'user' : 'admin';
      const hasAltToken = Boolean(altType === 'admin' ? getAdminToken() : getUserToken());
      if (hasAltToken) {
        res = await fetchWithRole(altType);
      }
    }

    if (!res.ok) {
      return null;
    }
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('image/')) {
      return null;
    }
    const blob = await res.blob();
    return blob && blob.size > 0 ? blob : null;
  },
  getAllAdmin: () => request('/admin/certificates', { method: 'GET' }, 'admin'),
  verifyCertificate: (token) => request(`/certificates/verify/${token}`, { method: 'GET' })
};

// ==========================================
// MONTHLY ACTIVITY REPORTS API (ADMIN / SUPER ADMIN)
// ==========================================
async function downloadReportArtifact({ format, month, year, reportId, maskSensitive = true }) {
  const token = getAdminToken();
  const isPdf = format === 'pdf';
  const query = new URLSearchParams();
  if (reportId) query.set('reportId', reportId);
  if (month) query.set('month', month);
  if (year) query.set('year', year);
  query.set('maskSensitive', maskSensitive === false ? 'false' : 'true');

  const res = await fetch(`${API_BASE}/admin/reports/monthly/${isPdf ? 'pdf' : 'excel'}?${query.toString()}`, {
    method: 'GET',
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    credentials: 'omit'
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.error || `Download failed with HTTP ${res.status}`);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition');
  const ext = isPdf ? 'pdf' : 'xlsx';
  let filename = `RED_MISSION_Monthly_Report_${year || 'report'}_${month || ''}_${maskSensitive === false ? 'unmasked' : 'masked'}.${ext}`;
  if (disposition && disposition.includes('filename=')) {
    filename = disposition.split('filename=')[1].replace(/["']/g, '').trim();
  }

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export const reportApi = {
  getMonthlyReport: (month, year, maskSensitive = true) => 
    request(`/admin/reports/monthly?month=${month}&year=${year}&maskSensitive=${maskSensitive === false ? 'false' : 'true'}`, { method: 'GET' }, 'admin'),

  generateMonthlyReport: (month, year, maskSensitive = true) => 
    request('/admin/reports/monthly/generate', { 
      method: 'POST', 
      body: JSON.stringify({ month, year, maskSensitive: maskSensitive !== false }) 
    }, 'admin'),

  getReportHistory: () => 
    request('/admin/reports/history', { method: 'GET' }, 'admin'),

  downloadPdf: (month, year, reportId, maskSensitive = true) =>
    downloadReportArtifact({ format: 'pdf', month, year, reportId, maskSensitive }),

  downloadExcel: (month, year, reportId, maskSensitive = true) =>
    downloadReportArtifact({ format: 'excel', month, year, reportId, maskSensitive })
};

// ==========================================
// ROTARACT COLLEGE MEMBERS DIRECTORY API
// ==========================================
export const rotaractApi = {
  getPublicMembers: ({ search = '', designation = '' } = {}) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (designation && designation !== 'all') params.set('designation', designation);
    const qs = params.toString();
    return request(`/rotaract/members${qs ? `?${qs}` : ''}`, { method: 'GET' });
  },

  getAdminMembers: () => request('/admin/rotaract/members', { method: 'GET' }, 'admin'),

  createMember: (payload) =>
    request('/admin/rotaract/members', { method: 'POST', body: payload instanceof FormData ? payload : JSON.stringify(payload) }, 'admin'),

  updateMember: (id, payload) =>
    request(`/admin/rotaract/members/${encodeURIComponent(id)}`, { method: 'PUT', body: payload instanceof FormData ? payload : JSON.stringify(payload) }, 'admin'),

  reorderMembers: (orderedIds) =>
    request('/admin/rotaract/members/reorder', { method: 'PATCH', body: JSON.stringify({ orderedIds }) }, 'admin'),

  deleteMember: (id) =>
    request(`/admin/rotaract/members/${encodeURIComponent(id)}`, { method: 'DELETE' }, 'admin'),

  async fetchAdminPhotoBlobUrl(memberId, { signal } = {}) {
    const token = getAdminToken();
    const res = await fetch(`${API_BASE}/admin/rotaract/members/${encodeURIComponent(memberId)}/photo?t=${Date.now()}`, {
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      credentials: 'omit',
      signal
    });
    if (!res.ok) {
      throw new Error(`Unable to preview photo (HTTP ${res.status})`);
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }
};

// ==========================================
// SUPER ADMIN DONOR DIRECTORY & PROFILE API
// ==========================================
export const superAdminDonorApi = {
  getDonors: (params = {}) => {
    const query = new URLSearchParams();
    if (params.bloodGroup && params.bloodGroup !== 'ALL') query.set('bloodGroup', params.bloodGroup);
    if (params.availability && params.availability !== 'ALL') query.set('availability', params.availability);
    if (params.search) query.set('search', params.search);
    if (params.city) query.set('city', params.city);
    const qs = query.toString();
    return request(`/superadmin/donors${qs ? `?${qs}` : ''}`, { method: 'GET' }, 'admin');
  },

  getDonorDetail: (userId) =>
    request(`/superadmin/donors/${encodeURIComponent(userId)}`, { method: 'GET' }, 'admin'),

  async fetchDonorPhotoBlobUrl(userId, { signal } = {}) {
    const token = getAdminToken();
    const res = await fetch(`${API_BASE}/superadmin/donors/${encodeURIComponent(userId)}/photo?t=${Date.now()}`, {
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      credentials: 'omit',
      signal
    });
    if (!res.ok) {
      throw new Error(`Unable to load donor photograph (HTTP ${res.status})`);
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }
};

// ==========================================
// PUBLIC SITE CONFIGURATION API
// ==========================================
export const siteConfigApi = {
  getLaunchConfig: ({ signal } = {}) =>
    request('/site/launch-config', {
      method: 'GET',
      cache: 'no-store',
      ...(signal ? { signal } : {})
    })
};

// ==========================================
// REAL-TIME BACKEND AI ASSISTANT API
// ==========================================
export const aiApi = {
  getStatus: ({ signal } = {}) =>
    request('/ai/status', {
      method: 'GET',
      cache: 'no-store',
      ...(signal ? { signal } : {})
    }),

  /**
   * Streams assistant chunks via backend SSE (/api/ai/chat?stream=true).
   * Credentials/API keys never touch the browser.
   */
  async streamChat({ messages, onChunk, signal } = {}) {
    const token = getUserToken();
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    let res;
    try {
      res = await fetch(`${API_BASE}/ai/chat?stream=true`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages, stream: true }),
        signal,
      });
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      throw new Error('Unable to connect to the RED MISSION AI server. Please check that the backend is running.');
    }

    const contentType = String(res.headers.get('content-type') || '').toLowerCase();

    if (!res.ok || !contentType.includes('text/event-stream')) {
      const errData = await res.json().catch(() => ({}));
      const error = new Error(errData?.error || `AI request failed (HTTP ${res.status})`);
      error.code = errData?.code || 'AI_REQUEST_FAILED';
      error.status = res.status;
      throw error;
    }

    if (!res.body) {
      throw new Error('Streaming response body unavailable from server.');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let finalMeta = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sepIdx;
      while ((sepIdx = buffer.search(/\r?\n\r?\n/)) !== -1) {
        const block = buffer.slice(0, sepIdx);
        const match = buffer.slice(sepIdx).match(/^\r?\n\r?\n/);
        buffer = buffer.slice(sepIdx + (match ? match[0].length : 2));

        let eventName = 'message';
        const dataLines = [];
        for (const line of block.split(/\r?\n/)) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim());
          }
        }
        if (dataLines.length === 0) continue;

        let parsed;
        try {
          parsed = JSON.parse(dataLines.join('\n'));
        } catch {
          continue;
        }

        if (eventName === 'chunk' && typeof parsed?.delta === 'string') {
          onChunk?.(parsed.delta);
        } else if (eventName === 'done') {
          finalMeta = parsed;
        } else if (eventName === 'error') {
          const err = new Error(parsed?.error || 'AI service returned an error.');
          err.code = parsed?.code || 'AI_STREAM_ERROR';
          throw err;
        }
      }
    }

    return finalMeta || { reply: '' };
  },
};

// ==========================================
// PUBLIC IMPACT & STATS API
// ==========================================
export const publicApi = {
  getImpactStats: () => request('/public/impact-stats', { method: 'GET' })
};
