// utils/validation.ts

export const validateEmail = (email: string) => {
  // Simple regex for email format
  const re = /\S+@\S+\.\S+/;
  return re.test(email);
};

export const validatePassword = (password: string) => {
  // Min 6 chars
  return password.length >= 6;
};

export const validatePhone = (phone: string) => {
  // Basic check: only numbers, min 10 digits
  const re = /^\d{10,}$/;
  return re.test(phone.replace(/\D/g, '')); // Remove non-digits before checking
};