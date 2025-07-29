const geoip = require("geoip-lite");
const User = require("../../../models/User");

module.exports = async (req, res, next) => {
  const ip = req.ip;
  const geo = geoip.lookup(ip);
  const userAgent = req.headers["user-agent"];

  if (req.user) {
    const lastLogin = await LoginHistory.findOne({ userId: req.user.id }).sort({
      createdAt: -1,
    });

    if (lastLogin && geo.country !== lastLogin.country) {
      req.authAnomaly = "Country changed";
    }
  }

  next();
};
