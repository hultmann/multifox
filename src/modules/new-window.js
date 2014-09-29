/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


"use strict";

var EXPORTED_SYMBOLS = ["Cc", "Ci", "util", "Bootstrap", "queueNewProfile", "updateEngineState", "getNextTopDocumentProfile"];

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("${PATH_MODULE}/main.js");


var m_pendingNewProfiles = [];
var m_docObserver = null;

var Bootstrap = {

  extensionStartup: function(firstRun, reinstall) {
    console.assert(m_docObserver === null, "m_docObserver should be null");
    console.assert(m_pendingNewProfiles.length === 0, "m_pendingNewProfiles should be empty");

    if (firstRun || reinstall) {
      var desc = util.getTextFrom("extensions.${EXT_ID}.description", "about-multifox");
      util.setUnicodePref("description", desc);
    }

    m_docObserver = new DocObserver();

    ContentWindowObserver.enable();
    Services.obs.addObserver(UpdateUI, "${BASE_DOM_ID}-id-changed", false);

    var enumWin = Services.wm.getEnumerator(null);
    while (enumWin.hasMoreElements()) {
      forEachChromeWindow(enableExtension, enumWin.getNext());
    }

    registerButton(true); // call it only after inserting <panelview>

    this._incompatibilityCheck();
  },


  _timer: null,

  _incompatibilityCheck: function() {
    this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    this._timer.initWithCallback({
      notify: function() {
        delete Bootstrap._timer;
        ExtCompat.findIncompatibleExtensions(ErrorHandler.addIncompatibilityError);
        ExtCompat.installAddonListener();
      }
    }, 8000, Ci.nsITimer.TYPE_ONE_SHOT);
  },

  extensionShutdown: function() {
    Services.obs.removeObserver(UpdateUI, "${BASE_DOM_ID}-id-changed");
    ContentWindowObserver.disable();
    m_docObserver.shutdown();
    ExtCompat.uninstallAddonListener();
    var enumWin = Services.wm.getEnumerator(null);
    while (enumWin.hasMoreElements()) {
      forEachChromeWindow(disableExtension, enumWin.getNext());
    }
    registerButton(false);
  },


  extensionUninstall: function() {
    var enumWin = Services.wm.getEnumerator("navigator:browser");
    while (enumWin.hasMoreElements()) {
      removeState(enumWin.getNext());
    }

    // prefs
    Services.prefs.getBranch("extensions.${EXT_ID}.").deleteBranch("");

    // cookies etc
    Components.utils.import("${PATH_MODULE}/commands.js", {}).removeData();
  }

};


function forEachChromeWindow(fn, win) {
  if (win instanceof Ci.nsIDOMChromeWindow) {
    fn(win);
    for (var idx = win.length - 1; idx > -1; idx--) {
      forEachChromeWindow(fn, win[idx]);
    }
  }
}


var UpdateUI = {
  observe: function(subject, topic, data) {
    var win = Services.wm.getOuterWindowWithId(Number.parseInt(data, 10));
    updateButton(win);
  }
}


function DocObserver() {
  Services.obs.addObserver(this, "chrome-document-global-created", false);
}


DocObserver.prototype = {
  shutdown: function() {
    Services.obs.removeObserver(this, "chrome-document-global-created");
  },

  observe: function(win, topic, data) {
    // win.location=about:blank
    win.addEventListener("DOMContentLoaded", onDOMContentLoaded, false);
  }
};


function onDOMContentLoaded(evt) {
  var win = evt.currentTarget;
  if (win.document !== evt.target) {
    // avoid bubbled DOMContentLoaded events
    return;
  }

  win.removeEventListener("DOMContentLoaded", onDOMContentLoaded, false);

  switch (win.location.href) {
    case "chrome://browser/content/browser.xul":
      BrowserOverlay.add(win);
      break;
    case "chrome://browser/content/history/history-panel.xul":
    case "chrome://browser/content/bookmarks/bookmarksPanel.xul":
      PlacesOverlay.add(win);
      break;
    case "chrome://browser/content/places/places.xul":
      // BUG removed to avoid bugs with private window
      //PlacesOverlay.add(win);
      break;
    case "chrome://mozapps/content/extensions/about.xul":
      AboutOverlay.add(win);
      break;
  }
}


