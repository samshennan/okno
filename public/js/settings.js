// Current settings state
let settings = {
  interval: 30,
  displayMode: 'cover',
  onThisDay: false,
  portraitPairs: false,
  transitionTime: 1,
  kenBurns: true,
  blurredBackground: true,
  showPhotoDate: true,
  showClock: false,
};
let donationUrl = null;

// Load current config from server
async function loadSettings() {
  try {
    const res = await fetch('/api/config');
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    if (res.ok) {
      const config = await res.json();
      settings = { ...settings, ...config };
      applySettingsToUI();
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

// Apply settings state to UI controls
function applySettingsToUI() {
  // Interval buttons
  document.querySelectorAll('#intervalGroup button').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.value) === settings.interval);
  });

  // Display mode buttons
  document.querySelectorAll('#displayModeGroup button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === settings.displayMode);
  });

  // Transition time buttons
  document.querySelectorAll('#transitionTimeGroup button').forEach(btn => {
    btn.classList.toggle('active', parseFloat(btn.dataset.value) === settings.transitionTime);
  });

  // Toggles
  document.getElementById('onThisDay').checked = settings.onThisDay;
  document.getElementById('portraitPairs').checked = settings.portraitPairs;
  document.getElementById('kenBurns').checked = settings.kenBurns;
  document.getElementById('blurredBackground').checked = settings.blurredBackground;
  document.getElementById('showPhotoDate').checked = settings.showPhotoDate;
  document.getElementById('showClock').checked = settings.showClock;
}

// UI handlers
function setInterval_(seconds) {
  settings.interval = seconds;
  document.querySelectorAll('#intervalGroup button').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.value) === seconds);
  });
}

function setDisplayMode_(mode) {
  settings.displayMode = mode;
  document.querySelectorAll('#displayModeGroup button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === mode);
  });
}

function setTransitionTime_(seconds) {
  settings.transitionTime = seconds;
  document.querySelectorAll('#transitionTimeGroup button').forEach(btn => {
    btn.classList.toggle('active', parseFloat(btn.dataset.value) === seconds);
  });
}

// Save to server
async function saveSettings() {
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });

    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }

    if (res.ok) {
      const updated = await res.json();
      settings = { ...settings, ...updated };
      showToast('Settings saved');
    } else {
      const err = await res.json();
      showToast('Error: ' + (err.error || 'Failed to save'));
    }
  } catch (err) {
    console.error('Failed to save settings:', err);
    showToast('Error: Could not reach server');
  }
}

// Toast notification
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2500);
}

// Fetch On This Day photo count for today
async function fetchOnThisDayCount() {
  try {
    const res = await fetch('/api/photo/random?onThisDay=true');
    if (res.ok) {
      const count = res.headers.get('X-Photo-OnThisDayCount');
      if (count) {
        document.getElementById('onThisDayDesc').textContent =
          `${count} photo${count === '1' ? '' : 's'} from today across all years`;
      }
    } else if (res.status === 404) {
      document.getElementById('onThisDayDesc').textContent =
        'No photos from today in your library';
    }
  } catch {
    // Silently fail - description stays at default
  }
}

// Fetch portrait photo count from health endpoint
async function fetchPortraitCount() {
  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      const health = await res.json();
      const count = health.cache?.portraitCount;
      if (count !== undefined && count !== null) {
        document.getElementById('portraitPairsDesc').textContent =
          `${count} portrait photo${count === 1 ? '' : 's'} available for pairing`;
      }
    }
  } catch {
    // Silently fail - description stays at default
  }
}

// Check auth status: redirect if not authenticated, show support section if authenticated
async function checkAuthStatus() {
  try {
    const res = await fetch('/auth/status');
    const data = await res.json();
    if (data.authenticated) {
      donationUrl = data.donationUrl || null;
      if (donationUrl) {
        document.getElementById('supportLink').href = donationUrl;
        document.getElementById('supportSection').hidden = false;
      }
    } else {
      // Safety net: server-side requireAuth already redirects,
      // but handle the edge case where session expires while page is open
      window.location.href = '/login';
      return;
    }
  } catch (e) {
    // Silently fail -- donate section stays hidden
  }
}

// Hidden photos management
let hiddenPhotoCount = 0;

