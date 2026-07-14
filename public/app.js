const accessForm = document.getElementById('access-form');
const signalForm = document.getElementById('signal-form');
const authForm = document.getElementById('auth-form');
const registerBtn = document.getElementById('register-btn');
const accessResult = document.getElementById('access-result');
const signalResult = document.getElementById('signal-result');
const authResult = document.getElementById('auth-result');
const requestList = document.getElementById('request-list');
const canvas = document.getElementById('wave-canvas');
const ctx = canvas.getContext('2d');
let authToken = '';

async function requestJson(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  const response = await fetch(url, {
    headers,
    ...options
  });
  return response.json();
}

function drawWaveform(signal) {
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#74f2d2');
  gradient.addColorStop(1, '#4b7cff');
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 2.5;
  ctx.beginPath();

  signal.waveform.forEach((value, index) => {
    const x = (index / (signal.waveform.length - 1)) * width;
    const y = height / 2 - value * (height * 0.35);
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();
}

async function refreshState() {
  try {
    const payload = await requestJson('/api/state');
    drawWaveform(payload.state);
    signalResult.innerHTML = `
      <strong>Aktif titreşim:</strong> genlik ${payload.state.amplitude.toFixed(2)}, frekans ${payload.state.frequency.toFixed(1)}, rezonans ${payload.state.resonance}<br/>
      <strong>Mod:</strong> ${payload.state.intent}<br/>
      <strong>Güncellendi:</strong> ${new Date(payload.state.updatedAt).toLocaleString('tr-TR')}
    `;

    const requestsPayload = await requestJson('/api/requests');
    if (!requestsPayload.requests.length) {
      requestList.innerHTML = '<div class="request-item">Henüz izin isteği yok.</div>';
      return;
    }

    requestList.innerHTML = requestsPayload.requests.map(item => `
      <div class="request-item">
        <strong>${item.requester}</strong> → ${item.target}<br/>
        Tür: ${item.scope} · Durum: ${item.status}<br/>
        Sebep: ${item.reason}
      </div>
    `).join('');
  } catch (error) {
    signalResult.innerHTML = 'Durum yüklenemedi.';
    requestList.innerHTML = '<div class="request-item">Panel yüklenemedi.</div>';
  }
}

authForm.addEventListener('submit', async event => {
  event.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const mode = event.submitter?.dataset.mode || 'login';

  const response = await requestJson(mode === 'login' ? '/api/login' : '/api/register', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });

  if (response.success) {
    if (mode === 'login') {
      authToken = response.token;
      authResult.innerHTML = `Giriş başarılı. Hoş geldin <strong>${response.username}</strong>.`;
    } else {
      authResult.innerHTML = `Kayıt başarılı. Şimdi giriş yapabilirsiniz.`;
    }
    await refreshState();
  } else {
    authResult.innerHTML = response.error || 'İşlem başarısız.';
  }
});

registerBtn.addEventListener('click', async () => {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const response = await requestJson('/api/register', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });

  if (response.success) {
    authResult.innerHTML = 'Kayıt başarılı. Şimdi giriş yapabilirsiniz.';
  } else {
    authResult.innerHTML = response.error || 'Kayıt başarısız.';
  }
});

accessForm.addEventListener('submit', async event => {
  event.preventDefault();
  const payload = {
    requester: document.getElementById('requester').value,
    target: document.getElementById('target').value,
    scope: document.getElementById('scope').value,
    reason: document.getElementById('reason').value
  };

  const response = await requestJson('/api/request-access', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  accessResult.innerHTML = `İzin talebi oluşturuldu. Kimlik: <strong>${response.request.id}</strong><br/>Durum: <strong>${response.request.status}</strong>`;
  accessForm.reset();
  await refreshState();
});

signalForm.addEventListener('submit', async event => {
  event.preventDefault();
  const payload = {
    amplitude: Number(document.getElementById('amplitude').value),
    frequency: Number(document.getElementById('frequency').value),
    intent: document.getElementById('intent').value
  };

  const response = await requestJson('/api/signal', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  drawWaveform(response.signal);
  signalResult.innerHTML = `
    <strong>Güncellendi:</strong> genlik ${response.signal.amplitude.toFixed(2)}, frekans ${response.signal.frequency.toFixed(1)}, rezonans ${response.signal.resonance}<br/>
    <strong>Mod:</strong> ${response.signal.intent}
  `;
  await refreshState();
});

refreshState();
