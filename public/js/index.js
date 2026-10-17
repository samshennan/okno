const statusEl = document.getElementById('status');
const actionsEl = document.getElementById('actions');
const pickerStatusEl = document.getElementById('pickerStatus');
const logoEl = document.getElementById('oknoLogo');

let pickerWindow = null;
let pollInterval = null;
let pickerCountdownInterval = null;
let donationUrl = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

// Picker session countdown timer
// Parses timeout string (e.g. "600s") and displays a live countdown
function startPickerCountdown(timeoutStr) {
  // Clear any existing countdown
  if (pickerCountdownInterval) {
    clearInterval(pickerCountdownInterval);
    pickerCountdownInterval = null;
  }

  // Parse timeout string (format: "600s"), default 600 seconds
  const match = String(timeoutStr || '').match(/^(\d+)s$/);
  let remaining = match ? parseInt(match[1], 10) : 600;

  // Create countdown element
  const el = document.createElement('div');
  el.id = 'pickerCountdown';
  el.className = 'picker-countdown';

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function update() {
    if (remaining <= 0) {
      el.classList.add('warning');
      el.textContent = 'Session expired. Please start a new session.';
      clearInterval(pickerCountdownInterval);
      pickerCountdownInterval = null;
      return;
    }

    el.textContent = 'Session expires in ' + formatTime(remaining);

    if (remaining <= 60) {
      el.classList.add('warning');
    }

    remaining--;
  }

  // Initial render
  update();

  // Update every second
  pickerCountdownInterval = setInterval(update, 1000);

  return { element: el, interval: pickerCountdownInterval };
}

// Clean up picker countdown interval
function clearPickerCountdown() {
  if (pickerCountdownInterval) {
    clearInterval(pickerCountdownInterval);
    pickerCountdownInterval = null;
  }
  const existing = document.getElementById('pickerCountdown');
  if (existing) existing.remove();
}

// Check authentication status on load
async function checkAuth() {
  try {
    const res = await fetch('/auth/status');
    const data = await res.json();
    donationUrl = data.donationUrl || null;

    if (data.authenticated) {
      // Hide hero copy when authenticated
      document.getElementById('heroContent').hidden = true;

      // Check if photos are cached
      const healthRes = await fetch('/api/health');
      const health = await healthRes.json();

      if (health.cache && health.cache.totalItems > 0) {
        statusEl.className = 'status authenticated';
        statusEl.textContent = `${health.cache.totalItems} photos ready`;
        actionsEl.innerHTML = `
          <div class="action-stack">
            <button class="primary" data-action="start-slideshow">Start Slideshow</button>
            <button class="secondary" data-action="open-picker">Refresh Photo Selection</button>
            <button class="destructive" data-action="sign-out">Sign Out</button>
          </div>
        `;
      } else {
        statusEl.hidden = true;
        actionsEl.innerHTML = `
          <div class="action-stack">
            <button class="primary" data-action="open-picker">Select Photos</button>
            <button class="destructive" data-action="sign-out">Sign Out</button>
          </div>
          <p class="support-note">Choose a set once, then let Okno quietly keep the frame running.</p>
        `;
      }
    } else {
      // Safety net: server-side requireAuth already redirects to /login,
      // but handle the edge case where this page loads without auth
      window.location.href = '/login';
      return;
    }
  } catch (error) {
    statusEl.className = 'status error';
    statusEl.textContent = '✗ Error checking authentication';
    console.error('Auth check failed:', error);
  }
}

