/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var m_runner = null;

const BrowserWindow = {

  register: function(win) {
    var profileId = Profile.getIdentity(win);

    if (profileId === Profile.DefaultIdentity) {
      console.log("BrowserWindow.register NOP");
      return;
    }

    console.log("BrowserWindow.register " + profileId);

    if (m_runner === null) {
      // first multifox window!
      m_runner = new MultifoxRunner();
    }


    win.addEventListener(m_runner.eventSentByContent, onContentEvent, false, true);

    // some MultifoxContentEvent_* listeners are not called when
    // there are "unload" listeners with useCapture=true. o_O
    // But they are called if event listener is an anonymous function.
    win.addEventListener("unload", onUnloadChromeWindow, false);

    // update icon status
    win.getBrowser().tabContainer.addEventListener("TabSelect", tabSelected, false);

    // restore icon after toolbar customization
    win.addEventListener("aftercustomization", customizeToolbar, false);
  },


  // should keep id for session restore?
  unregister: function(win) {
    var idw = Profile.getIdentity(win);
    console.log("BrowserWindow.unregister " + idw);

    if (idw === Profile.DefaultIdentity) {
      // nothing to unregister
      return;
    }

    win.removeEventListener(m_runner.eventSentByContent, onContentEvent, false);
    win.removeEventListener("aftercustomization", customizeToolbar, false);
    win.getBrowser().tabContainer.removeEventListener("TabSelect", tabSelected, false);

    var sessions = Profile.activeIdentities(win);
    var onlyDefault = (sessions.length === 1) && (sessions[0] === Profile.DefaultIdentity);
    if (onlyDefault) {
      // no more multifox windows
      m_runner.shutdown();
      m_runner = null;
    }
    win.removeEventListener("unload", onUnloadChromeWindow, false);
  }
};


function onUnloadChromeWindow(evt) {
  var win = evt.currentTarget;
  BrowserWindow.unregister(win);
}


function customizeToolbar(evt) {
  var toolbox = evt.target;
  updateUI(toolbox.ownerDocument.defaultView);
  updateButton(toolbox.ownerDocument.defaultView);
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
      showError(contentDoc.defaultView, obj.cmd, "-");
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
  evt2.initMessageEvent(m_runner.eventSentByChrome, false, false, rv, null, null, null);
  var success = contentDoc.dispatchEvent(evt2);
}


function MultifoxRunner() {
  var ns = {}; // BUG util is undefined???
  Cu.import("${PATH_MODULE}/new-window.js", ns);

  this._sentByChrome  = "multifox-chrome_event-"  + Math.random().toString(36).substr(2);
  this._sentByContent = "multifox-content_event-" + Math.random().toString(36).substr(2);
  this._inject = new DocStartScriptInjection();
  Cookies.start();
  ns.util.networkListeners.enable(httpListeners.request, httpListeners.response);
}

MultifoxRunner.prototype = {
  get eventSentByChrome() {
    return this._sentByChrome;
  },

  get eventSentByContent() {
    return this._sentByContent;
  },

  shutdown: function() {
    console.log("MultifoxRunner.shutdown");
    var ns = {}; // BUG util is undefined???
    Cu.import("${PATH_MODULE}/new-window.js", ns);

    ns.util.networkListeners.disable();
    this._inject.stop();
    Cookies.stop();
  }
};


function showError(contentWin, notSupportedFeature, details) {
  var msg = [];
  msg.push("ERROR=" + notSupportedFeature);
  msg.push(details);
  if (contentWin.document) {
    msg.push("location=" + contentWin.location);
    if (contentWin.document.documentURIObject) {
      msg.push("uri=     " + contentWin.document.documentURIObject.spec);
    }
  }
  msg.push("title=[" + contentWin.document.title + "]");
  console.log(msg.join("\n"));

  var browser = ContentWindow.getContainerElement(contentWin);
  browser.setAttribute("multifox-tab-status", notSupportedFeature);

  var doc = browser.ownerDocument;
  var selBrowser = doc.defaultView.getBrowser().selectedTab.linkedBrowser;
  if (selBrowser === browser) {
    updateStatus(doc);
  }
}
