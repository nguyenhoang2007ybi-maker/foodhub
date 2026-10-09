// FoodHub Toast Notification System
class ToastManager {
  constructor() {
    this.container = null;
    this.initContainer();
  }

  initContainer() {
    if (typeof document === 'undefined') return;
    let el = document.getElementById('foodhub-toast-container');
    if (!el) {
      el = document.createElement('div');
      el.id = 'foodhub-toast-container';
      el.className = 'fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0';
      document.body.appendChild(el);
    }
    this.container = el;
  }

  show(message, type = 'info', duration = 3500) {
    this.initContainer();
    if (!this.container) return;

    const toast = document.createElement('div');
    toast.className = `pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border transition-all duration-300 transform translate-x-10 opacity-0 bg-surface-container-lowest`;

    let icon = 'info';
    let borderColor = 'border-secondary/20';
    let iconColor = 'text-primary';

    if (type === 'success') {
      icon = 'check_circle';
      borderColor = 'border-emerald-500/30';
      iconColor = 'text-emerald-600';
    } else if (type === 'error') {
      icon = 'error';
      borderColor = 'border-rose-500/30';
      iconColor = 'text-rose-600';
    } else if (type === 'warning') {
      icon = 'warning';
      borderColor = 'border-amber-500/30';
      iconColor = 'text-amber-500';
    }

    toast.classList.add(borderColor);
    toast.innerHTML = `
      <span class="material-symbols-outlined ${iconColor} text-[22px] flex-shrink-0 mt-0.5">${icon}</span>
      <div class="flex-1 text-sm font-medium text-on-surface leading-snug">${message}</div>
      <button type="button" class="text-secondary hover:text-on-surface transition-colors flex-shrink-0 -mr-1 -mt-1 p-1">
        <span class="material-symbols-outlined text-[18px]">close</span>
      </button>
    `;

    const closeBtn = toast.querySelector('button');
    const dismiss = () => {
      toast.classList.add('opacity-0', 'translate-x-10');
      setTimeout(() => {
        if (toast.parentElement) toast.parentElement.removeChild(toast);
      }, 300);
    };

    closeBtn.addEventListener('click', dismiss);
    this.container.appendChild(toast);

    // Trigger animation in
    requestAnimationFrame(() => {
      toast.classList.remove('opacity-0', 'translate-x-10');
    });

    if (duration > 0) {
      setTimeout(dismiss, duration);
    }
  }

  success(msg, dur) { this.show(msg, 'success', dur); }
  error(msg, dur) { this.show(msg, 'error', dur); }
  warning(msg, dur) { this.show(msg, 'warning', dur); }
  info(msg, dur) { this.show(msg, 'info', dur); }
}

export const toast = new ToastManager();
export default toast;
