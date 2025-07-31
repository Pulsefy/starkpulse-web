const roles = require("../../../config/roles");

const checkRole = (requiredRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!requiredRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  };
};

const roleMiddleware = (requiredRoles) => {
  if (typeof requiredRoles === "string") {
    requiredRoles = [requiredRoles];
  }

  return [authenticateJWT, checkRole(requiredRoles)];
};

module.exports = roleMiddleware;
