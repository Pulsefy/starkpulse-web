# API Versioning Guide

## Overview

This document outlines the API versioning strategy implemented in the StarkPulse Web API. The versioning system allows for backward compatibility while enabling the introduction of new features and improvements.

## Versioning Strategy

We use URL-based versioning where the API version is specified in the URL path:

```http
https://api.starkpulse.com/api/v1/resource
https://api.starkpulse.com/api/v2/resource
```

### Current API Versions

- **v1**: Initial API version (stable)
- **v2**: Current stable version with enhanced features

## Using Different Versions

### Explicitly Specifying Version

Include the version in the URL path:

```http
GET /api/v1/users
GET /api/v2/users
```

### Using the Default Version

If no version is specified, the latest stable version is used:

```http
GET /api/users  # Equivalent to /api/v2/users
```

## Version Lifecycle

Each API version follows a defined lifecycle:

1. **Active**: The version is fully supported
2. **Deprecated**: The version is still available but marked for future removal
3. **Sunset**: The version is no longer available

## Deprecation Policy

When an API version is deprecated:

- A `Deprecation: true` header is included in responses
- A `Sunset` header indicates when the version will be removed
- A `Warning` header includes migration guidance
- A `Link` header points to the successor version

## Version-Specific Features

Each API version may have specific features or behavior:

### v1 Features

- Basic CRUD operations
- Standard authentication
- Core business functionality

### v2 Features

- Enhanced performance
- Additional query parameters
- Expanded response data
- Improved error handling

## Migration Guide

### Migrating from v1 to v2

1. **Update API endpoints** in your client code to use the v2 prefix
2. **Review response formats** as some responses may include additional fields
3. **Test all endpoints** thoroughly with the new version

## Best Practices

1. **Use explicit versioning** in production code
2. **Monitor deprecation notices** in API responses
3. **Plan for migrations** well before sunset dates
4. **Test across versions** to ensure compatibility

## Support

If you encounter issues migrating between API versions, please contact our developer support at [dev-support@starkpulse.com](mailto:dev-support@starkpulse.com).