function updateEngineState(closedBrowser = null) {
  var isActive = util.networkListeners.active;
  if (Profile.activeExtensionIdentities(closedBrowser).length > 0) {
    if (isActive === false) {
      Profile.enableEngine();
    }
  } else {
    if (isActive) {
      Profile.disableEngine();
    }
  }
}


function queueNewProfile(profileId) {
  // TODO Fx32: Number.isSafeInteger
  console.assert(Number.isInteger(profileId), "profileId not defined", profileId);
  m_pendingNewProfiles.push(profileId);
}


function removeState(win) { // uninstalling
  console.assert(win.location.href === "chrome://browser/content/browser.xul", "win should be a browser window");

  var ss = Cc["@mozilla.org/browser/sessionstore;1"].getService(Ci.nsISessionStore);

  // per-window version
  ss.setWindowValue(win,    "${PROFILE_DEPRECATED_SESSION}", "");
  ss.deleteWindowValue(win, "${PROFILE_DEPRECATED_SESSION}");
  UIUtils.getContentContainer(win).removeAttribute("${PROFILE_DEPRECATED_DISABLED}");

  for (var tab of UIUtils.getTabList(win)) {
    // extension is disabled before uninstalling
    tab.linkedBrowser.removeAttribute("${PROFILE_BROWSER_ATTR}");
    ss.setTabValue(tab,    "${PROFILE_SESSION}", ""); // avoid exception
    ss.deleteTabValue(tab, "${PROFILE_SESSION}");
  }
}


function enableExtension(win) {
  switch (win.location.href) {
    case "chrome://browser/content/browser.xul":
      BrowserOverlay.add(win);
      restoreProfiles(win);
      break;
  }
}


function disableExtension(win) {
  switch (win.location.href) {
    case "chrome://browser/content/browser.xul":
      saveProfiles(win); // TODO ignore private windows
      BrowserOverlay.remove(win);
      break;

    case "chrome://browser/content/history/history-panel.xul":
    case "chrome://browser/content/bookmarks/bookmarksPanel.xul":
      PlacesOverlay.remove(win);
      break;

    case "chrome://browser/content/places/places.xul":
      break;
    case "chrome://mozapps/content/extensions/about.xul":
      break;
  }
}


function saveProfiles(win) {
  // update: profile id is preserved (for further enabling)
  // by tab["${PROFILE_DISABLED_ATTR}"];
  for (var tab of UIUtils.getTabList(win)) {
    var id = Profile.getIdentity(tab.linkedBrowser);
    Profile.removeIdentity(tab);

    // save even DefaultIdentity, so we prevent bugs when enabling
    tab.setAttribute("${PROFILE_DISABLED_ATTR}", id);
  }
}


function restoreProfiles(win) {
  // updating from a per window version?
  var winId = -1;
  var attrWin = "${PROFILE_DEPRECATED_DISABLED}";
  if (UIUtils.getContentContainer(win).hasAttribute(attrWin)) {
    var tb = UIUtils.getContentContainer(win);
    winId = Profile.toInt(tb.getAttribute(attrWin));
    tb.removeAttribute(attrWin);
    console.log("updating window profile id", winId);
  }

  for (var tab of UIUtils.getTabList(win)) {
    var browser = tab.linkedBrowser;
    if (winId > -1) {
      // copy window profile to all tabs
      Profile.defineIdentity(browser, winId);
    }
    if (tab.hasAttribute("${PROFILE_DISABLED_ATTR}")) {
      var id = Profile.toInt(tab.getAttribute("${PROFILE_DISABLED_ATTR}"));
      tab.removeAttribute("${PROFILE_DISABLED_ATTR}");
      Profile.defineIdentity(browser, id);
    }
  }
}


var ContentWindowObserver = {
  enable: function() {
    Services.obs.addObserver(this, "content-document-global-created", false);
  },


  disable: function() {
    Services.obs.removeObserver(this, "content-document-global-created");
  },


  observe: function(win, topic, data) {
    if (win !== win.top) {
      return;
    }

    var browser = UIUtils.findOriginBrowser(win);
    if (browser === null) {
      return;
    }

    if (m_pendingNewProfiles.length > 0) {
      Profile.defineIdentity(browser, m_pendingNewProfiles.pop());
      this._ui(browser);
      return;
    }

    if (Profile.isInitialized(browser)) {
      return;
    }

    // new tab: inherit identity profile
    if (util.networkListeners.active) {
      Profile.defineIdentity(browser, Profile.getNextProfile());
      this._ui(browser);
      // BUG when "move to a new window" in a bg tab
      // TODO keep a list with outer IDs => profile
    }
  },


  _ui: function(browser) {
    var win = browser.ownerDocument.defaultView.top;
    win.requestAnimationFrame(function() {
      var winId = util.getOuterId(win).toString();
      Services.obs.notifyObservers(null, "${BASE_DOM_ID}-id-changed", winId);
    });
  }
};


