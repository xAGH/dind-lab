const toast = document.getElementById('toast');
let hideTimer = null;

export function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.remove('hidden');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => toast.classList.add('hidden'), 3500);
}
