# Resource Scaling & Image API Load Testing Guide

This guide shows you how to test your IndieShots app at different resource levels and specifically test the image generation API under load.

## Setup

### 1. Install Locust (for image API testing)
```bash
pip install locust aiohttp
```

### 2. Install Python dependencies (for resource scaling tests)
```bash
pip install aiohttp asyncio
```

## Part 1: Image Generation API Load Testing with Locust

### Quick Start
```bash
cd load-testing
locust -f locust-image-api.py --host=https://indieshots.replit.app
```

Then open: http://localhost:8089

### Test Scenarios

**Light Load Test (Normal Users)**
- Start users: 5
- Spawn rate: 1 user/second
- Run time: 5 minutes

**Heavy Load Test (Power Users)**  
- Start users: 20
- Spawn rate: 2 users/second
- Run time: 10 minutes

**Stress Test (Breaking Point)**
- Start users: 50
- Spawn rate: 5 users/second  
- Run time: 15 minutes

### What Gets Tested
- Single image generation API calls
- Image regeneration with custom prompts
- Batch storyboard generation
- Authentication under load
- OpenAI API rate limit handling

### Expected Results
- **Good**: 95%+ success rate, <2s response times
- **Warning**: 80-95% success, 2-5s response times
- **Critical**: <80% success, >5s response times

## Part 2: Resource Scaling Tests

### Test at Different Resource Levels

#### Step 1: Baseline Test (Current Resources)
```bash
cd load-testing
python resource-scaling-test.py --users 10 --duration 60
```

#### Step 2: Upgrade Resources in Replit
1. Go to your Replit project
2. Click "Deployments" tab
3. Click "Configure" next to your deployment
4. Adjust resources:
   - **Basic**: 0.25 vCPU, 1GB RAM
   - **Boosted**: 0.5 vCPU, 2GB RAM  
   - **Reserved**: 1 vCPU, 4GB RAM
   - **Premium**: 2 vCPU, 8GB RAM

#### Step 3: Test Each Resource Level
```bash
# Test with 25 users
python resource-scaling-test.py --users 25 --duration 120

# Test with 50 users  
python resource-scaling-test.py --users 50 --duration 120

# Test with 100 users
python resource-scaling-test.py --users 100 --duration 180
```

### Resource Testing Matrix

| Resource Level | Recommended Test | Expected Capacity |
|---------------|------------------|-------------------|
| Basic (0.25 vCPU) | 5-15 users | Light usage |
| Boosted (0.5 vCPU) | 15-30 users | Small business |
| Reserved (1 vCPU) | 30-75 users | Growing business |
| Premium (2 vCPU) | 75-150+ users | High traffic |

## Part 3: Analyzing Results

### Performance Indicators

**Excellent Performance:**
- Success rate: >95%
- Average response time: <1000ms
- Max response time: <3000ms
- No 5xx errors

**Good Performance:**
- Success rate: 90-95%
- Average response time: 1000-2000ms
- Max response time: <5000ms
- Minimal 5xx errors

**Poor Performance:**
- Success rate: <90%
- Average response time: >2000ms
- Max response time: >5000ms
- Frequent 5xx errors

### Key Metrics to Watch

1. **Response Times**: How fast your app responds
2. **Success Rate**: Percentage of successful requests
3. **Error Rate**: Failed requests (especially 5xx server errors)
4. **Throughput**: Requests handled per second
5. **Resource Usage**: CPU and memory consumption

### Bottlenecks to Identify

1. **OpenAI API Limits**: 3,500 requests/minute typically
2. **Database Connections**: PostgreSQL connection pool
3. **Memory Usage**: Image processing and storage
4. **CPU Usage**: Heavy computation during peak load

## Part 4: Results Interpretation

### When to Upgrade Resources

**Upgrade if you see:**
- Success rate dropping below 95%
- Response times consistently >2000ms
- Frequent 503/504 server errors
- High error rates during normal usage

### Cost vs Performance

Calculate the sweet spot:
- **Cost per user**: Monthly resource cost ÷ max concurrent users
- **Performance threshold**: Minimum acceptable response time
- **Business needs**: Peak usage times and growth projections

### Sample Results Analysis

```
10 Users - Basic Resources:
✅ Success Rate: 98% - GOOD
✅ Avg Response: 450ms - EXCELLENT  
✅ Max Response: 1200ms - GOOD
→ Current resources handle 10 users well

25 Users - Basic Resources:  
⚠️ Success Rate: 87% - NEEDS IMPROVEMENT
⚠️ Avg Response: 2100ms - SLOW
❌ Max Response: 8500ms - POOR
→ Need resource upgrade for 25+ users

25 Users - Boosted Resources:
✅ Success Rate: 96% - EXCELLENT
✅ Avg Response: 650ms - EXCELLENT
✅ Max Response: 1800ms - GOOD  
→ Boosted resources handle 25 users well
```

## Running the Tests

### Full Test Sequence
```bash
# 1. Current baseline
python resource-scaling-test.py --users 5

# 2. Increase load gradually  
python resource-scaling-test.py --users 10
python resource-scaling-test.py --users 25
python resource-scaling-test.py --users 50

# 3. Image API specific testing
locust -f locust-image-api.py --headless -u 10 -r 2 -t 300s

# 4. Upgrade resources and repeat
```

Results are saved in `results/` folder with timestamps for comparison.

## Tips for Optimization

1. **Monitor during tests**: Watch Replit deployment metrics
2. **Test realistic scenarios**: Mix of light and heavy users
3. **Consider peak hours**: Test when your users are most active
4. **Budget planning**: Compare cost vs performance needs
5. **Gradual scaling**: Don't jump directly to maximum resources

This testing will help you find the optimal resource allocation for your IndieShots app based on actual performance data rather than guessing.