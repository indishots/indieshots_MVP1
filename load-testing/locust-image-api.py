import time
import json
import random
from locust import HttpUser, task, between

class ImageGenerationAPIUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        """Login and get authentication token before testing image generation"""
        # Use demo credentials for testing
        login_data = {
            "email": "premium@demo.com",
            "password": "demo123"
        }
        
        response = self.client.post("/api/auth/login", json=login_data)
        if response.status_code == 200:
            self.auth_token = response.json().get("token")
            self.client.headers.update({"Authorization": f"Bearer {self.auth_token}"})
        else:
            print(f"Login failed: {response.status_code}")
            self.auth_token = None

    @task(3)
    def generate_single_image(self):
        """Test single image generation endpoint"""
        if not self.auth_token:
            return
            
        # Sample shot data for image generation
        shot_data = {
            "shotDescription": "Wide shot of a character walking through a forest",
            "shotType": "Wide Shot",
            "lens": "24mm",
            "lighting": "Natural daylight",
            "moodAndAmbience": "Peaceful and serene",
            "location": "Forest path",
            "timeOfDay": "Morning",
            "characters": "Main character - young adult in hiking clothes"
        }
        
        with self.client.post(
            "/api/shots/generate-image", 
            json=shot_data,
            catch_response=True,
            name="Generate Single Image"
        ) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 503:
                response.failure("Service unavailable - OpenAI API limit")
            else:
                response.failure(f"Unexpected status: {response.status_code}")

    @task(2)
    def regenerate_image(self):
        """Test image regeneration with custom prompt"""
        if not self.auth_token:
            return
            
        # Simulate regenerating an existing shot image
        regen_data = {
            "shotId": random.randint(1, 100),  # Random shot ID for testing
            "customPrompt": "Make this shot more cinematic with dramatic lighting",
            "imagePromptText": "Cinematic wide shot with dramatic shadows"
        }
        
        with self.client.post(
            "/api/shots/regenerate-image",
            json=regen_data,
            catch_response=True,
            name="Regenerate Image"
        ) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 503:
                response.failure("Service unavailable - OpenAI API limit")
            else:
                response.failure(f"Unexpected status: {response.status_code}")

    @task(1)
    def batch_generate_storyboards(self):
        """Test batch storyboard generation"""
        if not self.auth_token:
            return
            
        # Sample data for batch generation
        batch_data = {
            "jobId": "test-job",
            "sceneIndex": 0,
            "shots": [
                {
                    "shotDescription": "Close-up of character's face",
                    "shotType": "Close-up",
                    "lighting": "Soft artificial light"
                },
                {
                    "shotDescription": "Medium shot of conversation",
                    "shotType": "Medium Shot", 
                    "lighting": "Interior office lighting"
                }
            ]
        }
        
        with self.client.post(
            "/api/storyboards/generate",
            json=batch_data,
            catch_response=True,
            name="Batch Generate Storyboards"
        ) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 503:
                response.failure("Service unavailable - OpenAI API limit")
            else:
                response.failure(f"Unexpected status: {response.status_code}")

    @task(4)
    def health_check(self):
        """Basic health check to verify API availability"""
        with self.client.get("/api/health", name="API Health Check") as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Health check failed: {response.status_code}")

    def on_stop(self):
        """Cleanup when user stops"""
        if hasattr(self, 'auth_token') and self.auth_token:
            # Optional: logout or cleanup
            pass

# Custom scenarios for different load patterns
class LightImageLoad(ImageGenerationAPIUser):
    """Light load - simulates casual users"""
    wait_time = between(5, 15)
    weight = 3

class HeavyImageLoad(ImageGenerationAPIUser):
    """Heavy load - simulates power users doing batch operations"""
    wait_time = between(1, 3)
    weight = 1
    
    @task(5)
    def intensive_batch_generation(self):
        """Power user doing multiple batch generations"""
        for i in range(3):
            self.batch_generate_storyboards()
            time.sleep(1)