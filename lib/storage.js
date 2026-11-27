const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-1',
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true,
});

const DEFAULT_BUCKET = 'assets';

async function uploadFile(key, body, contentType = 'application/octet-stream') {
  const command = new PutObjectCommand({
    Bucket: DEFAULT_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  return await s3.send(command);
}

async function getPresignedUrl(key, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: DEFAULT_BUCKET,
    Key: key,
  });
  return await getSignedUrl(s3, command, { expiresIn });
}

module.exports = {
  s3,
  uploadFile,
  getPresignedUrl,
  DEFAULT_BUCKET,
};
