/**
 * Safe response handling utilities to prevent "body stream already read" errors
 * in deployment environments
 */

export async function safeResponseHandler(response: Response): Promise<any> {
  try {
    // Clone the response to avoid "body stream already read" errors
    const responseClone = response.clone();
    
    if (!response.ok) {
      let errorMessage = `Server error: ${response.status}`;
      try {
        // Use original response for error handling
        const text = await response.text();
        if (text.trim()) {
          try {
            const parsed = JSON.parse(text);
            errorMessage = parsed.message || parsed.error || errorMessage;
          } catch {
            // If JSON parsing fails, use the text as error message
            errorMessage = text || errorMessage;
          }
        }
      } catch (textError) {
        console.error('Failed to read error response:', textError);
      }
      throw new Error(errorMessage);
    }
    
    // Use cloned response for success handling
    const text = await responseClone.text();
    if (!text.trim()) {
      throw new Error('Server returned empty response');
    }
    
    try {
      return JSON.parse(text);
    } catch (jsonError) {
      console.error('Failed to parse response as JSON:', jsonError);
      console.error('Response text was:', text.substring(0, 200));
      throw new Error('Server returned invalid response format');
    }
  } catch (error) {
    console.error('Safe response handler error:', error);
    throw error;
  }
}

export async function safeFetch(url: string, options?: RequestInit): Promise<any> {
  try {
    const response = await fetch(url, options);
    return await safeResponseHandler(response);
  } catch (error) {
    console.error('Safe fetch error:', error);
    throw error;
  }
}