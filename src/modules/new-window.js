/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


"use strict";

var EXPORTED_SYMBOLS = ["Cc", "Ci", "console", "util", "Bootstrap", "newPendingWindow", "isPrivateWindow", "showPrivateWinMsg", "onXulCommand"];

const Cc = Components.classes;
const Ci = Components.interfaces;

var m_pendingNewWindows = [];

function newPendingWindow(profileId) {
  if (profileId === undefined) {
    var ns = {};
    Components.utils.import("${PATH_MODULE}/main.js", ns);
    profileId = ns.Profile.UndefinedIdentity;
  }
  m_pendingNewWindows.push(profileId);
}

var m_docObserver = null;

var Bootstrap = {

  extensionStartup: function(installing) {
    console.assert(m_docObserver === null, "m_docObserver should be null");
    console.assert(m_pendingNewWindows.length === 0, "m_pendingNewWindows should be empty");

    if (installing) {
      var desc = util.getTextFrom("extensions.${EXT_ID}.description", "about");
      util.setUnicodePref("description", desc);
    }

    m_docObserver = new DocObserver();

    var enumWin = Services.wm.getEnumerator(null);
    while (enumWin.hasMoreElements()) {
      forEachWindow(addOverlay, enumWin.getNext());
    }

    enumWin = Services.wm.getEnumerator("navigator:browser");
    while (enumWin.hasMoreElements()) {
      BrowserOverlay.add2(enumWin.getNext());
    }
  },

  extensionShutdown: function() {
    m_docObserver.shutdown();
    var enumWin = Services.wm.getEnumerator(null);
    while (enumWin.hasMoreElements()) {
      forEachWindow(removeOverlay, enumWin.getNext());
    }
  },


  extensionUninstall: function() {
    var enumWin = Services.wm.getEnumerator("navigator:browser");
    while (enumWin.hasMoreElements()) {
      removeState(enumWin.getNext());
    }

    // prefs
    Services.prefs.getBranch("extensions.${EXT_ID}.").deleteBranch("");

    var ns = {};
    Components.utils.import("${PATH_MODULE}/actions.js", ns);
    ns.removeData();
  }

};



Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");


function forEachWindow(fn, win) {
  fn(win);
  for (var idx = win.length - 1; idx > -1; idx--) {
    forEachWindow(fn, win[idx]);
  }
}


function DocObserver() {
  Services.obs.addObserver(this, "chrome-document-global-created", false);
}


DocObserver.prototype = {
  shutdown: function() {
    Services.obs.removeObserver(this, "chrome-document-global-created");
  },

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
  addOverlay(win);
}


// DOMContentLoaded is too early for #navigator-toolbox.palette
// load may be too late to new MultifoxRunner()
function onBrowserWinLoad(evt) {
  var win = evt.currentTarget;
  win.removeEventListener("load", onBrowserWinLoad, false);
  BrowserOverlay.add2(win);
}