async function openPicker() {
  try {
    // Clean up any previous countdown
    clearPickerCountdown();

    // Show loading state
    pickerStatusEl.className = 'picker-status visible';
    pickerStatusEl.innerHTML = '<div class="loading"></div> Creating picker session...';

    // Create picker session
    const res = await fetch('/api/picker/start', { method: 'POST' });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to create picker session');
    }

    // Detect if mobile/iPad (tabs) or desktop (popups)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
      // iPad opens picker in new tab - show instructions
      pickerStatusEl.innerHTML = `
        <p>✓ Picker session created</p>
        <p class="picker-status-copy spaced">
          1. Tap the button below to open Google Photos<br>
          2. Select your photos and tap "Done"<br>
          3. Come back to this tab and tap "Check for Photos"
        </p>
        <button data-action="open-picker-window" data-picker-url="${escapeHtml(data.pickerUrl)}">Open Picker</button>
        <button class="picker-action-spaced" data-action="check-picker-complete" data-session-id="${escapeHtml(data.sessionId)}">Check for Photos</button>
      `;

      // Start countdown timer for session expiry
      const countdown = startPickerCountdown(data.timeout);
      pickerStatusEl.appendChild(countdown.element);
    } else {
      // Desktop - open popup and auto-detect close
      pickerStatusEl.innerHTML = `
        <p>Opening Google Photos Picker...</p>
        <p class="picker-status-copy">Select your photos, then close the picker window</p>
      `;

      // Start countdown timer for session expiry
      const countdown = startPickerCountdown(data.timeout);
      pickerStatusEl.appendChild(countdown.element);

      const width = 800;
      const height = 800;
      const left = (screen.width - width) / 2;
      const top = (screen.height - height) / 2;

      pickerWindow = window.open(
        data.pickerUrl,
        'GooglePhotosPicker',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Start polling for completion
      // pollInterval comes as "5s" string from Google API — parse to ms
      const pollMs = (() => {
        const match = String(data.pollInterval || '').match(/^(\d+)s$/);
        return match ? parseInt(match[1]) * 1000 : 5000;
      })();
      startPolling(data.sessionId, pollMs);
    }

  } catch (error) {
    clearPickerCountdown();
    pickerStatusEl.className = 'picker-status visible';
    pickerStatusEl.innerHTML = `
      <div class="feedback-error">✗ Error: ${escapeHtml(error.message)}</div>
    `;
    console.error('Picker error:', error);
  }
}

function startPolling(sessionId, interval) {
  pollInterval = setInterval(async () => {
    try {
      // Check if picker window was closed
      if (pickerWindow && pickerWindow.closed) {
        clearInterval(pollInterval);
        clearPickerCountdown();
        pickerStatusEl.innerHTML = '<div class="loading"></div> Fetching selected photos...';

        // Retry status checks — Google may need time to finalize after window close
        const MAX_RETRIES = 6;
        const RETRY_DELAY = 3000;
        let done = false;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          // Wait before checking (longer initial wait for Google to finalize)
          await new Promise(resolve => setTimeout(resolve, attempt === 1 ? 4000 : RETRY_DELAY));

          const statusRes = await fetch(`/api/picker/status/${sessionId}`);
          const status = await statusRes.json();
          console.log(`Picker status check ${attempt}/${MAX_RETRIES}:`, status);

          if (status.done) {
            done = true;
            break;
          }

          if (attempt < MAX_RETRIES) {
            pickerStatusEl.innerHTML = `<div class="loading"></div> Waiting for Google to finalize... (${attempt}/${MAX_RETRIES})`;
          }
        }

        if (done) {
          // Photos were selected, fetch them
          const completeRes = await fetch(`/api/picker/complete/${sessionId}`, {
            method: 'POST'
          });
          const result = await completeRes.json();

          if (!completeRes.ok) {
            throw new Error(result.error || 'Failed to fetch photos');
          }

          pickerStatusEl.innerHTML = `
              <div class="feedback-success">✓ Success! ${result.count} photos cached</div>
          `;

          // Refresh UI after 2 seconds
          setTimeout(() => {
            pickerStatusEl.className = 'picker-status';
            checkAuth();
          }, 2000);
        } else {
          // Window closed without selecting photos after all retries
          pickerStatusEl.innerHTML = `
              <div class="feedback-muted">Picker closed without selecting photos</div>
          `;
          setTimeout(() => {
            pickerStatusEl.className = 'picker-status';
          }, 3000);
        }
      }
    } catch (error) {
      clearInterval(pollInterval);
      clearPickerCountdown();
      pickerStatusEl.innerHTML = `
            <div class="feedback-error">✗ Error: ${escapeHtml(error.message)}</div>
      `;
      console.error('Polling error:', error);
    }
  }, interval);
}

