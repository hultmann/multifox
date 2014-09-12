/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["UIUtils", "console",
                        "registerButton", "updateButton",
                        "insertButtonView", "destroyButton",
                        "ErrorHandler", "ExtCompat",
                        "ProfileAlias", "Profile"
                       ];

var Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/PrivateBrowsingUtils.jsm");
Cu.import("${PATH_MODULE}/new-window.js");


#include "main.window.js"
#include "main.button.js"
#include "main.script-injection.js"
#include "main.script-source.js"
#include "main.network.js"
#include "main.cookies.js"
#include "main.storage.js"
#include "main.error.js"
#include "main.console.js"


const Profile = {
  PrivateIdentity:   0,
  DefaultIdentity:   1,
  MaxIdentity:       Number.MAX_SAFE_INTEGER,
  _nextProfile:     -1,

  defineIdentity: function(browser, id) {
    console.assert(browser.localName === "browser", "browser should be a browser element", browser);
    console.assert(typeof id === "number", "id is not a number.", typeof id);
    var current = Profile.getIdentity(browser);

    var win = browser.ownerDocument.defaultView;
    if (PrivateBrowsingUtils.isWindowPrivate(win)) {
      id = Profile.PrivateIdentity;
    }

    if (id > Profile.MaxIdentity) {
      id = Profile.MaxIdentity;
    } else if (id < Profile.DefaultIdentity) {
      id = Profile.DefaultIdentity; // private?
    }


    var tab = UIUtils.getLinkedTabFromBrowser(browser);
    if (tab.selected) {
      Profile.setNextTabProfileId(id);
    }


    if (current !== id) {
      // save profile id in browser element
      // (tab element may not exist when the unload event is raised)
      var sid = id.toString();
      browser.setAttribute("${PROFILE_BROWSER_ATTR}", sid);
      Cc["@mozilla.org/browser/sessionstore;1"].
        getService(Ci.nsISessionStore).
        setTabValue(tab, "${PROFILE_SESSION}", sid);
    }

    updateEngineState();
    return id;
  },


  isInitialized: function(browser) {
    return browser.hasAttribute("${PROFILE_BROWSER_ATTR}");
  },


  removeIdentity: function(tab) {
    if (tab.linkedBrowser.hasAttribute("${PROFILE_BROWSER_ATTR}")) {
      tab.linkedBrowser.removeAttribute("${PROFILE_BROWSER_ATTR}");

      var ss = Cc["@mozilla.org/browser/sessionstore;1"].getService(Ci.nsISessionStore);
      ss.setTabValue(tab,    "${PROFILE_SESSION}", ""); // avoid exception
      ss.deleteTabValue(tab, "${PROFILE_SESSION}");
    }
  },


  isNativeProfile: function(id) {
    return this.isExtensionProfile(id) === false;
  },


  isExtensionProfile: function(id) {
    return id > Profile.DefaultIdentity;
  },


  getIdentity: function(browser) {
    if (browser.hasAttribute("${PROFILE_BROWSER_ATTR}")) {
      var profileId = this.toInt(browser.getAttribute("${PROFILE_BROWSER_ATTR}"));
      if (this.isExtensionProfile(profileId)) {
        return profileId;
      }
    }

    var win = browser.ownerDocument.defaultView;
    return PrivateBrowsingUtils.isWindowPrivate(win)
         ? Profile.PrivateIdentity
         : Profile.DefaultIdentity
  },


  getIdentityFromContent: function(win) {
    var browser = UIUtils.findOriginBrowser(win);
    return browser === null
         ? Profile.DefaultIdentity
         : Profile.getIdentity(browser);
  },


  setNextTabProfileId: function(id) {
    this._nextProfile = id;
  },


  getNextProfile: function() {
    return this._nextProfile;
  },


  activeExtensionIdentities: function(closedBrowser = null) {
    var winEnum = Services.wm.getEnumerator("navigator:browser");
    var arr = [];
    while (winEnum.hasMoreElements()) {
      for (var browser of UIUtils.getBrowserList(winEnum.getNext())) {
        var id = Profile.getIdentity(browser);
        if (Profile.isExtensionProfile(id)) {
          if (arr.indexOf(id) === -1) {
            if (closedBrowser !== browser) {
              arr.push(id);
            }
          }
        }
      }
    }
    return arr;
  },


  lowerAvailableId: function() {
    var current = Profile.getProfileList();
    var id = Profile.DefaultIdentity + 1;
    while (current.indexOf(id) > -1) {
      id++;
    }
    return id; // id is available
  },


  getProfileList: function() {
    var list = this._getProfileWithCookies();
    var active = this.activeExtensionIdentities();

    for (var idx = active.length - 1; idx > -1; idx--) {
      var id = active[idx];
      if (list.indexOf(id) === -1) {
        list.push(id);
      }
    }

    return list;
  },


  _getProfileWithCookies: function() {
    var list = [];
    var nsList = [];

    var all = Services.cookies.enumerator;
    var COOKIE = Ci.nsICookie2;
    while (all.hasMoreElements()) {
      var h = all.getNext().QueryInterface(COOKIE).host;
      if (h.endsWith(".multifox") === false) {
        continue;
      }
      var ns = h.substr(h.lastIndexOf("-") + 1);
      if (nsList.indexOf(ns) === -1) {
        nsList.push(ns); // "2.multifox"
      }
    }

    for (var idx = nsList.length - 1; idx > -1; idx--) {
      var n = Number.parseInt(nsList[idx].replace(".multifox", ""), 10);
      if (Number.isNaN(n) === false) {
        list.push(n);
      }
    }

    return list;
  },


  enableEngine: function() {
    console.log("init net/cookies");
    Cookies.start();
    DocStartScriptInjection.init();

    Components.utils.import("${PATH_MODULE}/new-window.js", null)
      .util.networkListeners.enable(httpListeners.request, httpListeners.response);
    // BUG util is undefined???
  },


  disableEngine: function() {
    // BUG util is undefined???
    Components.utils.import("${PATH_MODULE}/new-window.js", null)
      .util.networkListeners.disable();
    DocStartScriptInjection.stop();
    Cookies.stop();
    console.log("stop net/cookies");
  },


  toInt: function(str) {
    var rv = Number.parseInt(str, 10);
    return Number.isNaN(rv) ? Profile.DefaultIdentity : rv;
  }

};
