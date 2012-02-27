/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Multifox.
 *
 * The Initial Developer of the Original Code is
 * Jeferson Hultmann <hultmann@gmail.com>
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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
#include "main.storage.js"
#include "main.tablogin.js"
#include "main.logindb.js"
#include "main.channel-login.js"
#include "main.utils-storage.js"
#include "main.login-submit.js"
#include "main.cookies.js"
#include "main.util.js"
#include "main.about.js"
#include "main.tab-inherit.js"
#include "main.icon.js"


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
    ss.persistTabAttribute("multifox-tab-id-provider-tld-enc");
    ss.persistTabAttribute("multifox-tab-id-provider-user-enc");
    ss.persistTabAttribute("multifox-tab-current-tld"); // detect TLD change
    ss.persistTabAttribute("multifox-tab-previous-tld");

    StringEncoding.init();
    registerAbout();
    DocOverlay.start();
    SubmitObserver.start();
    NetworkObserver.start();

    Cookies.start();
    var obs = Services.obs;
    obs.addObserver(LoginDB.onCookieRejected, "cookie-rejected", false);
    obs.addObserver(LoginDB.onCookieChanged, "cookie-changed", false);

    WindowWatcher.start();
    if (isAppStartup === false) {
      var winEnum = Services.wm.getEnumerator("navigator:browser");
      while (winEnum.hasMoreElements()) {
        BrowserWindow.register(winEnum.getNext());
      }
    }

    LoginDB._ensureValid(); // BUG workaround to display welcome icon
  },

  shutdown: function() {
    WindowWatcher.stop();
    DocOverlay.stop();
    SubmitObserver.stop();
    NetworkObserver.stop();
    Cookies.stop();
    unregisterAbout();

    var obs = Services.obs;
    obs.removeObserver(LoginDB.onCookieRejected, "cookie-rejected");
    obs.removeObserver(LoginDB.onCookieChanged, "cookie-changed");

    var winEnum = Services.wm.getEnumerator("navigator:browser");
    while (winEnum.hasMoreElements()) {
      BrowserWindow.unregister(winEnum.getNext());
    }
  }
};
