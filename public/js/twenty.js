const limits = {
  twenty: {
    go: 20 * 60,
    stop: 20
  },
  stand: {
    go: 2 * 60 * 60,
    stop: 60 * 60
  }
};
const notifications = {
  twenty: {
    stop: 'Time to look away'
  },
  stand: {
    go: 'Time to sit down!',
    stop: 'Time to stand up!'
  }
};
let mode = 'twenty';
let stop = true;
let count = 0;

if (Notification.permission === 'default') {
  Notification.requestPermission();
}

document.addEventListener('DOMContentLoaded', () => {
  const fill = document.getElementById('fill');
  const text = document.getElementById('text');
  const modeSelect = document.getElementById('mode');

  if (location.hash) {
    const hashMode = location.hash.substring(1);
    if (limits.hasOwnProperty(hashMode)) {
      mode = hashMode;
      modeSelect.value = hashMode;
    }
  }

  const notify = () => {
    if (Notification.permission !== 'granted') {
      return;
    }

    const message = notifications[mode][stop ? 'stop' : 'go'];
    if (!message) {
      return;
    }

    new Notification(message);
  };

  const tick = (doNotify = true) => {
    if (count === 0) {
      if (stop) {
        stop = false;
        count = limits[mode].go;
        fill.className = 'go';
      } else {
        stop = true;
        count = limits[mode].stop;
        fill.className = 'stop';
      }

      if (doNotify) {
        notify();
      }
    } else {
      count--;
    }
    const minutes = Math.floor(count / 60).toString().padStart(2, '0');
    const seconds = (count % 60).toString().padStart(2, '0');
    text.innerText = `${minutes}:${seconds}`;
  };

  fill.addEventListener('click', () => {
    count = 0;
    tick(false);
  });

  modeSelect.addEventListener('change', () => {
    mode = modeSelect.value;
    count = 0;
    stop = true;
    tick();
  });

  setInterval(tick, 1000);
  tick(false);
});
