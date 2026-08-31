// Custom error class so controllers can throw errors with a specific
// HTTP status code, and the error middleware can read it directly.
export class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "ApiError";
  }
}

export default ApiError;
