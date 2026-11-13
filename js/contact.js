/* ==========================================================================
   Contact form validation
   Rules:
   - no field may be empty
   - email must have a valid format
   - phone number may contain digits only
   On success the message is delivered through FORM_ENDPOINT if one is set,
   otherwise it opens the visitor's email app with the message pre-filled.
   ========================================================================== */
(function () {
  'use strict';

  // Optional: paste a form service URL here (for example a Formspree endpoint)
  // to receive messages without the visitor's email app.
  const FORM_ENDPOINT = '';
  const RECIPIENT_EMAIL = 'augustinedevv@gmail.com';

  const form = document.getElementById('contactForm');
  if (!form) return;

  const statusElement = document.getElementById('formStatus');
  const submitButton = form.querySelector('button[type="submit"]');

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const DIGITS_ONLY = /^\d+$/;

  /* One validator per field; each returns an error message or '' when valid */
  const validators = {
    name(value) {
      if (value === '') return 'Please enter your name.';
      return '';
    },
    email(value) {
      if (value === '') return 'Please enter your email address.';
      if (!EMAIL_PATTERN.test(value)) return 'Enter a valid email, like name@example.com.';
      return '';
    },
    phone(value) {
      if (value === '') return 'Please enter your phone number.';
      if (!DIGITS_ONLY.test(value)) return 'Use digits only, with no spaces, dashes or + sign.';
      return '';
    },
    message(value) {
      if (value === '') return 'Please write a message.';
      return '';
    }
  };

  function getField(name) {
    return form.elements[name];
  }

  function showError(field, message) {
    const errorElement = document.getElementById(field.id + 'Error');
    errorElement.textContent = message;
    field.classList.toggle('form-field--invalid', message !== '');
    field.classList.toggle('form-field--valid', message === '' && field.value.trim() !== '');
    if (message) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
  }

  function validateField(field) {
    const message = validators[field.name](field.value.trim());
    showError(field, message);
    return message === '';
  }

  function validateAll() {
    // validate every field (not just until the first error) so all problems show at once
    const results = Object.keys(validators).map((name) => validateField(getField(name)));
    return results.every(Boolean);
  }

  function setStatus(text, isError) {
    statusElement.textContent = text;
    statusElement.classList.toggle('form-status--error', Boolean(isError));
    statusElement.classList.add('form-status--visible');
  }

  function resetFieldStates() {
    Object.keys(validators).forEach((name) => {
      const field = getField(name);
      field.classList.remove('form-field--valid', 'form-field--invalid');
      field.removeAttribute('aria-invalid');
    });
  }

  /* Live feedback: check on leaving a field, and re-check while fixing an error */
  Object.keys(validators).forEach((name) => {
    const field = getField(name);

    field.addEventListener('blur', () => validateField(field));

    field.addEventListener('input', () => {
      if (field.classList.contains('form-field--invalid')) validateField(field);
    });
  });

  async function deliver(data) {
    if (FORM_ENDPOINT) {
      const response = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Request failed');
      return 'sent';
    }

    const subject = 'Portfolio message from ' + data.name;
    const body = data.message + '\n\nName: ' + data.name + '\nEmail: ' + data.email + '\nPhone: ' + data.phone;
    window.location.href = 'mailto:' + RECIPIENT_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    return 'mailto';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    statusElement.classList.remove('form-status--visible');

    if (!validateAll()) {
      setStatus('Please fix the highlighted fields and try again.', true);
      const firstInvalid = form.querySelector('.form-field--invalid');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    const data = {
      name: getField('name').value.trim(),
      email: getField('email').value.trim(),
      phone: getField('phone').value.trim(),
      message: getField('message').value.trim()
    };

    submitButton.disabled = true;

    try {
      const method = await deliver(data);
      const firstName = data.name.split(/\s+/)[0];
      setStatus(
        method === 'sent'
          ? 'Thanks, ' + firstName + '! Your message has been sent and I will reply soon.'
          : 'Thanks, ' + firstName + '! Your email app should open with the message ready to send.',
        false
      );
      form.reset();
      resetFieldStates();
    } catch (error) {
      setStatus('Something went wrong sending your message. Please try again or email me directly.', true);
    } finally {
      submitButton.disabled = false;
    }
  });
})();
