#!/usr/bin/env python3

import asyncio
import aiohttp
import time
import json
from typing import Dict, List, Any
from dataclasses import dataclass
import argparse

@dataclass
class TestResult:
    total_requests: int
    successful_requests: int
    failed_requests: int
    avg_response_time: float
    max_response_time: float
    min_response_time: float
    errors: List[str]
    success_rate: float

class IndieShots_LoadTester:
    def __init__(self, base_url: str = "https://indieshots.replit.app"):
        self.base_url = base_url
        self.auth_token = None
        
    async def authenticate(self, session: aiohttp.ClientSession) -> bool:
        """Authenticate with demo credentials"""
        try:
            login_data = {
                "email": "premium@demo.com",
                "password": "demo123"
            }
            
            async with session.post(
                f"{self.base_url}/api/auth/login",
                json=login_data,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    self.auth_token = data.get("token")
                    return True
                else:
                    print(f"Authentication failed: {response.status}")
                    return False
        except Exception as e:
            print(f"Authentication error: {e}")
            return False

    async def make_request(self, session: aiohttp.ClientSession, endpoint: str, method: str = "GET", data: dict = None) -> Dict[str, Any]:
        """Make a single request and measure response time"""
        start_time = time.time()
        
        headers = {}
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
            
        try:
            if method == "GET":
                async with session.get(
                    f"{self.base_url}{endpoint}",
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    response_time = time.time() - start_time
                    return {
                        "success": response.status < 400,
                        "status_code": response.status,
                        "response_time": response_time,
                        "error": None if response.status < 400 else f"HTTP {response.status}"
                    }
            else:
                async with session.post(
                    f"{self.base_url}{endpoint}",
                    json=data,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    response_time = time.time() - start_time
                    return {
                        "success": response.status < 400,
                        "status_code": response.status,
                        "response_time": response_time,
                        "error": None if response.status < 400 else f"HTTP {response.status}"
                    }
        except Exception as e:
            response_time = time.time() - start_time
            return {
                "success": False,
                "status_code": 0,
                "response_time": response_time,
                "error": str(e)
            }

    async def simulate_user_session(self, session: aiohttp.ClientSession, user_id: int) -> List[Dict[str, Any]]:
        """Simulate a typical user session"""
        results = []
        
        # Health check
        result = await self.make_request(session, "/api/health")
        results.append(result)
        
        # Dashboard access (if authenticated)
        if self.auth_token:
            result = await self.make_request(session, "/api/auth/user")
            results.append(result)
            
            # Simulate image generation request
            shot_data = {
                "shotDescription": f"Test shot from user {user_id}",
                "shotType": "Wide Shot",
                "lens": "24mm",
                "lighting": "Natural",
                "moodAndAmbience": "Peaceful",
                "location": "Forest",
                "timeOfDay": "Morning"
            }
            
            result = await self.make_request(session, "/api/shots/generate-image", "POST", shot_data)
            results.append(result)
        
        return results

    async def run_load_test(self, concurrent_users: int, duration: int = 60) -> TestResult:
        """Run load test with specified parameters"""
        print(f"🚀 Starting load test: {concurrent_users} users for {duration}s")
        
        connector = aiohttp.TCPConnector(limit=concurrent_users * 2)
        timeout = aiohttp.ClientTimeout(total=30)
        
        async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
            # Authenticate once
            authenticated = await self.authenticate(session)
            if not authenticated:
                print("❌ Authentication failed - testing without auth")
            
            # Run concurrent user sessions
            tasks = []
            for user_id in range(concurrent_users):
                task = asyncio.create_task(
                    self.simulate_user_session(session, user_id)
                )
                tasks.append(task)
            
            # Wait for all tasks to complete with timeout
            try:
                all_results = await asyncio.wait_for(
                    asyncio.gather(*tasks, return_exceptions=True),
                    timeout=duration + 10
                )
            except asyncio.TimeoutError:
                print("⚠️  Test timed out")
                all_results = []
            
            # Process results
            successful_requests = 0
            failed_requests = 0
            response_times = []
            errors = []
            
            for user_results in all_results:
                if isinstance(user_results, Exception):
                    failed_requests += 1
                    errors.append(str(user_results))
                    continue
                    
                for result in user_results:
                    if result["success"]:
                        successful_requests += 1
                    else:
                        failed_requests += 1
                        if result["error"]:
                            errors.append(result["error"])
                    
                    response_times.append(result["response_time"])
            
            total_requests = successful_requests + failed_requests
            
            return TestResult(
                total_requests=total_requests,
                successful_requests=successful_requests,
                failed_requests=failed_requests,
                avg_response_time=sum(response_times) / len(response_times) if response_times else 0,
                max_response_time=max(response_times) if response_times else 0,
                min_response_time=min(response_times) if response_times else 0,
                errors=errors[:10],  # Show first 10 errors
                success_rate=(successful_requests / total_requests * 100) if total_requests > 0 else 0
            )

def print_results(result: TestResult, users: int):
    """Print formatted test results"""
    print(f"\n📊 Load Test Results ({users} concurrent users)")
    print("=" * 50)
    print(f"Total Requests: {result.total_requests}")
    print(f"Successful: {result.successful_requests}")
    print(f"Failed: {result.failed_requests}")
    print(f"Success Rate: {result.success_rate:.2f}%")
    print(f"Average Response Time: {result.avg_response_time:.3f}s")
    print(f"Max Response Time: {result.max_response_time:.3f}s")
    print(f"Min Response Time: {result.min_response_time:.3f}s")
    
    if result.errors:
        print(f"\nTop Errors:")
        for error in result.errors[:5]:
            print(f"  • {error}")
    
    # Performance assessment
    print(f"\n🎯 Performance Assessment:")
    if result.success_rate >= 95 and result.avg_response_time < 2.0:
        print("  ✅ EXCELLENT - App handles this load well")
    elif result.success_rate >= 90 and result.avg_response_time < 5.0:
        print("  ✅ GOOD - App can handle this load")
    elif result.success_rate >= 80 and result.avg_response_time < 10.0:
        print("  ⚠️  MODERATE - App struggles but works")
    else:
        print("  ❌ POOR - App cannot handle this load")

async def main():
    parser = argparse.ArgumentParser(description="Load test IndieShots app")
    parser.add_argument("--users", type=int, default=10, help="Number of concurrent users")
    parser.add_argument("--duration", type=int, default=60, help="Test duration in seconds")
    
    args = parser.parse_args()
    
    tester = IndieShots_LoadTester()
    result = await tester.run_load_test(args.users, args.duration)
    print_results(result, args.users)

if __name__ == "__main__":
    asyncio.run(main())