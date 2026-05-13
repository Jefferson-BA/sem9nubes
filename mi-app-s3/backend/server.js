require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { S3Client, PutObjectCommand, GetObjectCommand,
        DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// Se conecta a AWS usando las credenciales de tu archivo .env
const s3 = new S3Client({ region: process.env.AWS_REGION });
const BUCKET = process.env.S3_BUCKET;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 5;

// 1) Generar presigned URL para subir (Válida por 5 minutos)
app.post('/api/upload-url', async (req, res) => {
  const { filename, contentType, sizeBytes } = req.body;

  if (!ALLOWED_TYPES.includes(contentType)) {
    return res.status(400).json({ error: 'Tipo de archivo no permitido' });
  }
  if (sizeBytes > MAX_SIZE_MB * 1024 * 1024) {
    return res.status(400).json({ error: 'Archivo demasiado grande' });
  }

  // Generar nombre seguro y único
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `originales/${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeName}`;

const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType
    // Borramos la línea de ServerSideEncryption
  });

  const url = await getSignedUrl(s3, cmd, { expiresIn: 300 });
  res.json({ uploadUrl: url, key });
});

// 2) Listar imagenes con presigned URLs de visualizacion (Válidas por 15 minutos)
app.get('/api/images', async (req, res) => {
  const list = await s3.send(new ListObjectsV2Command({
    Bucket: BUCKET, Prefix: 'originales/'
  }));

  const items = await Promise.all((list.Contents || []).map(async obj => {
    // No listamos carpetas vacías
    if (obj.Size === 0) return null; 

    const url = await getSignedUrl(s3,
      new GetObjectCommand({ Bucket: BUCKET, Key: obj.Key }),
      { expiresIn: 900 }
    );
    return { key: obj.Key, size: obj.Size, lastModified: obj.LastModified, url };
  }));

  res.json(items.filter(item => item !== null));
});

// 3) Eliminar imagen
app.delete('/api/images/:key', async (req, res) => {
  await s3.send(new DeleteObjectCommand({
    Bucket: BUCKET, Key: req.params.key
  }));
  res.json({ deleted: true });
});

app.listen(process.env.PORT, () =>
  console.log(`API escuchando en :${process.env.PORT}`)
);