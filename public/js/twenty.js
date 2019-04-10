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
let mode = 'twenty';
let stop = true;
let count = 0;

document.addEventListener('DOMContentLoaded', () => {
  const fill = document.getElementById('fill');
  const text = document.getElementById('text');
  const modeSelect = document.getElementById('mode');

  const tick = () => {
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
    } else {
      count--;
    }
    const minutes = Math.floor(count / 60).toString().padStart(2, '0');
    const seconds = (count % 60).toString().padStart(2, '0');
    text.innerText = `${minutes}:${seconds}`;
  };

  fill.addEventListener('click', () => {
    count = 0;
    tick();
  });

  modeSelect.addEventListener('change', () => {
    mode = modeSelect.value;
    count = 0;
    stop = true;
    tick();
  });

  setInterval(tick, 1000);
  tick();
});
