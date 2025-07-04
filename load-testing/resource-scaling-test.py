#!/usr/bin/env python3
"""
Resource Scaling Test for IndieShots
Tests concurrent user capacity at different resource levels

Usage:
1. Start with basic resources in Replit
2. Run: python resource-scaling-test.py --users 10
3. Increase resources in deployment tab
4. Run: python resource-scaling-test.py --users 50
5. Compare results

This will help determine optimal resource allocation.
"""

import asyncio
import aiohttp
import time
import json
import argparse
from dataclasses import dataclass
from typing import List, Dict, Any
import statistics

@dataclass
class TestResult:
    user_count: int
    success_rate: float
    avg_response_time: float
    max_response_time: float
    min_response_time: float
    errors: int
    total_requests: int
    duration: float

class ResourceScalingTester:
    def __init__(self, base_url: str = "https://indieshots.replit.app"):
        self.base_url = base_url
        self.auth_token = None
        
    async def authenticate(self, session: aiohttp.ClientSession) -> bool:
        """Get authentication token for API access"""
        login_data = {
            "email": "premium@demo.com",
            "password": "demo123"
        }
        
        try:
            async with session.post(f"{self.base_url}/api/auth/login", json=login_data) as response:
                if response.status == 200:
                    data = await response.json()
                    self.auth_token = data.get("token")
                    return True
                else:
                    print(f"Authentication failed: {response.status}")
                    return False
        except Exception as e:
            print(f"Auth error: {e}")
            return False

    async def simulate_user_session(self, session: aiohttp.ClientSession, user_id: int) -> Dict[str, Any]:
        """Simulate a complete user session"""
        results = {
            "user_id": user_id,
            "requests": 0,
            "successful": 0,
            "errors": 0,
            "response_times": [],
            "error_details": []
        }
        
        headers = {"Authorization": f"Bearer {self.auth_token}"} if self.auth_token else {}
        
        # Test sequence: Navigation -> API calls -> Image generation
        test_endpoints = [
            {"url": "/", "name": "Homepage"},
            {"url": "/dashboard", "name": "Dashboard"},
            {"url": "/api/health", "name": "Health Check"},
            {"url": "/projects", "name": "Projects"},
            {"url": "/api/scripts", "name": "User Scripts"}
        ]
        
        for endpoint in test_endpoints:
            start_time = time.time()
            try:
                async with session.get(f"{self.base_url}{endpoint['url']}", headers=headers) as response:
                    response_time = (time.time() - start_time) * 1000  # Convert to ms
                    results["requests"] += 1
                    results["response_times"].append(response_time)
                    
                    if response.status == 200:
                        results["successful"] += 1
                    else:
                        results["errors"] += 1
                        results["error_details"].append(f"{endpoint['name']}: {response.status}")
                        
            except Exception as e:
                results["errors"] += 1
                results["error_details"].append(f"{endpoint['name']}: {str(e)}")
                results["response_times"].append(5000)  # Timeout penalty
                
            # Small delay between requests
            await asyncio.sleep(0.1)
            
        # Test image generation API (resource intensive)
        if self.auth_token:
            await self.test_image_generation(session, results)
            
        return results

    async def test_image_generation(self, session: aiohttp.ClientSession, results: Dict[str, Any]):
        """Test resource-intensive image generation"""
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        image_data = {
            "shotDescription": "Test shot for load testing",
            "shotType": "Medium Shot",
            "lighting": "Natural light",
            "characters": "Test character"
        }
        
        start_time = time.time()
        try:
            async with session.post(
                f"{self.base_url}/api/shots/generate-image", 
                json=image_data, 
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                response_time = (time.time() - start_time) * 1000
                results["requests"] += 1
                results["response_times"].append(response_time)
                
                if response.status == 200:
                    results["successful"] += 1
                else:
                    results["errors"] += 1
                    results["error_details"].append(f"Image Gen: {response.status}")
                    
        except Exception as e:
            results["errors"] += 1
            results["error_details"].append(f"Image Gen: {str(e)}")
            results["response_times"].append(30000)  # Timeout

    async def run_load_test(self, concurrent_users: int, test_duration: int = 60) -> TestResult:
        """Run load test with specified number of concurrent users"""
        print(f"Starting load test with {concurrent_users} concurrent users for {test_duration}s")
        
        connector = aiohttp.TCPConnector(limit=concurrent_users * 2)
        timeout = aiohttp.ClientTimeout(total=30)
        
        async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
            # Authenticate once
            if not await self.authenticate(session):
                print("Failed to authenticate, running without auth")
            
            start_time = time.time()
            
            # Create tasks for concurrent users
            tasks = []
            for user_id in range(concurrent_users):
                task = asyncio.create_task(self.simulate_user_session(session, user_id))
                tasks.append(task)
                
                # Stagger user starts slightly
                if user_id % 10 == 9:
                    await asyncio.sleep(0.1)
            
            # Wait for all users to complete
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            end_time = time.time()
            duration = end_time - start_time
            
            # Process results
            return self.process_results(results, concurrent_users, duration)

    def process_results(self, results: List[Dict], user_count: int, duration: float) -> TestResult:
        """Process and aggregate test results"""
        total_requests = 0
        total_successful = 0
        total_errors = 0
        all_response_times = []
        
        for result in results:
            if isinstance(result, dict):
                total_requests += result["requests"]
                total_successful += result["successful"]
                total_errors += result["errors"]
                all_response_times.extend(result["response_times"])
        
        success_rate = (total_successful / total_requests) * 100 if total_requests > 0 else 0
        avg_response_time = statistics.mean(all_response_times) if all_response_times else 0
        max_response_time = max(all_response_times) if all_response_times else 0
        min_response_time = min(all_response_times) if all_response_times else 0
        
        return TestResult(
            user_count=user_count,
            success_rate=success_rate,
            avg_response_time=avg_response_time,
            max_response_time=max_response_time,
            min_response_time=min_response_time,
            errors=total_errors,
            total_requests=total_requests,
            duration=duration
        )

    def print_results(self, result: TestResult):
        """Print formatted test results"""
        print("\n" + "="*60)
        print(f"RESOURCE SCALING TEST RESULTS")
        print("="*60)
        print(f"Concurrent Users: {result.user_count}")
        print(f"Test Duration: {result.duration:.1f}s")
        print(f"Total Requests: {result.total_requests}")
        print(f"Success Rate: {result.success_rate:.1f}%")
        print(f"Average Response Time: {result.avg_response_time:.0f}ms")
        print(f"Min Response Time: {result.min_response_time:.0f}ms")
        print(f"Max Response Time: {result.max_response_time:.0f}ms")
        print(f"Total Errors: {result.errors}")
        print(f"Requests/Second: {result.total_requests/result.duration:.1f}")
        print("="*60)
        
        # Performance assessment
        if result.success_rate >= 95 and result.avg_response_time <= 1000:
            print("✅ EXCELLENT: App handles this load very well")
        elif result.success_rate >= 90 and result.avg_response_time <= 2000:
            print("✅ GOOD: App handles this load well")
        elif result.success_rate >= 80 and result.avg_response_time <= 3000:
            print("⚠️  FAIR: App is under stress but functional")
        else:
            print("❌ POOR: App is struggling with this load")

async def main():
    parser = argparse.ArgumentParser(description='Resource Scaling Test for IndieShots')
    parser.add_argument('--users', type=int, default=10, help='Number of concurrent users')
    parser.add_argument('--duration', type=int, default=60, help='Test duration in seconds')
    parser.add_argument('--url', type=str, default='https://indieshots.replit.app', help='Base URL to test')
    
    args = parser.parse_args()
    
    tester = ResourceScalingTester(args.url)
    result = await tester.run_load_test(args.users, args.duration)
    tester.print_results(result)
    
    # Save results to file
    timestamp = int(time.time())
    filename = f"results/scaling-test-{args.users}users-{timestamp}.json"
    
    result_data = {
        "timestamp": timestamp,
        "test_config": {
            "users": args.users,
            "duration": args.duration,
            "url": args.url
        },
        "results": {
            "user_count": result.user_count,
            "success_rate": result.success_rate,
            "avg_response_time": result.avg_response_time,
            "max_response_time": result.max_response_time,
            "min_response_time": result.min_response_time,
            "errors": result.errors,
            "total_requests": result.total_requests,
            "duration": result.duration
        }
    }
    
    try:
        with open(filename, 'w') as f:
            json.dump(result_data, f, indent=2)
        print(f"\nResults saved to: {filename}")
    except:
        print("Could not save results to file")

if __name__ == "__main__":
    asyncio.run(main())