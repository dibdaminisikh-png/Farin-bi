export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export const upstreamError = () => new ApiError(502, 'CRM_UNAVAILABLE', 'دریافت اطلاعات از پیام‌گستر ناموفق بود.');
