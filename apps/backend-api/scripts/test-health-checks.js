/**
 * Health Check and Monitoring Test Script
 * This script tests both the basic and detailed health check endpoints
 * as well as the metrics endpoints to validate functionality
 */

const axios = require('axios');
const colors = require('colors/safe');

// Config
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const endpoints = {
  basicHealth: `${API_BASE_URL}/api/health`,
  detailedHealth: `${API_BASE_URL}/api/health/detailed`,
  metrics: `${API_BASE_URL}/api/metrics`,
  metricsJson: `${API_BASE_URL}/api/metrics?format=json`,
  metricsPrometheus: `${API_BASE_URL}/api/metrics?format=prometheus`,
  metricsDatadog: `${API_BASE_URL}/api/metrics?format=datadog`,
  metricsHistory: `${API_BASE_URL}/api/metrics/history`,
};

// Test function to make a request and check response
async function testEndpoint(name, url) {
  console.log(colors.cyan(`\nTesting ${name}...`));
  try {
    const startTime = Date.now();
    const response = await axios.get(url);
    const endTime = Date.now();
    
    console.log(colors.green(`✓ ${name} - Status: ${response.status} (${endTime - startTime}ms)`));
    
    if (typeof response.data === 'object') {
      console.log(colors.gray('Response:'));
      console.log(colors.gray(JSON.stringify(response.data, null, 2).substring(0, 500) + '...'));
    } else {
      console.log(colors.gray(`Response: ${String(response.data).substring(0, 100)}...`));
    }
    
    return response.data;
  } catch (error) {
    console.error(colors.red(`✗ ${name} - Error: ${error.message}`));
    if (error.response) {
      console.error(colors.red(`  Status: ${error.response.status}`));
      console.error(colors.red(`  Data: ${JSON.stringify(error.response.data, null, 2)}`));
    }
    return null;
  }
}

// Main test function
async function runTests() {
  console.log(colors.yellow('=== StarkPulse Health Check & Monitoring Validation ==='));
  console.log(colors.yellow(`Testing against: ${API_BASE_URL}`));
  
  // Test basic health endpoint
  const basicHealth = await testEndpoint('Basic Health', endpoints.basicHealth);
  
  // Test detailed health endpoint
  const detailedHealth = await testEndpoint('Detailed Health', endpoints.detailedHealth);
  
  // Test metrics endpoints in different formats
  await testEndpoint('Metrics (Default)', endpoints.metrics);
  await testEndpoint('Metrics (JSON)', endpoints.metricsJson);
  await testEndpoint('Metrics (Prometheus)', endpoints.metricsPrometheus);
  await testEndpoint('Metrics (Datadog)', endpoints.metricsDatadog);
  await testEndpoint('Metrics History', endpoints.metricsHistory);
  
  // Validate health data
  if (basicHealth) {
    console.log('\nBasic Health Check Validation:');
    console.log(colors.green(`✓ Status: ${basicHealth.status === 'OK' ? 'OK' : 'Failed'}`));
    console.log(colors.green(`✓ Uptime: ${basicHealth.uptime !== undefined ? 'Present' : 'Missing'}`));
    console.log(colors.green(`✓ Version: ${basicHealth.version !== undefined ? 'Present' : 'Missing'}`));
  }
  
  if (detailedHealth) {
    console.log('\nDetailed Health Check Validation:');
    console.log(colors.green(`✓ Database: ${detailedHealth.dependencies?.database?.status || 'Missing'}`));
    console.log(colors.green(`✓ Cache: ${detailedHealth.dependencies?.cache?.status || 'Missing'}`));
    console.log(colors.green(`✓ External Services: ${Object.keys(detailedHealth.dependencies?.externalServices || {}).length} services checked`));
    console.log(colors.green(`✓ System Metrics: ${detailedHealth.system ? 'Present' : 'Missing'}`));
  }
  
  console.log(colors.yellow('\n=== Validation Complete ==='));
}

// Run tests
runTests().catch(err => {
  console.error(colors.red('Test failed with error:'), err);
  process.exit(1);
});
