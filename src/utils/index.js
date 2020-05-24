export function timeout(time, p, config) {
  return new Promise((resolve, reject) => {
    let _timedOut = false;
    const timer = setTimeout(() => {
      _timedOut = true;
      if (!config) {
        reject(new Error("TimedOut"));
      } else {
        if (typeof config === "function") {
          resolve(config());
        } else {
          reject(config.error || config)
        }
      }
    }, time);
    p.then((v) => {
      if (!_timedOut) {
        clearTimeout(timer);
        resolve(v);
      } // TODO else console.log
    }).catch((e) =>{
      if (!_timedOut) {
        clearTimeout(timer);
        reject(e);
      } // TODO else console.log
    });
  });
  
}
