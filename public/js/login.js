// Show error messages from URL parameters
(function() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');
  const errorBox = document.getElementById('error-box');

  if (error === 'oauth_failed') {
    errorBox.textContent = 'Sign in failed. Please try again.';
    errorBox.classList.add('visible');
  }

  // Redirect already-authenticated users to home
  fetch('/auth/status')
    .then(r => r.json())
    .then(data => {
      if (data.authenticated) {
        window.location.href = '/';
      }
    })
    .catch(() => {
      // Ignore -- user is not authenticated
    });
})();
