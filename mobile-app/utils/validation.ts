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
  // Enforce true E.164 format required by Twilio APIs
  // Must start with '+' followed by 1 to 14 digits
  const re = /^\+[1-9]\d{1,14}$/;
  return re.test(phone.trim());
};