// When requesting a top window, we need to know the future profile id.
// It has not been set yet (by defineIdentity), code running in current tab
// need to use the 'old' profile until the new top document is created.
function getNextTopDocumentProfile(browser) {
  var len = m_pendingNewProfiles.length;
  return len === 0
          ? Profile.getIdentity(browser)
          : m_pendingNewProfiles[len - 1];
}


var WinEvents = {
  tabOpen: function(evt) {
    var tab = evt.target;
    console.assert(tab.localName === "tab", "tab should be a tab element", tab);

    // new tab command? always default id (e.g. ctrl+T)
    var browser = tab.linkedBrowser;
    if (browser.contentWindow.location.href === "about:newtab") {
      Profile.defineIdentity(browser, Profile.DefaultIdentity);
      var winId = util.getOuterId(browser.ownerDocument.defaultView).toString();
      Services.obs.notifyObservers(null, "${BASE_DOM_ID}-id-changed", winId);
    }
  },


  tabRestoring: function(evt) {
    var tab = evt.target;
    console.assert(tab.localName === "tab", "tab should be a tab element", tab);

    var ss = Cc["@mozilla.org/browser/sessionstore;1"].getService(Ci.nsISessionStore);
    var stringId = ss.getTabValue(tab, "${PROFILE_SESSION}");
    if (stringId.length === 0) {
      stringId = Profile.DefaultIdentity.toString();
    }

    Profile.defineIdentity(tab.linkedBrowser, Profile.toInt(stringId));

    if (tab.selected) {
      var winId = util.getOuterId(tab.ownerDocument.defaultView).toString();
      Services.obs.notifyObservers(null, "${BASE_DOM_ID}-id-changed", winId);
    }
  },


  winActivate: function(evt) {
    var win = evt.currentTarget;
    console.assert(win instanceof Ci.nsIDOMChromeWindow, "win should be a xul window", win);
    var browser = UIUtils.getSelectedTab(win).linkedBrowser;
    Profile.setNextTabProfileId(Profile.getIdentity(browser));
  },


  tabSelected: function(evt) {
    var tab = evt.target;
    console.assert(tab.localName === "tab", "tab should be a tab element", tab);

    var browser = tab.linkedBrowser;
    Profile.setNextTabProfileId(Profile.getIdentity(browser));
    ErrorHandler.updateButtonAsync(browser);
  },


  winUnload: function(evt) {
    var win = evt.currentTarget;
    console.assert(win instanceof Ci.nsIDOMChromeWindow, "win should be a xul window", win);
    BrowserOverlay.remove(win);
    updateEngineState();
  },


  tabClose: function(evt) {
    var tab = evt.target;
    console.assert(tab.localName === "tab", "tab should be a tab element", tab);
    updateEngineState(tab.linkedBrowser);
  }
};


