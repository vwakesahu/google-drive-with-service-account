const fs = require("fs");
const { google } = require("googleapis");

const apikeys = require("./apikeys.json");
const SCOPE = ["https://www.googleapis.com/auth/drive"];

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

async function uploadFile(authClient) {
  const drive = google.drive({ version: "v3", auth: authClient });

  var fileMetaData = {
    name: "driveVideoUpload.mp4",
    parents: ["1J-J1coTWOA3YoTWLj1ZIfDjSZYoyc2fm"],
  };

  const media = {
    body: fs.createReadStream("video.mp4"),
    mimeType: "video/mp4",
  };

  try {
    const file = await drive.files.create({
      resource: fileMetaData,
      media: media,
      fields: "id",
    });

    const fileId = file.data.id;
    console.log(`File ID: ${fileId}`);

    // Set permissions to make the file public
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    // Get the shareable link
    const result = await drive.files.get({
      fileId: fileId,
      fields: "webViewLink, webContentLink",
    });

    console.log(`Shareable link: ${result.data.webViewLink}`);
    console.log(`Downloadable link: ${result.data.webContentLink}`);

    return result.data;

  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
}

authorize().then(uploadFile).catch(error => console.error("Error:", error));
