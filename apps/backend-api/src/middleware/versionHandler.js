/**
 * API Version Handler Middleware
 * Manages API versioning, routing, and deprecation warnings
 */

const semver = require('semver');

// Configuration for API versions
const API_VERSIONS = {
  v1: {
    active: true,
    deprecated: false,
    sunset: null, // Date when this version will be removed
  },
  v2: {
    active: true,
    deprecated: false,
    sunset: null,
  }
};

// Default version if none specified
const DEFAULT_VERSION = 'v1';

// Current latest version
const LATEST_VERSION = 'v2';

/**
 * Middleware to validate API version and add deprecation warnings
 */
function versionHandler(req, res, next) {
  // Extract version from URL path
  const urlParts = req.originalUrl.split('/');
  const versionMatch = urlParts.find(part => part.match(/^v\d+$/i));
  
  // Set version
  let version = versionMatch || DEFAULT_VERSION;
  
  // Normalize version to lowercase
  version = version.toLowerCase();
  
  // Check if requested version exists
  if (!API_VERSIONS[version]) {
    return res.status(400).json({
      success: false,
      message: `Invalid API version: ${version}. Available versions: ${Object.keys(API_VERSIONS).join(', ')}`,
    });
  }
  
  // Check if version is active
  if (!API_VERSIONS[version].active) {
    return res.status(410).json({
      success: false,
      message: `API version ${version} is no longer available. Please use version ${LATEST_VERSION}`,
    });
  }
  
  // Add version to request object for use in route handlers
  req.apiVersion = version;
  
  // Add deprecation warning header if version is deprecated
  if (API_VERSIONS[version].deprecated) {
    const sunsetDate = API_VERSIONS[version].sunset 
      ? new Date(API_VERSIONS[version].sunset).toUTCString() 
      : 'date to be determined';
      
    res.set({
      'Deprecation': 'true',
      'Sunset': sunsetDate,
      'Warning': `299 - "Deprecated API version ${version}. Please migrate to version ${LATEST_VERSION}"`,
      'Link': `</api/${LATEST_VERSION}${req.path}>; rel="successor-version"`
    });
  }
  
  next();
}

/**
 * Helper to determine if a specific version is deprecated
 * @param {string} version - API version to check
 * @returns {boolean} - Whether version is deprecated
 */
function isDeprecated(version) {
  const ver = version.toLowerCase();
  return API_VERSIONS[ver] ? API_VERSIONS[ver].deprecated : true;
}

/**
 * Helper to determine if a specific version is active
 * @param {string} version - API version to check
 * @returns {boolean} - Whether version is active
 */
function isActive(version) {
  const ver = version.toLowerCase();
  return API_VERSIONS[ver] ? API_VERSIONS[ver].active : false;
}

/**
 * Get the latest version information
 * @returns {string} - Latest API version
 */
function getLatestVersion() {
  return LATEST_VERSION;
}

/**
 * List all available API versions with their status
 * @returns {Object} - Available API versions with status
 */
function getVersions() {
  return API_VERSIONS;
}

module.exports = {
  versionHandler,
  isDeprecated,
  isActive,
  getLatestVersion,
  getVersions,
  API_VERSIONS
};
