# Main Locust configuration file
# This imports the image generation test classes

from locust import HttpUser, task, between
import time
import json
import random

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

    @task(4)
    def health_check(self):
        """Basic health check to verify API availability"""
        with self.client.get("/api/health", name="API Health Check") as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Health check failed: {response.status_code}")

# Default user class
User = ImageGenerationAPIUser