function addOverlay(win) {
  switch (win.location.href) {
    case "chrome://browser/content/browser.xul":
      if (isPrivateWindow(win)) {
        break;
      }
      BrowserOverlay.add(win);
      win.addEventListener("load", onBrowserWinLoad, false);
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


function removeOverlay(win) {
  switch (win.location.href) {
    case "chrome://browser/content/browser.xul":
      if (isPrivateWindow(win)) {
        break;
      }

      var contentContainer = win.getBrowser();
      var tmp = contentContainer.getUserData("${BASE_DOM_ID}-identity-id");
      contentContainer.setUserData("${BASE_DOM_ID}-identity-id-tmp", tmp, null);

      var ns = {};
      Components.utils.import("${PATH_MODULE}/main.js", ns);
      ns.Profile.defineIdentity(win, ns.Profile.DefaultIdentity);

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


function removeState(win) { // uninstalling
  console.assert(win.location.href === "chrome://browser/content/browser.xul", "win should be a browser window");

  var contentContainer = win.getBrowser();
  contentContainer.setUserData("${BASE_DOM_ID}-identity-id", null, null);
  contentContainer.setUserData("${BASE_DOM_ID}-identity-id-tmp", null, null);

  var ss = Cc["@mozilla.org/browser/sessionstore;1"].getService(Ci.nsISessionStore);
  ss.deleteWindowValue(win, "${BASE_DOM_ID}-identity-id");
}


const BrowserOverlay = {
  add: function(win) {
    win.addEventListener("unload", BrowserOverlay._unload, false);


    var doc = win.document;
    //if ((doc instanceof Ci.nsIDOMDocument) === false) {

    // detect session restore
    doc.addEventListener("SSTabRestoring", onTabRestoring, false);
    doc.addEventListener("SSTabRestored", onTabRestored, false);

    // commands
    appendXulCommands(doc);

    // key
    var key = doc.getElementById("mainKeyset").appendChild(doc.createElement("key"));
    key.setAttribute("id", "key_${BASE_DOM_ID}-new-identity");
    key.setAttribute("modifiers", Services.appinfo.OS === "Darwin" ? "control,alt" : "accel,alt");
    key.setAttribute("key", "M");
    key.setAttribute("command", "${CHROME_NAME}:cmd_new_profile");

    // menus
    addMenuListeners(doc);
  },

  add2: function(win) { // toolbar button
    console.assert(win.location.href === "chrome://browser/content/browser.xul",
                   "win should be a browser window " + win.location.href);
    var ns = {};
    Components.utils.import("${PATH_MODULE}/main.js", ns);
    ns.createButton(win.document);
    setWindowProfile(win);
  },


  _unload: function(evt) {
    var win = evt.currentTarget;
    win.removeEventListener("unload", BrowserOverlay._unload, false);
    BrowserOverlay.remove(win);
  },

  remove: function(win) {
    var doc = win.document;
    removeMenuListeners(doc);

    // key
    var key = doc.getElementById("key_${BASE_DOM_ID}-new-identity");
    key.parentNode.removeChild(key);

    // commands
    removeXulCommands(doc);

    var ns = {};
    Components.utils.import("${PATH_MODULE}/main.js", ns);
    ns.destroyButton(doc);
  }
};


function appendXulCommands(doc) {
  var commands = [
    "${CHROME_NAME}:cmd_new_profile",
    "${CHROME_NAME}:cmd_rename_profile_prompt",
    "${CHROME_NAME}:cmd_delete_profile_prompt",
    "${CHROME_NAME}:cmd_delete_profile",
    "${CHROME_NAME}:cmd_select_window",
    "${CHROME_NAME}:cmd_set_profile_window"
  ];

  var js = "var jsm={};Cu.import('${PATH_MODULE}/new-window.js',jsm);jsm.onXulCommand(event)";
  var cmdset = doc.documentElement.appendChild(doc.createElement("commandset"));

  for (var idx = commands.length - 1; idx > -1; idx--) {
    var cmd = cmdset.appendChild(doc.createElement("command"));
    cmd.setAttribute("id", commands[idx]);
    cmd.setAttribute("oncommand", js);
  }
}


function removeXulCommands(doc) {
  var cmdset = doc.getElementById("${CHROME_NAME}:cmd_new_profile").parentNode;
  cmdset.parentNode.removeChild(cmdset);
}


function onXulCommand(evt) {
  var cmd = evt.target; // <command>
  var win = cmd.ownerDocument.defaultView.top;
  if (isPrivateWindow(win)) {
    showPrivateWinMsg(win);
    return;
  }

  var ns = {};
  Components.utils.import("${PATH_MODULE}/actions.js", ns);
  ns.xulCommand(evt);
  Components.utils.unload("${PATH_MODULE}/actions.js");
}


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


function isPrivateWindow(win) {
  var ns = {};
  Components.utils.import("resource://gre/modules/PrivateBrowsingUtils.jsm", ns);
  return ns.PrivateBrowsingUtils.isWindowPrivate(win);
}


function showPrivateWinMsg(win) {
  var msg = util.getText("error.private-window.infobar.label", "${EXT_NAME}");
  var icon = "chrome://global/skin/icons/information-16.png";

  var browser = win.gBrowser.selectedBrowser;
  var barBox = browser.getTabBrowser().getNotificationBox(browser);
  barBox.appendNotification(msg, "${BASE_DOM_ID}-privwin", icon, barBox.PRIORITY_WARNING_MEDIUM);
}


function setWindowProfile(newWin) {
  var ns = {};
  Components.utils.import("${PATH_MODULE}/main.js", ns);

  var contentContainer = newWin.getBrowser();
  var tmp = contentContainer.getUserData("${BASE_DOM_ID}-identity-id-tmp");

  if (tmp !== null) {
    // updating/enabling the extension
    contentContainer.setUserData("${BASE_DOM_ID}-identity-id-tmp", null, null);
    ns.Profile.defineIdentity(newWin, ns.Profile.toInt(tmp));

  } else if (m_pendingNewWindows.length > 0) {
    var profileId = m_pendingNewWindows.pop();
    if (profileId !== ns.Profile.UndefinedIdentity) {
      ns.Profile.defineIdentity(newWin, profileId);
    } else {
      // new identity profile
      ns.NewWindow.newId(newWin);
    }

  } else {
    // inherit identity profile
    if (util.networkListeners.active) {
      ns.NewWindow.inheritId(newWin);
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
  var ns = {};
  Components.utils.import("${PATH_MODULE}/menus.js", ns);
  ns.menuShowing(evt);
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
  setUnicodePref: function(name, val) {
    var CiS = Ci.nsISupportsString;
    var str = Cc["@mozilla.org/supports-string;1"].createInstance(CiS);
    str.data = val;
    Services.prefs.getBranch("extensions.${EXT_ID}.").setComplexValue(name, CiS, str);
  },

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
