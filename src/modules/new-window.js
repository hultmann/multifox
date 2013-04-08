/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


"use strict";

const EXPORTED_SYMBOLS = ["Cc", "Ci", "console", "util", "init", "newPendingWindow"];

const Cc = Components.classes;
const Ci = Components.interfaces;

var m_pendingNewWindows = 0;

function newPendingWindow() {
  m_pendingNewWindows++;
}

var m_docObserver = null;

function init() {
  console.assert(m_docObserver === null, "m_docObserver should be null");
  m_docObserver = new DocObserver();
}


Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

function DocObserver() {
  Services.obs.addObserver(this, "chrome-document-global-created", false);
}


DocObserver.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]),
  observe: function(win, topic, data) {
    // win.location=about:blank
    win.addEventListener("DOMContentLoaded", onDOMContentLoaded, false);
  }
};


function onDOMContentLoaded(evt) {
  var win = evt.currentTarget;
  if (win.document !== evt.target) {
    return; // avoid bubbled DOMContentLoaded events
  }

  win.removeEventListener("DOMContentLoaded", onDOMContentLoaded, false);


  var ns = {};
  Components.utils.import("resource://gre/modules/PrivateBrowsingUtils.jsm", ns);
  var isNotPriv = ns.PrivateBrowsingUtils.isWindowPrivate(win.top) === false;


  switch (win.location.href) {
    case "chrome://browser/content/browser.xul":
      if (isNotPriv) {
        BrowserOverlay.add(win);
      }
      break;
    case "chrome://browser/content/history/history-panel.xul":
    case "chrome://browser/content/bookmarks/bookmarksPanel.xul":
      if (isNotPriv) {
        loadSubScript().PlacesOverlay.add(win);
      }
      break;
    case "chrome://browser/content/places/places.xul":
      // BUG removed to avoid bugs with private window
      //loadSubScript().PlacesOverlay.add(win);
      break;
    case "chrome://mozapps/content/extensions/about.xul":
      loadSubScript().AboutOverlay.add(win);
      break;
  }
}


function loadSubScript() {
  var ns = {};
  Services.scriptloader.loadSubScript("${PATH_CONTENT}/overlays.js", ns);
  return ns;
}


const BrowserOverlay = {
  add: function(win) {
    win.addEventListener("unload", BrowserOverlay._unload, false);

    setWindowProfile(win)

    var doc = win.document;
    //if ((doc instanceof Ci.nsIDOMDocument) === false) {

    // detect session restore
    doc.addEventListener("SSTabRestoring", onTabRestoring, false);
    doc.addEventListener("SSTabRestored", onTabRestored, false);

    // key
    var key = doc.getElementById("mainKeyset").appendChild(doc.createElement("key"));
    key.setAttribute("id", "key_${BASE_DOM_ID}-new-identity");
    key.setAttribute("modifiers", Services.appinfo.OS === "Darwin" ? "control,alt" : "accel,alt");
    key.setAttribute("key", "M");
    key.setAttribute("oncommand", "(function dummy(){})()"); // workaround
    key.addEventListener("command", onKey, false);

    // menus
    addMenuListeners(doc);
  },

  _unload: function(evt) {
    var win = evt.currentTarget;
    win.removeEventListener("unload", BrowserOverlay._unload, false);
    BrowserOverlay.remove(win);
  },

  remove: function(win) {
    removeMenuListeners(win.document);

    // key
    var key = win.document.getElementById("key_${BASE_DOM_ID}-new-identity");
    key.removeEventListener("command", onKey, false);
    key.parentNode.removeChild(key);
  }
};


function onKey(evt) {
  var key = evt.target;
  var win = key.ownerDocument.defaultView.top;
  newPendingWindow();
  win.OpenBrowserWindow();
}


function setWindowProfile(newWin) {
  if (m_pendingNewWindows > 0) {
    // new identity profile
    console.log("m_pendingNewWindows=" + m_pendingNewWindows);
    m_pendingNewWindows--;
    Components.utils.import("${PATH_MODULE}/main.js");
    NewWindow.newId(newWin);

  } else {
    // inherit identity profile
    if (util.networkListeners.active) {
      Components.utils.import("${PATH_MODULE}/main.js");
      NewWindow.inheritId(newWin);
    } else {
      // no Multifox window
      console.log("setWindowProfile NOP => util.networkListeners.active=false");
    }
  }
}


function onTabRestoring(evt) {
  var doc = evt.currentTarget;
  var win = doc.defaultView;

  var stringId = Cc["@mozilla.org/browser/sessionstore;1"]
                  .getService(Ci.nsISessionStore)
                  .getWindowValue(win, "${BASE_DOM_ID}-identity-id");

  if (util.networkListeners.active === false && stringId.length === 0) {
    // default scenario
    console.log("first tab restoring NOP");
    return;
  }

  console.log("first tab restoring " + stringId);

  // add icon; sync id — override any previous profile id
  Components.utils.import("${PATH_MODULE}/main.js");
  NewWindow.applyRestore(win);
}


