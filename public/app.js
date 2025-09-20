// Client-side app logic for index.html
async function apiFetch(path, opts = {}) {
  const res = await fetch(path, Object.assign({ headers: { 'Accept': 'application/json' } }, opts));
  return res;
}

function el(q) { return document.querySelector(q); }

async function loadRecent() {
  try {
    const res = await apiFetch('/api/feedback');
    const j = await res.json();
    const out = document.getElementById('list');
    if (!j.ok || !j.data.length) return out.innerHTML = '<em>No feedback yet.</em>';
    out.innerHTML = '';
    j.data.slice(0, 10).forEach(item => {
      const d = document.createElement('div');
      d.className = 'entry';
      d.innerHTML = `<strong>${escapeHtml(item.name)}</strong> · ${item.rating} / 5
        <div class="meta">${new Date(item.createdAt).toLocaleString()}</div>
        <p>${escapeHtml(item.comments || '<No comments>').replace(/\n/g,'<br>')}</p>`;
      out.appendChild(d);
    });
  } catch (e) {
    document.getElementById('list').textContent = 'Error loading';
  }
}

function escapeHtml(s){ return String(s)
  .replaceAll('&','&amp;')
  .replaceAll('<','&lt;')
  .replaceAll('>','&gt;')
  .replaceAll('"','&quot;')
  .replaceAll("'",'&#39;'); }

// Local preview stored in sessionStorage for quick view before/after submit
function saveLocalPreview(item){
  const arr = JSON.parse(sessionStorage.getItem('preview')||'[]');
  arr.unshift(item);
  sessionStorage.setItem('preview', JSON.stringify(arr.slice(0,20)));
}
function renderLocalPreview(){
  const arr = JSON.parse(sessionStorage.getItem('preview')||'[]');
  const out = document.getElementById('list');
  if (!arr.length) return loadRecent();
  out.innerHTML = '';
  arr.forEach(item => {
    const d = document.createElement('div');
    d.className = 'entry';
    d.innerHTML = `<strong>${escapeHtml(item.name)}</strong> · ${item.rating} / 5
      <div class="meta">local preview · ${new Date(item.createdAt).toLocaleString()}</div>
      <p>${escapeHtml(item.comments||'<No comments>').replace(/\n/g,'<br>')}</p>`;
    out.appendChild(d);
  });
}

el('#clearLocal').addEventListener('click', e => { sessionStorage.removeItem('preview'); renderLocalPreview(); });

el('#feedbackForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = ev.currentTarget;
  const data = {
    name: f.name.value.trim(),
    email: f.email.value.trim(),
    rating: Number(f.rating.value),
    comments: f.comments.value.trim()
  };
  if (!data.name || !data.email || !data.rating) return alert('Please fill required fields');
  const preview = Object.assign({ id: 'local-' + Date.now(), createdAt: new Date().toISOString() }, data);
  saveLocalPreview(preview);
  renderLocalPreview();

  try {
    const res = await apiFetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const j = await res.json();
    if (!j.ok) return alert('Error: ' + (j.error || 'unknown'));
    f.reset();
    sessionStorage.removeItem('preview');
    loadRecent();
    alert('Thanks — your feedback has been submitted.');
  } catch (e) {
    alert('Network error — your feedback saved to local preview.');
  }
});

// initial
renderLocalPreview();
loadRecent();