// Manual check for picker completion (for iPad/mobile)
async function checkPickerComplete(sessionId) {
  try {
    clearPickerCountdown();
    pickerStatusEl.innerHTML = '<div class="loading"></div> Checking for photos...';

    // Retry status checks — Google may need time to finalize
    const MAX_RETRIES = 6;
    const RETRY_DELAY = 3000;
    let done = false;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      await new Promise(resolve => setTimeout(resolve, attempt === 1 ? 3000 : RETRY_DELAY));

      const statusRes = await fetch(`/api/picker/status/${sessionId}`);
      const status = await statusRes.json();
      console.log(`Mobile picker status check ${attempt}/${MAX_RETRIES}:`, status);

      if (status.done) {
        done = true;
        break;
      }

      if (attempt < MAX_RETRIES) {
        pickerStatusEl.innerHTML = `<div class="loading"></div> Waiting for Google to finalize... (${attempt}/${MAX_RETRIES})`;
      }
    }

    if (done) {
      // Photos were selected, fetch them
      pickerStatusEl.innerHTML = '<div class="loading"></div> Fetching selected photos...';

      const completeRes = await fetch(`/api/picker/complete/${sessionId}`, {
        method: 'POST'
      });
      const result = await completeRes.json();

      if (!completeRes.ok) {
        throw new Error(result.error || 'Failed to fetch photos');
      }

      pickerStatusEl.innerHTML = `
          <div class="feedback-success">✓ Success! ${result.count} photos cached</div>
      `;

      // Refresh UI after 2 seconds
      setTimeout(() => {
        pickerStatusEl.className = 'picker-status';
        checkAuth();
      }, 2000);
    } else {
      pickerStatusEl.innerHTML = `
          <div class="feedback-muted">No photos selected yet. Select photos and try again.</div>
      `;
      setTimeout(() => {
        pickerStatusEl.className = 'picker-status';
      }, 3000);
    }
  } catch (error) {
    pickerStatusEl.innerHTML = `
      <div class="feedback-error">✗ Error: ${escapeHtml(error.message)}</div>
    `;
    console.error('Check complete error:', error);
  }
}

// Sign out
async function signOut() {
  try {
    const res = await fetch('/auth/logout', { method: 'POST' });
    if (res.ok) {
      window.location.reload();
    } else {
      showFeedbackError('Sign out failed. Please try again.');
    }
  } catch (error) {
    console.error('Sign out error:', error);
    showFeedbackError('Sign out failed. Please try again.');
  }
}

// Initialize
checkAuth();

// Feedback Modal State
let feedbackType = null;
let uploadedFile = null;

function openFeedbackModal() {
  document.getElementById('feedbackModal').classList.add('visible');
  resetFeedbackModal();
}

function closeFeedbackModal() {
  document.getElementById('feedbackModal').classList.remove('visible');
  setTimeout(resetFeedbackModal, 300);
}

function resetFeedbackModal() {
  feedbackType = null;
  uploadedFile = null;
  document.getElementById('modalTitle').textContent = 'Share Your Feedback';
  document.getElementById('modalSubtitle').textContent = 'Help us improve Okno';
      document.getElementById('modalActions').classList.add('is-hidden');

      document.getElementById('modalBody').innerHTML = `
        <div class="type-selector">
          <div class="type-option" data-feedback-type="bug" role="button" tabindex="0">
            <div class="type-icon"><i data-lucide="bug"></i></div>
            <div class="type-label">Bug Report</div>
          </div>
          <div class="type-option" data-feedback-type="feature" role="button" tabindex="0">
            <div class="type-icon"><i data-lucide="sparkles"></i></div>
            <div class="type-label">Feature Request</div>
          </div>
          ${donationUrl ? `<div class="type-option" data-feedback-type="donation" role="button" tabindex="0">
            <div class="type-icon"><i data-lucide="heart"></i></div>
            <div class="type-label">Support Us</div>
          </div>` : ''}
    </div>
  `;
  lucide.createIcons();
}

