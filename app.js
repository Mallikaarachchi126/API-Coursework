const state = {
  token: localStorage.getItem('slbfeToken') || '',
  user: JSON.parse(localStorage.getItem('slbfeUser') || 'null')
};

const output = document.querySelector('#output');
const sessionStatus = document.querySelector('#sessionStatus');
const kpiCitizens = document.querySelector('#kpiCitizens');
const kpiVerified = document.querySelector('#kpiVerified');
const kpiComplaints = document.querySelector('#kpiComplaints');
const kpiDocuments = document.querySelector('#kpiDocuments');

function setOutput(data) {
  output.textContent = JSON.stringify(data, null, 2);
}

function setKpis(data) {
  if (!data?.citizens) return;
  kpiCitizens.textContent = data.citizens.total;
  kpiVerified.textContent = `${data.citizens.verifiedRate}%`;
  kpiComplaints.textContent = data.complaints.open;
  kpiDocuments.textContent = data.documents.total;
}

function updateSession() {
  sessionStatus.textContent = state.user
    ? `${state.user.fullName} (${state.user.role})`
    : 'Not signed in';
}

function saveSession(data) {
  state.token = data.token;
  state.user = data.user;
  localStorage.setItem('slbfeToken', data.token);
  localStorage.setItem('slbfeUser', JSON.stringify(data.user));
  updateSession();
}

function clearSession() {
  state.token = '';
  state.user = null;
  localStorage.removeItem('slbfeToken');
  localStorage.removeItem('slbfeUser');
  updateSession();
  setOutput({ message: 'Logged out' });
}

function formJson(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function compactObject(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== '' && value !== null && value !== undefined)
  );
}

async function api(path, options = {}) {
  const headers = options.headers || {};
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw data;
  }

  return data;
}

function handleForm(selector, handler) {
  document.querySelector(selector).addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const data = await handler(event.currentTarget);
      setOutput(data);
    } catch (error) {
      setOutput({ error: error.message || 'Request failed', details: error });
    }
  });
}

document.querySelectorAll('[data-auth-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    const tab = button.dataset.authTab;
    document.querySelectorAll('[data-auth-tab]').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    document.querySelector('#loginForm').classList.toggle('hidden', tab !== 'login');
    document.querySelector('#registerForm').classList.toggle('hidden', tab !== 'register');
  });
});

document.querySelector('#logoutBtn').addEventListener('click', clearSession);

document.querySelector('#healthBtn').addEventListener('click', async () => {
  try {
    setOutput(await api('/api/health'));
  } catch (error) {
    setOutput({ error: error.message || 'Health check failed', details: error });
  }
});

document.querySelector('#overviewBtn').addEventListener('click', async () => {
  try {
    const data = await api('/api/analytics/overview');
    setKpis(data.data);
    setOutput(data);
  } catch (error) {
    setOutput({ error: error.message || 'Analytics request failed', details: error });
  }
});

document.querySelector('#topSkillsBtn').addEventListener('click', async () => {
  try {
    setOutput(await api('/api/analytics/top-qualifications'));
  } catch (error) {
    setOutput({ error: error.message || 'Top skills request failed', details: error });
  }
});

document.querySelectorAll('[data-login]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelector('#loginForm input[name="email"]').value = button.dataset.login;
    document.querySelector('#loginForm input[name="password"]').value = 'Password123!';
  });
});

handleForm('#loginForm', async (form) => {
  const data = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(formJson(form))
  });
  saveSession(data);
  return data;
});

handleForm('#registerForm', async (form) => {
  const body = compactObject(formJson(form));
  const data = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(body)
  });
  saveSession(data);
  return data;
});

handleForm('#profileSearchForm', async (form) => {
  const { nid } = formJson(form);
  return api(`/api/citizens/${encodeURIComponent(nid)}`);
});

handleForm('#profileUpdateForm', async (form) => {
  const raw = compactObject(formJson(form));
  const body = {
    address: raw.address,
    profession: raw.profession,
    currentLatitude: raw.currentLatitude,
    currentLongitude: raw.currentLongitude,
    qualifications: raw.qualificationName
      ? [
          {
            name: raw.qualificationName,
            institution: raw.institution,
            yearCompleted: raw.yearCompleted
          }
        ]
      : []
  };

  return api(`/api/citizens/${encodeURIComponent(raw.nid)}/profile`, {
    method: 'PUT',
    body: JSON.stringify(compactObject(body))
  });
});

handleForm('#documentForm', async (form) => {
  const formData = new FormData(form);
  const nid = formData.get('nid');
  formData.delete('nid');
  return api(`/api/citizens/${encodeURIComponent(nid)}/documents`, {
    method: 'POST',
    body: formData
  });
});

handleForm('#contactForm', async (form) => {
  const body = compactObject(formJson(form));
  const nid = body.nid;
  delete body.nid;
  return api(`/api/citizens/${encodeURIComponent(nid)}/contacts`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
});

handleForm('#verifyForm', async (form) => {
  const body = compactObject(formJson(form));
  const nid = body.nid;
  delete body.nid;
  body.isVerified = body.isVerified === 'true';
  return api(`/api/citizens/${encodeURIComponent(nid)}/verify`, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
});

handleForm('#candidateSearchForm', async (form) => {
  const params = new URLSearchParams(compactObject(formJson(form)));
  params.set('page', '1');
  params.set('limit', '10');
  return api(`/api/citizens/find?${params}`);
});

handleForm('#deactivateForm', async (form) => {
  const { nid } = formJson(form);
  return api(`/api/citizens/${encodeURIComponent(nid)}`, { method: 'DELETE' });
});

handleForm('#complaintForm', async (form) => {
  return api('/api/complaints', {
    method: 'POST',
    body: JSON.stringify(formJson(form))
  });
});

handleForm('#complaintsListForm', async (form) => {
  const params = new URLSearchParams(compactObject(formJson(form)));
  params.set('page', '1');
  params.set('limit', '10');
  return api(`/api/complaints?${params}`);
});

handleForm('#replyForm', async (form) => {
  const body = compactObject(formJson(form));
  const id = body.id;
  delete body.id;
  return api(`/api/complaints/${encodeURIComponent(id)}/reply`, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
});

updateSession();
