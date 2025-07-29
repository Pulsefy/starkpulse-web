module.exports = {
  user: ["read:own_account", "write:own_account"],
  admin: [
    "read:any_account",
    "write:any_account",
    "manage:users",
    "manage:roles",
  ],
  institutional: ["read:any_account", "api:access", "manage:own_users"],
};