const BrowserOverlay = {
  add: function(win) {
    var doc = win.document;
    insertButtonView(doc);

    win.addEventListener("unload",   WinEvents.winUnload,   false);
    win.addEventListener("activate", WinEvents.winActivate, false);

    // detect session restore
    doc.addEventListener("SSTabRestoring", WinEvents.tabRestoring, false);

    var container = UIUtils.getTabStripContainer(win);
    container.addEventListener("TabOpen",   WinEvents.tabOpen,     false);
    container.addEventListener("TabClose",  WinEvents.tabClose,    false);
    container.addEventListener("TabSelect", WinEvents.tabSelected, false);

    // key
    var key = doc.getElementById("mainKeyset").appendChild(doc.createElement("key"));
    key.setAttribute("id", "key_${BASE_DOM_ID}-new-identity");
    key.setAttribute("modifiers", Services.appinfo.OS === "Darwin" ? "control,alt" : "accel,alt");
    key.setAttribute("key", "M");

    key.setAttribute("oncommand",
      "Components.utils.import('${PATH_MODULE}/commands.js',{})" +
      ".windowCommand(event,this,'cmd_select_profile')");

    // menus
    addMenuListeners(doc);

    var winId = util.getOuterId(win).toString();
    Services.obs.notifyObservers(null, "${BASE_DOM_ID}-id-changed", winId);
  },


  remove: function(win) {
    console.assert(win instanceof Ci.nsIDOMChromeWindow, "win should be a xul window", win);

    win.removeEventListener("unload", WinEvents.winUnload, false);
    win.removeEventListener("activate", WinEvents.winActivate, false);

    var doc = win.document;
    doc.removeEventListener("SSTabRestoring", WinEvents.tabRestoring, false);

    var container = UIUtils.getTabStripContainer(win);
    container.removeEventListener("TabOpen",   WinEvents.tabOpen,     false);
    container.removeEventListener("TabClose",  WinEvents.tabClose,    false);
    container.removeEventListener("TabSelect", WinEvents.tabSelected, false);

    updateEngineState();
    removeMenuListeners(doc);

    // key
    var key = doc.getElementById("key_${BASE_DOM_ID}-new-identity");
    key.parentNode.removeChild(key);

    destroyButton(doc);
  }
};


var PlacesOverlay = {
  add: function(win) {
    var popup = win.document.getElementById("placesContext");
    popup.addEventListener("popupshowing", PlacesOverlay._listener, false);
  },

  remove: function(win) {
    var popup = win.document.getElementById("placesContext");
    popup.removeEventListener("popupshowing", PlacesOverlay._listener, false);
  },

  _listener: function(evt) {
    var ns = {};
    Components.utils.import("${PATH_MODULE}/menus.js", ns);
    ns.menuShowing(evt);
  }
};


var AboutOverlay = {
  add: function(win) {
    if (win.arguments[0].id !== "${EXT_ID}") {
      return;
    }

    var browserWin = Services.wm.getMostRecentWindow("navigator:browser");
    if (browserWin === null) {
      return;
    }

    var uri = Services.io.newURI("about:multifox", null, null);
    var where = Ci.nsIBrowserDOMWindow.OPEN_NEWTAB;
    browserWin.browserDOMWindow.openURI(uri, null, where, null);

    win.close();

    // hide window to avoid flickering
    var root = win.document.documentElement;
    root.setAttribute("hidechrome", "true");
    root.setAttribute("hidden", "true");
  }
};


function addMenuListeners(doc) {
  var ids = ["contentAreaContextMenu", "placesContext", "menu_FilePopup"];
  for (var idx = ids.length - 1; idx > -1; idx--) {
    doc.getElementById(ids[idx]).addEventListener("popupshowing", onMenuPopupShowing, false);
  }
}


function removeMenuListeners(doc) {
  var ids = ["contentAreaContextMenu", "placesContext", "menu_FilePopup"];
  for (var idx = ids.length - 1; idx > -1; idx--) {
    doc.getElementById(ids[idx]).removeEventListener("popupshowing", onMenuPopupShowing, false);
  }
}


function onMenuPopupShowing(evt) {
  var ns = {};
  Components.utils.import("${PATH_MODULE}/menus.js", ns);
  ns.menuShowing(evt);
}


const util = {
  setUnicodePref: function(name, val) {
    var CiS = Ci.nsISupportsString;
    var str = Cc["@mozilla.org/supports-string;1"].createInstance(CiS);
    str.data = val;
    Services.prefs.getBranch("extensions.${EXT_ID}.").setComplexValue(name, CiS, str);
  },

  emptyNode: function(node) {
    while (node.firstChild !== null) {
      node.removeChild(node.firstChild);
    };
  },

  getOuterId: function(win) {
    return win.QueryInterface(Ci.nsIInterfaceRequestor)
              .getInterface(Ci.nsIDOMWindowUtils)
              .outerWindowID;
  },

  getText: function(name) {
    return this._getTextCore(name, "extension", arguments, 1);
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
      observe: function(subject, topic, data) {
        console.log("cookie-rejected\n", subject, "\n", topic, "\n", data, "\n", subject.QueryInterface(Ci.nsIURI).spec);
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