function selectFeedbackType(type) {
  feedbackType = type;
      document.getElementById('modalActions').classList.remove('is-hidden');

  if (type === 'bug') {
    document.getElementById('modalTitle').textContent = 'Report a Bug';
    document.getElementById('modalSubtitle').textContent = 'Help us fix issues and improve stability';
    document.getElementById('submitBtn').textContent = 'Submit Bug Report';

    document.getElementById('modalBody').innerHTML = `
      <div class="form-group">
        <label class="form-label">What happened?</label>
        <textarea
          class="form-textarea"
          id="bugDescription"
          placeholder="Describe the issue you experienced..."
          required
        ></textarea>
      </div>

      <div class="form-group">
        <label class="form-label">Your email (optional)</label>
        <input
          type="email"
          class="form-input"
          id="userEmail"
          placeholder="your@email.com"
        />
            <p class="field-hint">
          We'll only use this to follow up on your report
        </p>
      </div>

      <div class="form-group">
        <label class="form-label">Screenshot (optional)</label>
            <div class="file-upload-area" data-action="choose-file" role="button" tabindex="0">
          <div class="file-upload-icon"><i data-lucide="paperclip"></i></div>
          <div class="file-upload-text">
            <strong>Click to upload</strong> or drag and drop<br>
                <span class="file-type-note">PNG, JPG up to 5MB</span>
          </div>
        </div>
        <input
          type="file"
              id="fileInput"
              class="file-upload-input"
              accept="image/*"
            />
        <div id="filePreview"></div>
      </div>
    `;
  } else if (type === 'feature') {
    document.getElementById('modalTitle').textContent = 'Request a Feature';
    document.getElementById('modalSubtitle').textContent = 'Share your ideas for new capabilities';
    document.getElementById('submitBtn').textContent = 'Submit Feature Request';

    document.getElementById('modalBody').innerHTML = `
      <div class="form-group">
        <label class="form-label">What would you like to see?</label>
        <textarea
          class="form-textarea"
          id="featureDescription"
          placeholder="Describe the feature you'd like..."
          required
        ></textarea>
      </div>

      <div class="form-group">
        <label class="form-label">Why would this be useful?</label>
        <textarea
          class="form-textarea"
          id="featureReason"
          placeholder="Help us understand the benefit..."
              class="form-textarea feature-reason"
        ></textarea>
      </div>

      <div class="form-group">
        <label class="form-label">Your email (optional)</label>
        <input
          type="email"
          class="form-input"
          id="userEmail"
          placeholder="your@email.com"
        />
            <p class="field-hint">
          Get notified when we launch new features
        </p>
      </div>
    `;
  } else if (type === 'donation') {
    if (!donationUrl) {
      closeFeedbackModal();
      showFeedbackError('Support links are not configured yet.');
      return;
    }
    document.getElementById('modalTitle').textContent = 'Support Okno';
    document.getElementById('modalSubtitle').textContent = 'Buy me a coffee';
        document.getElementById('modalActions').classList.add('is-hidden');

    document.getElementById('modalBody').innerHTML = `
      <div class="donation-content">
        <div class="donation-icon"><i data-lucide="coffee" class="icon-donation"></i></div>
        <p class="donation-text">
          Okno is a passion project built with love.<br>
          Your support means a lot!
        </p>

        <div class="donation-actions">
          <a href="${donationUrl}"
             target="_blank"
             rel="noopener noreferrer"
             class="plain-link">
            <button class="modal-btn modal-btn-primary modal-btn-tight">
              <i data-lucide="heart" class="icon-heart-inline"></i>
              Support
            </button>
          </a>
        </div>

        <p class="donation-note">
          Every contribution, no matter the size,<br>
          helps us build something meaningful.
        </p>
      </div>
    `;
  }

  lucide.createIcons();

  // Setup drag and drop for file upload
  const uploadArea = document.querySelector('.file-upload-area');
  if (uploadArea) {
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('drag-over');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileUpload({ target: { files } });
      }
    });
  }
}

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Validate file
  if (!file.type.startsWith('image/')) {
    alert('Please upload an image file');
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert('File size must be less than 5MB');
    return;
  }

  uploadedFile = file;

  // Show preview
  const preview = document.getElementById('filePreview');
  preview.innerHTML = `
    <div class="file-preview">
      <span><i data-lucide="image" class="icon-preview"></i> ${escapeHtml(file.name)} (${(file.size / 1024).toFixed(0)} KB)</span>
      <button class="file-remove" data-action="remove-file" type="button">×</button>
    </div>
  `;
  lucide.createIcons();
}

function removeFile() {
  uploadedFile = null;
  document.getElementById('filePreview').innerHTML = '';
  document.getElementById('fileInput').value = '';
}

