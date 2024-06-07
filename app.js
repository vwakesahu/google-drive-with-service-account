const fs = require("fs");
const { google } = require("googleapis");
const axios = require("axios");
const apikeys = require("./apikeys.json");

const SCOPE = ["https://www.googleapis.com/auth/drive"];
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB

async function authorize() {
  const jwtClient = new google.auth.JWT(
    apikeys.client_email,
    null,
    apikeys.private_key,
    SCOPE
  );

  await jwtClient.authorize();
  return jwtClient;
}

async function createResumableSession(authClient, fileMetaData) {
  const headers = {
    Authorization: `Bearer ${authClient.credentials.access_token}`,
    "Content-Type": "application/json; charset=UTF-8",
    "X-Upload-Content-Type": "video/mp4",
  };

  const response = await axios.post(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
    fileMetaData,
    { headers }
  );

  return response.headers.location;
}

async function uploadFileInChunks(uploadUrl, authClient) {
  const filePath = "video.mp4";
  const fileSize = fs.statSync(filePath).size;
  const stream = fs.createReadStream(filePath, { highWaterMark: CHUNK_SIZE });

  let uploadedBytes = 0;
  let chunkIndex = 0;

  for await (const chunk of stream) {
    const rangeStart = uploadedBytes;
    const rangeEnd = uploadedBytes + chunk.length - 1;
    const contentRange = `bytes ${rangeStart}-${rangeEnd}/${fileSize}`;

    const headers = {
      "Content-Length": chunk.length,
      "Content-Range": contentRange,
      Authorization: `Bearer ${authClient.credentials.access_token}`,
    };

    try {
      const response = await axios.put(uploadUrl, chunk, {
        headers,
        validateStatus: function (status) {
          return (status >= 200 && status < 300) || status === 308;
        },
      });

      if (response.status === 308) {
        console.log(`Chunk ${chunkIndex}: Received 308, continuing upload...`);
      }

      uploadedBytes += chunk.length;
      chunkIndex++;
      const percentCompleted = Math.round((uploadedBytes / fileSize) * 100);
      console.log(`Chunk ${chunkIndex}: Upload Progress: ${percentCompleted}%`);
    } catch (error) {
      console.error(`Error uploading chunk ${chunkIndex}:`, error);
      throw error;
    }
  }
}

async function main() {
  try {
    const authClient = await authorize();

    const fileMetaData = {
      name: "mydrivevideo.mp4",
      parents: ["1J-J1coTWOA3YoTWLj1ZIfDjSZYoyc2fm"],
    };

    const uploadUrl = await createResumableSession(authClient, fileMetaData);
    console.log(`Resumable session created, Upload URL: ${uploadUrl}`);

    await uploadFileInChunks(uploadUrl, authClient);

    console.log("File uploaded successfully.");
  } catch (error) {
    console.error("Error during authorization or file upload:", error);
  }
}

main();
