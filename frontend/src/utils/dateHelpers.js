export const toDateString = (date) => new Date(date).toISOString().split('T')[0];

export const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

export const isInPast = (date) => new Date(date) < new Date();