async function submitFeedback() {
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    const formData = new FormData();
    formData.append('type', feedbackType);

    if (feedbackType === 'bug') {
      const description = document.getElementById('bugDescription').value.trim();
      const email = document.getElementById('userEmail').value.trim();

      if (!description) {
        alert('Please describe the issue');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Bug Report';
        return;
      }

      formData.append('description', description);
      if (email) formData.append('email', email);
      if (uploadedFile) formData.append('screenshot', uploadedFile);

    } else if (feedbackType === 'feature') {
      const description = document.getElementById('featureDescription').value.trim();
      const reason = document.getElementById('featureReason').value.trim();
      const email = document.getElementById('userEmail').value.trim();

      if (!description) {
        alert('Please describe the feature');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Feature Request';
        return;
      }

      formData.append('description', description);
      formData.append('reason', reason);
      if (email) formData.append('email', email);
    }

    const response = await fetch('/api/feedback', {
      method: 'POST',
      body: formData
    });

    // Try to parse JSON, but catch if it's HTML (the "Unexpected token <" bug)
    let result;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      result = await response.json();
    } else {
      const text = await response.text();
      throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}...`);
    }

    if (!response.ok) {
      throw new Error(result.error || 'Failed to submit feedback');
    }

    // Show success message
    document.getElementById('modalBody').innerHTML = `
      <div class="success-message">
        <div class="success-icon"><i data-lucide="check-circle" class="icon-success"></i></div>
        <div class="success-title">Thank you for your feedback!</div>
        <div class="success-subtitle">
          ${feedbackType === 'bug'
        ? 'We\'ll investigate this issue and work on a fix.'
        : 'We appreciate your ideas and will carefully review them.'}
        </div>
      </div>
    `;
    lucide.createIcons();

    document.getElementById('modalActions').innerHTML = `
      <button class="modal-btn modal-btn-primary modal-btn-centered" data-modal-action="close">
        Close
      </button>
    `;

  } catch (error) {
    console.error('Feedback submit failed:', error);
    showFeedbackError('Failed to submit feedback. Please try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = feedbackType === 'bug' ? 'Submit Bug Report' : 'Submit Feature Request';
  }
}

function showFeedbackError(message) {
  statusEl.className = 'status error';
  statusEl.hidden = false;
  statusEl.textContent = message;
}

// Initialize Lucide icons
if (logoEl) {
  logoEl.addEventListener('error', () => {
    logoEl.src = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238FB5A5\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Crect x=\'3\' y=\'3\' width=\'18\' height=\'18\' rx=\'2\' ry=\'2\' /%3E%3Cline x1=\'3\' y1=\'9\' x2=\'21\' y2=\'9\' /%3E%3Cline x1=\'9\' y1=\'21\' x2=\'9\' y2=\'9\' /%3E%3C/svg%3E';
  }, { once: true });
}

document.getElementById('openFeedbackLink').addEventListener('click', (event) => {
  event.preventDefault();
  openFeedbackModal();
});

document.getElementById('feedbackModal').addEventListener('click', (event) => {
  if (event.target.id === 'feedbackModal') closeFeedbackModal();
});

document.addEventListener('click', (event) => {
  const actionEl = event.target.closest('[data-action]');
  if (actionEl) {
    const action = actionEl.dataset.action;
    if (action === 'start-slideshow') window.location.href = '/slideshow.html';
    if (action === 'open-picker') openPicker();
    if (action === 'sign-out') signOut();
    if (action === 'open-picker-window') window.open(actionEl.dataset.pickerUrl, '_blank');
    if (action === 'check-picker-complete') checkPickerComplete(actionEl.dataset.sessionId);
    if (action === 'choose-file') document.getElementById('fileInput')?.click();
    if (action === 'remove-file') removeFile();
  }

  const feedbackTypeEl = event.target.closest('[data-feedback-type]');
  if (feedbackTypeEl) selectFeedbackType(feedbackTypeEl.dataset.feedbackType);

  const modalActionEl = event.target.closest('[data-modal-action]');
  if (modalActionEl?.dataset.modalAction === 'close') closeFeedbackModal();
  if (modalActionEl?.dataset.modalAction === 'submit') submitFeedback();
});

document.addEventListener('keydown', (event) => {
  const feedbackTypeEl = event.target.closest('[data-feedback-type]');
  const chooseFileEl = event.target.closest('[data-action="choose-file"]');
  if ((event.key === 'Enter' || event.key === ' ') && feedbackTypeEl) {
    event.preventDefault();
    selectFeedbackType(feedbackTypeEl.dataset.feedbackType);
  }
  if ((event.key === 'Enter' || event.key === ' ') && chooseFileEl) {
    event.preventDefault();
    document.getElementById('fileInput')?.click();
  }
});

document.addEventListener('change', (event) => {
  if (event.target.id === 'fileInput') handleFileUpload(event);
});

lucide.createIcons();