async function fetchHiddenPhotos() {
  try {
    const res = await fetch('/api/photo/hidden');
    if (res.status === 401) return;
    if (!res.ok) return;

    const data = await res.json();
    hiddenPhotoCount = data.count || 0;

    if (hiddenPhotoCount > 0) {
      document.getElementById('hiddenPhotosSection').hidden = false;
      document.getElementById('hiddenPhotosDesc').textContent =
        `${hiddenPhotoCount} hidden photo${hiddenPhotoCount === 1 ? '' : 's'}`;
      document.getElementById('unhideAllBtn').hidden = false;

      const grid = document.getElementById('hiddenPhotosGrid');
      grid.innerHTML = '';

      data.items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'hidden-photo-item';
        el.dataset.id = item.id;

        const img = document.createElement('img');
        img.src = `/api/photo/thumbnail/${item.id}`;
        img.alt = 'Hidden photo';
        img.loading = 'lazy';

        const btn = document.createElement('button');
        btn.className = 'restore-btn';
        btn.title = 'Restore photo';
        btn.innerHTML = '<i data-lucide="eye" class="inline-icon-sm"></i>';
        btn.addEventListener('click', () => restorePhoto(item.id, el));

        el.appendChild(img);
        el.appendChild(btn);
        grid.appendChild(el);
      });

      // Re-render Lucide icons for the new restore buttons
      lucide.createIcons();
    } else {
      document.getElementById('hiddenPhotosSection').hidden = true;
    }
  } catch (err) {
    console.error('Failed to fetch hidden photos:', err);
  }
}

async function restorePhoto(mediaItemId, gridItemElement) {
  try {
    const res = await fetch(`/api/photo/unhide/${mediaItemId}`, { method: 'POST' });
    if (!res.ok) {
      showToast('Failed to restore photo');
      return;
    }

    // Fade out and remove
    gridItemElement.classList.add('is-removing');
    setTimeout(() => gridItemElement.remove(), 300);

    hiddenPhotoCount--;
    if (hiddenPhotoCount > 0) {
      document.getElementById('hiddenPhotosDesc').textContent =
        `${hiddenPhotoCount} hidden photo${hiddenPhotoCount === 1 ? '' : 's'}`;
    } else {
      document.getElementById('hiddenPhotosSection').hidden = true;
    }

    showToast('Photo restored');
  } catch (err) {
    console.error('Failed to restore photo:', err);
    showToast('Error restoring photo');
  }
}

async function unhideAllPhotos() {
  if (!confirm(`Unhide all ${hiddenPhotoCount} photo${hiddenPhotoCount === 1 ? '' : 's'}? They'll appear in your slideshow again.`)) {
    return;
  }

  try {
    const res = await fetch('/api/photo/unhide-all', { method: 'POST' });
    if (!res.ok) {
      showToast('Failed to unhide photos');
      return;
    }

    document.getElementById('hiddenPhotosGrid').innerHTML = '';
    document.getElementById('hiddenPhotosSection').hidden = true;
    hiddenPhotoCount = 0;

    showToast('All photos restored');
  } catch (err) {
    console.error('Failed to unhide all photos:', err);
    showToast('Error restoring photos');
  }
}

// Logout button handler
document.getElementById('logout-btn').addEventListener('click', async () => {
  try {
    await fetch('/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  } catch (error) {
    // Even on network error, try to redirect
    window.location.href = '/login';
  }
});

document.getElementById('intervalGroup').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-value]');
  if (!button) return;
  setInterval_(parseInt(button.dataset.value, 10));
});

document.getElementById('displayModeGroup').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-value]');
  if (!button) return;
  setDisplayMode_(button.dataset.value);
});

document.getElementById('transitionTimeGroup').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-value]');
  if (!button) return;
  setTransitionTime_(parseFloat(button.dataset.value));
});

document.addEventListener('change', (event) => {
  const settingKey = event.target.dataset.setting;
  if (!settingKey) return;
  settings[settingKey] = event.target.checked;
});

document.getElementById('unhideAllBtn').addEventListener('click', unhideAllPhotos);
document.getElementById('backBtn').addEventListener('click', () => {
  window.location.href = '/';
});
document.getElementById('saveBtn').addEventListener('click', saveSettings);

// Initialize
loadSettings();
fetchOnThisDayCount();
fetchPortraitCount();
fetchHiddenPhotos();
checkAuthStatus();
lucide.createIcons();
