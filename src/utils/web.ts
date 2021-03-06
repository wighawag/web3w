/* eslint-disable @typescript-eslint/no-explicit-any */
async function chrome76Detection(): Promise<boolean> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const {quota} = await navigator.storage.estimate();
    if (quota && quota < 120000000) return true;
    else return false;
  } else {
    return false;
  }
}

function isNewChrome(): boolean | undefined {
  const pieces = navigator.userAgent.match(/Chrom(?:e|ium)\/([0-9]+)\.([0-9]+)\.([0-9]+)\.([0-9]+)/);
  if (pieces == null || pieces.length != 5) {
    return undefined;
  }
  const major = pieces.map((piece) => parseInt(piece, 10))[1];
  if (major >= 76) {
    return true;
  }
  return false;
}

/// from https://github.com/jLynx/PrivateWindowCheck (see https://stackoverflow.com/questions/2860879/detecting-if-a-browser-is-using-private-browsing-mode/55231766#55231766)
export function isPrivateWindow(): Promise<boolean> {
  return new Promise(function (resolve) {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    try {
      const isSafari =
        navigator.vendor &&
        navigator.vendor.indexOf('Apple') > -1 &&
        navigator.userAgent &&
        navigator.userAgent.indexOf('CriOS') == -1 &&
        navigator.userAgent.indexOf('FxiOS') == -1;

      if (isSafari) {
        //Safari
        let e = false;
        if ((window as any).safariIncognito) {
          e = true;
        } else {
          try {
            (window as any).openDatabase(null, null, null, null);
            (window.localStorage as any).setItem('test', 1);
            resolve(false);
          } catch (t) {
            e = true;
            resolve(true);
          }
          void !e && ((e = !1), window.localStorage.removeItem('test'));
        }
      } else if (navigator.userAgent.includes('Firefox')) {
        //Firefox
        const db = indexedDB.open('test');
        db.onerror = function () {
          resolve(true);
        };
        db.onsuccess = function () {
          resolve(false);
        };
      } else if (
        navigator.userAgent.includes('Edge') ||
        navigator.userAgent.includes('Trident') ||
        navigator.userAgent.includes('msie')
      ) {
        //Edge or IE
        if (!window.indexedDB && (window.PointerEvent || window.MSPointerEvent)) resolve(true);
        resolve(false);
      } else {
        //Normally ORP or Chrome
        //Other
        if (isNewChrome()) resolve(chrome76Detection());

        const fs = (window as any).RequestFileSystem || (window as any).webkitRequestFileSystem;
        if (!fs) resolve(false);
        // was null
        else {
          fs(
            (window as any).TEMPORARY,
            100,
            function () {
              resolve(false);
            },
            function () {
              resolve(true);
            }
          );
        }
      }
    } catch (err) {
      console.error(err);
      resolve(false); // was null
    }
  });
}