function onTabRestored(evt) {
  var doc = evt.currentTarget;
  var win = doc.defaultView;
  var tab = evt.originalTarget;

  // we need to [re]configure identity window id,
  // only the first restored tab is necessary.
  if (tab.linkedBrowser.currentURI.spec !== "about:sessionrestore") {
    console.log("removeEventListener SSTabRestored+SSTabRestoring");
    doc.removeEventListener("SSTabRestoring", onTabRestoring, false);
    doc.removeEventListener("SSTabRestored", onTabRestored, false);
  }
}


function addMenuListeners(doc) {
  var ids = ["contentAreaContextMenu", "placesContext", "menu_FilePopup"];
  for (var idx = ids.length - 1; idx > -1; idx--) {
    doc.getElementById(ids[idx]).addEventListener("popupshowing", onMenuPopupShowing, false);
  }

  doc.getElementById("tabContextMenu").addEventListener("popupshowing", onMenuPopupShowing, false);

  var newTabPopup = doc.getElementById("appmenu_newNavigator").parentNode;
  newTabPopup.addEventListener("popupshowing", onMenuPopupShowing, false);
  newTabPopup.setAttribute("multifox-id", "app-menu");
}


function removeMenuListeners(doc) {
  var ids = ["contentAreaContextMenu", "placesContext", "menu_FilePopup"];
  for (var idx = ids.length - 1; idx > -1; idx--) {
    doc.getElementById(ids[idx]).removeEventListener("popupshowing", onMenuPopupShowing, false);
  }

  doc.getElementById("tabContextMenu").removeEventListener("popupshowing", onMenuPopupShowing, false);

  var newTabPopup = doc.getElementById("appmenu_newNavigator").parentNode;
  newTabPopup.removeEventListener("popupshowing", onMenuPopupShowing, false);
  newTabPopup.removeAttribute("multifox-id");
}


function onMenuPopupShowing(evt) {
  Components.utils.import("${PATH_MODULE}/menus.js");
  menuShowing(evt);
}


const console = {
  log: function(msg) {
    var now = new Date();
    var ms = now.getMilliseconds();
    var ms2;
    if (ms < 100) {
      ms2 = ms < 10 ? "00" + ms : "0" + ms;
    } else {
      ms2 = ms.toString();
    }
    var p = "${CHROME_NAME}[" + now.toLocaleFormat("%H:%M:%S") + "." + ms2 + "] ";
    Services.console.logStringMessage(p + msg);
  },

  assert: function(test, msg) {
    if (test !== true) {
      var ex =  new Error("console.assert - " + msg + " - " + test);
      Components.utils.reportError(ex) // sometimes exception doesn't show up in console
      throw "";
    }
  }
};


const util = {
  getText: function(name) {
    return this._getTextCore(name, "general", arguments, 1);
  },

  getTextFrom: function(name, filename) {
    return this._getTextCore(name, filename, arguments, 2);
  },

  _getTextCore: function(name, filename, args, startAt) {
    var bundle = Services.strings.createBundle("${PATH_LOCALE}/" + filename + ".properties");

    if (args.length === startAt) {
      return bundle.GetStringFromName(name);
    } else {
      var args2 = Array.prototype.slice.call(args, startAt, args.length);
      console.assert(args2.length > 0, "_getTextCore");
      return bundle.formatStringFromName(name, args2, args2.length)
    }
  },

  networkListeners: {
    _observers: null,

    get active() {
      return this._observers !== null;
    },

    _cookieRejectedListener: {
      observe: function(aSubject, aTopic, aData) {
        Components.utils.import("${PATH_MODULE}/main.js");
        console.log("cookie-rejected\n" + aSubject + "\n" + aTopic + "\n" + aData + "\n" + aSubject.QueryInterface(Ci.nsIURI).spec);
      }
    },

    enable: function(onRequest, onResponse) {
      console.log("networkListeners enable");
      if (this._observers !== null) {
        throw "networkListeners.enable ==> this._observers=true";
      }
      this._observers = [onRequest, onResponse];

      var obs = Services.obs;
      obs.addObserver(this._observers[0], "http-on-modify-request", false);
      obs.addObserver(this._observers[1], "http-on-examine-response", false);
      obs.addObserver(this._cookieRejectedListener, "cookie-rejected", false);
    },

    disable: function() {
      console.log("networkListeners disable");
      var obs = Services.obs;
      obs.removeObserver(this._observers[0], "http-on-modify-request");
      obs.removeObserver(this._observers[1], "http-on-examine-response");
      this._observers = null;
      obs.removeObserver(this._cookieRejectedListener, "cookie-rejected");
    }
  }
};
