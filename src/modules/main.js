/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["Main",  // bootstrap.js
                        "util"]; // about-multifox.html

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

#include "main.window.js"
#include "main.network.js"
#include "main.script-injection.js"
#include "main.ContentRelatedEvents.js"
#include "main.ChromeRelatedEvents.js"
#include "main.WinMap.js"
#include "main.User.js"
#include "main.CrossTldLogin.js"
#include "main.logindb.js"
#include "main.utils-storage.js"
#include "main.login-submit.js"
#include "main.cookies.js"
#include "main.util.js"
#include "main.about.js"
#include "main.icon.js"
#include "main.UIUtils.js"


var Main = {
  _install: false,

  install: function() {
    this._install = true;
    var ns = util.loadSubScript("${PATH_MODULE}/maintenance.js");
    ns.install();
  },

  uninstall: function() {
    var ns = util.loadSubScript("${PATH_MODULE}/maintenance.js");
    ns.uninstall();
  },

  startup: function(isAppStartup) {
    if (this._install) {
      // set localized description (install cannot read locale files)
      var desc = util.getTextFrom("about.properties", "extensions.${EXT_ID}.description");
      Services.prefs.getBranch("extensions.${EXT_ID}.").setCharPref("description", desc);
    }

    var ss = Cc["@mozilla.org/browser/sessionstore;1"].getService(Ci.nsISessionStore);
    try {
      ss.persistTabAttribute("multifox-tab-logins");
    } catch (ex) {
      // exception resource:///modules/sessionstore/SessionStore.jsm :: ssi_writeFile :: line 4358
      console.log(ex);
    }

    StringEncoding.init();
    registerAbout();
    DocOverlay.init();
    SubmitObserver.start();
    NetworkObserver.start();
    Cookies.start();
    LoginDB.init();
    ContentRelatedEvents.init();
    WindowWatcher.init();
    if (isAppStartup === false) {
      MainWindow.initAll();
    }

    LoginDB._ensureValid(); // BUG workaround to display welcome icon
  },

  shutdown: function() {
    WindowWatcher.uninit();
    SubmitObserver.stop();
    NetworkObserver.stop();
    Cookies.stop();
    LoginDB.uninit();
    ContentRelatedEvents.uninit();
    MainWindow.uninitAll();
    unregisterAbout();
  }
};
