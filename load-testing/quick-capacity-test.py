#!/usr/bin/env python3

import asyncio
import aiohttp
import time
from concurrent.futures import ThreadPoolExecutor
import statistics

async def test_single_request(session, url, user_id):
    """Test a single request and return timing data"""
    start_time = time.time()
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as response:
            response_time = time.time() - start_time
            return {
                'user_id': user_id,
                'status': response.status,
                'response_time': response_time,
                'success': response.status == 200
            }
    except Exception as e:
        response_time = time.time() - start_time
        return {
            'user_id': user_id,
            'status': 0,
            'response_time': response_time,
            'success': False,
            'error': str(e)
        }

async def run_concurrent_test(num_users, url="https://indieshots.replit.app"):
    """Run concurrent requests to test app capacity"""
    print(f"Testing {num_users} concurrent users accessing {url}")
    
    connector = aiohttp.TCPConnector(limit=num_users * 2)
    async with aiohttp.ClientSession(connector=connector) as session:
        
        # Create tasks for concurrent requests
        tasks = []
        for i in range(num_users):
            task = asyncio.create_task(test_single_request(session, url, i))
            tasks.append(task)
        
        # Wait for all requests to complete
        start_time = time.time()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        total_time = time.time() - start_time
        
        # Process results
        successful = 0
        failed = 0
        response_times = []
        errors = []
        
        for result in results:
            if isinstance(result, Exception):
                failed += 1
                errors.append(str(result))
            else:
                if result['success']:
                    successful += 1
                else:
                    failed += 1
                    if 'error' in result:
                        errors.append(result['error'])
                response_times.append(result['response_time'])
        
        # Calculate statistics
        total_requests = successful + failed
        success_rate = (successful / total_requests * 100) if total_requests > 0 else 0
        
        print(f"\nResults for {num_users} concurrent users:")
        print(f"  Total requests: {total_requests}")
        print(f"  Successful: {successful}")
        print(f"  Failed: {failed}")
        print(f"  Success rate: {success_rate:.1f}%")
        print(f"  Total time: {total_time:.2f}s")
        
        if response_times:
            print(f"  Average response time: {statistics.mean(response_times):.3f}s")
            print(f"  Median response time: {statistics.median(response_times):.3f}s")
            print(f"  Max response time: {max(response_times):.3f}s")
            print(f"  Min response time: {min(response_times):.3f}s")
        
        if errors:
            print(f"  Sample errors: {errors[:3]}")
        
        # Performance assessment
        if success_rate >= 95 and statistics.mean(response_times) < 2.0:
            assessment = "EXCELLENT"
        elif success_rate >= 90 and statistics.mean(response_times) < 5.0:
            assessment = "GOOD"
        elif success_rate >= 80:
            assessment = "MODERATE"
        else:
            assessment = "POOR"
        
        print(f"  Assessment: {assessment}")
        return success_rate, statistics.mean(response_times) if response_times else 0

async def main():
    """Test app capacity with increasing user loads"""
    print("IndieShots App Capacity Test")
    print("=" * 40)
    
    # Test with increasing loads
    test_loads = [5, 10, 25, 50, 75, 100, 120]
    
    for num_users in test_loads:
        try:
            success_rate, avg_response_time = await run_concurrent_test(num_users)
            
            # Stop testing if performance drops significantly
            if success_rate < 80:
                print(f"\nPerformance degraded at {num_users} users")
                print("Recommendation: App cannot reliably handle 120+ concurrent users")
                break
            elif num_users >= 120:
                print(f"\nApp successfully handled {num_users} concurrent users!")
                print("Recommendation: App CAN handle 120+ concurrent users")
                break
                
        except Exception as e:
            print(f"Error testing {num_users} users: {e}")
            break
        
        # Wait between tests
        await asyncio.sleep(2)
    
    print("\nTest completed.")

if __name__ == "__main__":
    asyncio.run(main())