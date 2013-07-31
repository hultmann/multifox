/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var m_runner = null;

const BrowserWindow = {

  register: function(win) {
    var profileId = Profile.getIdentity(win);

    if (Profile.isNativeProfile(profileId)) {
      console.log("BrowserWindow.register NOP");
      return;
    }

    console.log("BrowserWindow.register " + profileId);

    var ns = {}; // BUG util is undefined???
    Cu.import("${PATH_MODULE}/new-window.js", ns);
    if (ns.util.networkListeners.active === false) {
      // first multifox window!
      ns.util.networkListeners.enable(httpListeners.request, httpListeners.response);
      DocStartScriptInjection.init();
      Cookies.start();
    }


    win.addEventListener(DocStartScriptInjection.eventSentByContent, onContentEvent, false, true);

    // some MultifoxContentEvent_* listeners are not called when
    // there are "unload" listeners with useCapture=true. o_O
    // But they are called if event listener is an anonymous function.
    win.addEventListener("unload", onUnloadChromeWindow, false);

    // update icon status
    win.getBrowser().tabContainer.addEventListener("TabSelect", tabSelected, false);
  },


  // should keep id for session restore?
  unregister: function(win) {
    var idw = Profile.getIdentity(win);
    console.log("BrowserWindow.unregister " + idw);

    if (Profile.isNativeProfile(idw)) {
      return; // nothing to unregister
    }

    win.removeEventListener(DocStartScriptInjection.eventSentByContent, onContentEvent, false);
    win.removeEventListener("unload", onUnloadChromeWindow, false);
    win.getBrowser().tabContainer.removeEventListener("TabSelect", tabSelected, false);

    var ns = {}; // BUG util is undefined???
    Cu.import("${PATH_MODULE}/new-window.js", ns);
    if (ns.util.networkListeners.active) {
      this._checkLastWin(win);
    }
  },


  _checkLastWin: function(win) {
    var sessions = Profile.activeIdentities(win);
    var onlyNative = true;
    for (var idx = sessions.length - 1; idx > -1; idx--) {
      if (Profile.isExtensionProfile(sessions[idx])) {
        onlyNative = false;
        break;
      }
    }
    if (onlyNative) {
      var ns = {}; // BUG util is undefined???
      Cu.import("${PATH_MODULE}/new-window.js", ns);
      ns.util.networkListeners.disable();
      DocStartScriptInjection.stop();
      Cookies.stop();
    }
  }
};


function onUnloadChromeWindow(evt) {
  var win = evt.currentTarget;
  BrowserWindow.unregister(win);
}


function tabSelected(evt) {
  var tab = evt.originalTarget;
  ErrorHandler.updateButtonAsync(tab.linkedBrowser);
}


function onContentEvent(evt) {
  evt.stopPropagation();

  var obj = JSON.parse(evt.data);
  var contentDoc = evt.target;
  var rv;

  switch (obj.from) {
    case "cookie":
      rv = documentCookie(obj, contentDoc);
      break;
    case "localStorage":
      rv = windowLocalStorage(obj, contentDoc);
      break;
    case "error":
      ErrorHandler.addScriptError(contentDoc.defaultView, obj.cmd, "-");
      break;
    default:
      throw obj.from;
  }

  if (rv === undefined) {
    // no response
    return;
  }

  // send data to content
  var evt2 = contentDoc.createEvent("MessageEvent");
  evt2.initMessageEvent(DocStartScriptInjection.eventSentByChrome, false, false, rv, null, null, null);
  var success = contentDoc.dispatchEvent(evt2);
}
