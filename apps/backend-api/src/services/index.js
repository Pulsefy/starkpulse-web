// Export all services
module.exports = {
  authService: require("./authService"),
  userService: require("./userService"),
  newsService: require("./newsService"),
  cryptoService: require("./cryptoService"),
  portfolioService: require("./portfolioService"),
  starknetService: require("./starknetService"),
  emailService: require("./emailService"),
  ValidationNetwork: require("./ValidationNetwork"),
  ConsensusEngine: require("./ConsensusEngine"),
  ReputationSystem: require("./ReputationSystem"),
  ContentVerification: require("./ContentVerification"),
  ManipulationDetection: require("./ManipulationDetection"),
  EditorialIndependence: require("./EditorialIndependence"),
};
