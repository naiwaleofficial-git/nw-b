import ApiError from "../utils/apiError.js";

// Usage: router.post("/", protect, authorize("ADMIN", "SALON_OWNER"), handler)
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, "Not authorized");
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ApiError(
        403,
        `Role "${req.user.role}" is not permitted to perform this action`
      );
    }

    next();
  };
}

export default authorize;
