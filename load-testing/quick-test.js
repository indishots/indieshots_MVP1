import https from 'https';
import http from 'http';

async function testEndpoint(url, description) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const client = url.startsWith('https://') ? https : http;
    
    const req = client.get(url, (res) => {
      const responseTime = Date.now() - startTime;
      console.log(`✅ ${description}: ${res.statusCode} (${responseTime}ms)`);
      resolve({ status: res.statusCode, time: responseTime, success: true });
    });
    
    req.on('error', (err) => {
      const responseTime = Date.now() - startTime;
      console.log(`❌ ${description}: Error (${responseTime}ms) - ${err.message}`);
      resolve({ status: 'ERROR', time: responseTime, success: false });
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      const responseTime = Date.now() - startTime;
      console.log(`⏰ ${description}: Timeout (${responseTime}ms)`);
      resolve({ status: 'TIMEOUT', time: responseTime, success: false });
    });
  });
}

async function runQuickTest() {
  console.log('🚀 Running Quick Load Test for IndieShots');
  console.log('==========================================');
  
  const baseUrl = 'https://indieshots.replit.app';
  const tests = [
    { url: baseUrl, desc: 'Homepage' },
    { url: `${baseUrl}/health`, desc: 'Health Check' },
    { url: `${baseUrl}/api/health`, desc: 'API Health' },
    { url: `${baseUrl}/auth`, desc: 'Auth Page' },
    { url: `${baseUrl}/dashboard`, desc: 'Dashboard' }
  ];
  
  const results = [];
  
  // Run basic tests
  for (const test of tests) {
    const result = await testEndpoint(test.url, test.desc);
    results.push(result);
  }
  
  // Calculate summary
  const successful = results.filter(r => r.success).length;
  const averageTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
  const maxTime = Math.max(...results.map(r => r.time));
  const minTime = Math.min(...results.map(r => r.time));
  
  console.log('\n📊 Test Summary:');
  console.log(`Success Rate: ${successful}/${results.length} (${(successful/results.length*100).toFixed(1)}%)`);
  console.log(`Average Response Time: ${averageTime.toFixed(0)}ms`);
  console.log(`Fastest Response: ${minTime}ms`);
  console.log(`Slowest Response: ${maxTime}ms`);
  
  if (successful === results.length) {
    console.log('\n✅ All tests passed! Your app is responding well.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
  }
}

runQuickTest().catch(console.error);