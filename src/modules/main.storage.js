/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var m_oldMoz = Services.vc.compare(Services.appinfo.platformVersion, "34.0a") < 0;

function windowLocalStorage(obj, contentDoc) {
  var profileId = Profile.getIdentityFromContent(contentDoc.defaultView);

  if (Profile.isNativeProfile(profileId)) {
    console.trace("windowLocalStorage", profileId);
    return;
  }


  var originalUri = stringToUri(contentDoc.location.href);
  var uri = toInternalUri(originalUri, profileId);
  var principal = Services.scriptSecurityManager.getNoAppCodebasePrincipal(uri);
  var storage = m_oldMoz ? Services.domStorageManager.createStorage(principal, "") // nsIDOMStorage
                         : Services.domStorageManager.createStorage(null, principal, "");


  var rv = undefined;
  var oldVal;
  var eventData = null;
  switch (obj.cmd) {
    case "clear":
      if (storage.length > 0) {
        eventData = ["", null, null];
      }
      storage.clear();
      break;
    case "removeItem":
      oldVal = storage.getItem(obj.key);
      if (oldVal !== null) {
        eventData = [obj.key, oldVal, null];
      }
      storage.removeItem(obj.key);
      break;
    case "setItem":
      oldVal = storage.getItem(obj.key);
      if (oldVal !== obj.val) {
        eventData = [obj.key, oldVal, obj.val];
      }
      storage.setItem(obj.key, obj.val); // BUG it's ignoring https
      break;
    case "getItem":
      rv = storage.getItem(obj.key);
      break;
    case "key":
      rv = storage.key(obj.index);
      break;
    case "length":
      rv = storage.length;
      break;
    default:
      throw new Error("localStorage interface unknown: " + obj.cmd);
  }

  if (eventData !== null) {
    dispatchStorageEvent(eventData, profileId, contentDoc.defaultView);
  }

  return rv;
}



function dispatchStorageEvent(data, profileId, srcWin) {

  function forEachWindow(fn, win) {
    fn(win);
    for (var idx = win.length - 1; idx > -1; idx--) {
      forEachWindow(fn, win[idx]);
    }
  }

  function dispatchStorage(win) {
    if ((win.location.origin === _origin) && (srcWin !== win)) {
      if (_evt === null) {
        _evt = srcWin.document.createEvent("StorageEvent");
        _evt.initStorageEvent("storage", false, false, data[0], data[1], data[2], srcWin.location.href, null);
      }
      win.dispatchEvent(_evt);
    }
  }

  var _origin = srcWin.location.origin;
  var _evt = null;

  var enumWin = Services.wm.getEnumerator("navigator:browser");
  while (enumWin.hasMoreElements()) {
    for (var browser of UIUtils.getBrowserList(enumWin.getNext())) {
      if (Profile.getIdentity(browser) === profileId) {
        forEachWindow(dispatchStorage, browser.contentWindow);
      }
    }
  }

}


function stringToUri(spec) {
  try {
    return Services.io.newURI(spec, null, null);
  } catch (ex) {
    return null;
  }
}
