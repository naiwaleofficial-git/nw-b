// Human-friendly, reasonably unique booking reference, e.g. GB-4F82K9-731
export function generateBookingNumber() {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  const suffix = Math.floor(100 + Math.random() * 900);

  return `GB-${random}-${suffix}`;
}

export default generateBookingNumber;
