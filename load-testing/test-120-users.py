#!/usr/bin/env python3

import asyncio
import aiohttp
import time
import statistics

async def test_120_users():
    print('Testing 120 concurrent users on IndieShots...')
    
    connector = aiohttp.TCPConnector(limit=240)
    async with aiohttp.ClientSession(connector=connector) as session:
        
        async def single_request(user_id):
            start_time = time.time()
            try:
                async with session.get('https://indieshots.replit.app', timeout=aiohttp.ClientTimeout(total=10)) as response:
                    response_time = time.time() - start_time
                    return {'success': response.status == 200, 'response_time': response_time, 'status': response.status}
            except Exception as e:
                response_time = time.time() - start_time
                return {'success': False, 'response_time': response_time, 'error': str(e)}
        
        # Run 120 concurrent requests
        tasks = [asyncio.create_task(single_request(i)) for i in range(120)]
        start_time = time.time()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        total_time = time.time() - start_time
        
        # Process results
        successful = sum(1 for r in results if isinstance(r, dict) and r.get('success'))
        failed = 120 - successful
        response_times = [r['response_time'] for r in results if isinstance(r, dict) and 'response_time' in r]
        
        success_rate = (successful / 120) * 100
        avg_response_time = statistics.mean(response_times) if response_times else 0
        
        print(f'120 Concurrent Users Test Results:')
        print(f'  Successful requests: {successful}/120')
        print(f'  Failed requests: {failed}')
        print(f'  Success rate: {success_rate:.1f}%')
        print(f'  Total test time: {total_time:.2f}s')
        print(f'  Average response time: {avg_response_time:.3f}s')
        print(f'  Max response time: {max(response_times):.3f}s' if response_times else 'N/A')
        print(f'  Min response time: {min(response_times):.3f}s' if response_times else 'N/A')
        
        if success_rate >= 95 and avg_response_time < 2.0:
            print('  RESULT: ✅ YES - Your app CAN handle 120 concurrent users')
        elif success_rate >= 90 and avg_response_time < 5.0:
            print('  RESULT: ✅ YES - Your app can handle 120 concurrent users with good performance')
        elif success_rate >= 80:
            print('  RESULT: ⚠️ MAYBE - Your app struggles but might handle 120 users')
        else:
            print('  RESULT: ❌ NO - Your app cannot reliably handle 120 concurrent users')

asyncio.run(test_120_users())