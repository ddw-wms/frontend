// File Path = warehouse-frontend\lib\utils.ts
export const formatDate = (date: string | Date): string => {
  // Handle ISO date strings without timezone conversion
  let d: Date;
  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}/)) {
    const dateOnly = date.split('T')[0];
    const [year, month, day] = dateOnly.split('-').map(Number);
    d = new Date(year, month - 1, day);
  } else {
    d = new Date(date);
  }
  
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatTime = (date: string | Date): string => {
  return new Date(date).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const truncate = (str: string, length: number): string => {
  return str.length > length ? str.substring(0, length) + '...' : str;
};

export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};
