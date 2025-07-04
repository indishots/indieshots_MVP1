# Main Locust configuration file
# This imports the image generation test classes

from locust_image_api import ImageGenerationAPIUser, LightImageLoad, HeavyImageLoad

# Default user class if running with simple 'locust' command
User = ImageGenerationAPIUser