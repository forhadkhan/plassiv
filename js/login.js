/* Login: a centred modal. There is no account system behind the shop yet, so any credentials are refused. */
import { $ } from './ui.js';

const dialog = $('#login-dialog');
const form = $('[data-login-form]', dialog);
const alertBox = $('[data-login-alert]', dialog);
const submit = $('[data-login-submit]', dialog);
const reveal = $('[data-login-reveal]', dialog);
const fields = { email: $('#login-email', dialog), password: $('#login-password', dialog) };
const messages = { email: 'Enter your email.', password: 'Enter your password.' };
let timer = 0;

function setError(name, message) {
  const input = fields[name];
  $(`[data-error-for="${name}"]`, dialog).textContent = message;
  input.toggleAttribute('aria-invalid', !!message);
  if (message) input.setAttribute('aria-invalid', 'true');
}

function reset() {
  clearTimeout(timer);
  form.reset();
  Object.keys(fields).forEach((n) => setError(n, ''));
  alertBox.hidden = true;
  submit.disabled = false;
  submit.textContent = 'Sign in';
  showPassword(false);
}

function showPassword(on) {
  fields.password.type = on ? 'text' : 'password';
  reveal.setAttribute('aria-pressed', String(on));
  reveal.setAttribute('aria-label', on ? 'Hide password' : 'Show password');
  $('[data-eye]', reveal).classList.toggle('hidden', on);
  $('[data-eye-off]', reveal).classList.toggle('hidden', !on);
}

const open = () => {
  if (dialog.open) return;
  document.documentElement.style.overflow = 'hidden';
  dialog.showModal();
  fields.email.focus();
};
const close = () => dialog.close();

dialog.addEventListener('close', () => { document.documentElement.style.overflow = ''; reset(); });
document.querySelectorAll('[data-login-open]').forEach((b) => b.addEventListener('click', open));
$('[data-login-close]', dialog).addEventListener('click', close);
dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });   // the backdrop belongs to the dialog itself
reveal.addEventListener('click', () => showPassword(fields.password.type === 'password'));

for (const [name, input] of Object.entries(fields)) {
  input.addEventListener('input', () => { if (input.value.trim()) setError(name, ''); alertBox.hidden = true; });
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  alertBox.hidden = true;
  const empty = Object.keys(fields).filter((n) => !fields[n].value.trim());
  Object.keys(fields).forEach((n) => setError(n, empty.includes(n) ? messages[n] : ''));
  if (empty.length) { fields[empty[0]].focus(); return; }

  submit.disabled = true;
  submit.textContent = 'Signing in…';
  timer = setTimeout(() => {
    submit.disabled = false;
    submit.textContent = 'Sign in';
    alertBox.hidden = false;
    alertBox.classList.remove('login-shake');
    void alertBox.offsetWidth;   // restart the animation on a repeat attempt
    alertBox.classList.add('login-shake');
    fields.password.select();
  }, 700);
});
