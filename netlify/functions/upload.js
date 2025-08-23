// netlify/functions/upload.js
const fetch = require('node-fetch'); // Use node-fetch for server-side requests
const FormData = require('form-data');

exports.handler = async (event) => {
  // Get the secret API key from the environment variables
  const IMGBB_API_KEY = process.env.IMGBB_API_KEY;

  if (!IMGBB_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "ImgBB API key is not configured." }),
    };
  }

  try {
    // The frontend will send the image as a Base64 encoded string in the body
    const { imageBase64 } = JSON.parse(event.body);

    if (!imageBase64) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No image data provided." }),
      };
    }
    
    // Create a FormData object to send to ImgBB
    const formData = new FormData();
    formData.append("key", IMGBB_API_KEY);
    // ImgBB API accepts a base64 encoded string for the image
    formData.append("image", imageBase64);

    const response = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "ImgBB upload failed");
    }

    const result = await response.json();

    // Send the successful response back to the frontend
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };

  } catch (error) {
    console.error("Error in upload function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};