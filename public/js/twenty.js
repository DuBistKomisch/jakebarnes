document.addEventListener('DOMContentLoaded', () => {
  const body = document.getElementsByTagName('body')[0];
  const text = document.getElementById('text');
  let stop = true;
  let count = 0;

  const tick = () => {
    if (count === 0) {
      if (stop) {
        stop = false;
        count = 20 * 60;
        body.className = 'go';
      } else {
        stop = true;
        count = 20;
        body.className = 'stop';
      }
    } else {
      count--;
    }
    const minutes = Math.floor(count / 60).toString().padStart(2, '0');
    const seconds = (count % 60).toString().padStart(2, '0');
    text.innerText = `${minutes}:${seconds}`;
  };

  setInterval(tick, 1000);
  tick();
});
