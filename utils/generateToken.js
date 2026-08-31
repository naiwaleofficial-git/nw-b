import jwt from "jsonwebtoken";

export function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

// Signs the JWT and sets it as an HTTP-only cookie on the response.
export function sendTokenResponse(user, statusCode, res) {
  const token = generateToken(user._id);

  const cookieExpiresDays = Number(process.env.COOKIE_EXPIRES_DAYS) || 7;

  const cookieOptions = {
    expires: new Date(Date.now() + cookieExpiresDays * 24 * 60 * 60 * 1000),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };

  const safeUser = {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    profileImage: user.profileImage,
  };

  res
    .status(statusCode)
    .cookie("token", token, cookieOptions)
    .json({
      success: true,
      token,
      user: safeUser,
    });
}

export default generateToken;
