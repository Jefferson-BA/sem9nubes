const API = 'http://localhost:3000';
const MAX_SIZE_MB = 5;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

document.getElementById('uploadBtn').addEventListener('click', async () => {
  const file = document.getElementById('file').files[0];
  const statusEl = document.getElementById('status');
  
  if (!file) return alert('Selecciona un archivo primero');

  if (!ALLOWED.includes(file.type)) return alert('Tipo de archivo no permitido. Solo JPG, PNG o WEBP.');
  if (file.size > MAX_SIZE_MB * 1024 * 1024) return alert('El archivo es demasiado grande (Máx 5MB).');

  statusEl.textContent = 'Solicitando permiso seguro a AWS...';

  try {
    const res = await fetch(`${API}/api/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size
      })
    });
    
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al pedir URL');
    }
    
    const { uploadUrl } = await res.json();

    statusEl.textContent = 'Subiendo directamente a S3...';

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file
    });

    if (uploadRes.ok) {
        statusEl.textContent = '¡Subida completa exitosamente!';
        document.getElementById('file').value = ''; // Limpiar input
        loadGallery();
    } else {
        throw new Error('Falló la subida a S3 (Revisa CORS)');
    }
  } catch (err) {
      statusEl.textContent = 'Error: ' + err.message;
      console.error(err);
  }
});

async function loadGallery() {
  const gallery = document.getElementById('gallery');
  gallery.innerHTML = '<p>Cargando imágenes...</p>';
  
  try {
      const res = await fetch(`${API}/api/images`);
      const items = await res.json();
      
      if (items.length === 0) {
          gallery.innerHTML = '<p>No hay imágenes aún.</p>';
          return;
      }

      gallery.innerHTML = items.map(i =>
        `<div class="card">
          <img src="${i.url}" alt="Imagen de S3">
          <p>Tamaño: ${(i.size / 1024).toFixed(1)} KB</p>
          <button onclick="del('${encodeURIComponent(i.key)}')">Eliminar de S3</button>
        </div>`
      ).join('');
  } catch (err) {
      gallery.innerHTML = '<p>Error cargando la galería.</p>';
  }
}

async function del(key) {
  if (!confirm('¿Seguro que deseas eliminar esta imagen de forma permanente?')) return;
  await fetch(`${API}/api/images/${key}`, { method: 'DELETE' });
  loadGallery();
}

// Cargar la galería al iniciar
loadGallery();