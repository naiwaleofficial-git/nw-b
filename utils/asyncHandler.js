// Wraps an async controller so thrown errors are forwarded to next()
// instead of crashing the process or requiring try/catch everywhere.
export function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default asyncHandler;
