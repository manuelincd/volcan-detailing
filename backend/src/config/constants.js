module.exports = {
  ROLES: { ADMIN: 'admin', EMPLOYEE: 'employee', CLIENT: 'client' },
  APPOINTMENT_STATUS: {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  },
  CANCEL_CUTOFF_HOURS: 2,
  AVAILABILITY_WINDOW_DAYS: 30,
  LOGIN_RATE_LIMIT: { windowMs: 15 * 60 * 1000, max: 5 },
};
